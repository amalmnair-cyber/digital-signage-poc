import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SignageContent } from "@/types/signage";

interface ContentRecord {
  id: string; // `${displayKey}::${fingerprint}`
  displayKey: string;
  fingerprint: string;
  cachedAt: string;
  content: SignageContent;
}

interface MetaRecord {
  displayKey: string;
  activeFingerprint: string | null;
  previousFingerprint: string | null;
  lastCheckedAt: string | null;
  lastSuccessfulUpdateAt: string | null;
}

interface SignageDB extends DBSchema {
  content: {
    key: string;
    value: ContentRecord;
    indexes: { "by-displayKey": string };
  };
  meta: {
    key: string;
    value: MetaRecord;
  };
}

// The IndexedDB *schema* version (this "1") is unrelated to the content
// *fingerprint* strings below — bumping one never implies the other.
const DB_NAME = "signage-db";
const DB_SCHEMA_VERSION = 2; // bumped: v1's schema used integer content versions

let dbPromise: Promise<IDBPDatabase<SignageDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("getDB() is browser-only");
  }
  if (!dbPromise) {
    dbPromise = openDB<SignageDB>(DB_NAME, DB_SCHEMA_VERSION, {
      upgrade(db) {
        // "bundles" is a store name from the old (pre-Dropbox) schema —
        // not part of SignageDB any more, so it needs an escape hatch
        // from idb's schema-aware typing purely for this one-time cleanup.
        if (db.objectStoreNames.contains("bundles" as never)) {
          (db as unknown as { deleteObjectStore(name: string): void }).deleteObjectStore("bundles");
        }
        if (db.objectStoreNames.contains("meta")) {
          db.deleteObjectStore("meta");
        }
        const content = db.createObjectStore("content", { keyPath: "id" });
        content.createIndex("by-displayKey", "displayKey");
        db.createObjectStore("meta", { keyPath: "displayKey" });
      },
    });
  }
  return dbPromise;
}

function contentRecordId(displayKey: string, fingerprint: string): string {
  return `${displayKey}::${fingerprint}`;
}

export async function readMeta(displayKey: string): Promise<MetaRecord | undefined> {
  const db = await getDB();
  return db.get("meta", displayKey);
}

export async function readContent(
  displayKey: string,
  fingerprint: string
): Promise<SignageContent | undefined> {
  const db = await getDB();
  const record = await db.get("content", contentRecordId(displayKey, fingerprint));
  return record?.content;
}

export async function readActiveContent(displayKey: string): Promise<SignageContent | undefined> {
  const meta = await readMeta(displayKey);
  if (meta?.activeFingerprint == null) return undefined;
  return readContent(displayKey, meta.activeFingerprint);
}

export async function touchLastChecked(displayKey: string, at: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get("meta", displayKey);
  await db.put("meta", {
    displayKey,
    activeFingerprint: existing?.activeFingerprint ?? null,
    previousFingerprint: existing?.previousFingerprint ?? null,
    lastSuccessfulUpdateAt: existing?.lastSuccessfulUpdateAt ?? null,
    lastCheckedAt: at,
  });
}

/**
 * The atomic activation step: write the new content and flip the active
 * pointer in one IndexedDB read-write transaction, then report which (if
 * any) older fingerprint is now safe to evict. Nothing here ever touches
 * an already-active record in place — it only ever adds a new one and
 * then repoints `meta`.
 */
export async function activateContent(
  displayKey: string,
  content: SignageContent,
  cachedAt: string
): Promise<{ evict: string[] }> {
  const db = await getDB();
  const tx = db.transaction(["content", "meta"], "readwrite");

  const contentStore = tx.objectStore("content");
  const metaStore = tx.objectStore("meta");

  const currentMeta = await metaStore.get(displayKey);
  const newFingerprint = content.fingerprint;

  await contentStore.put({
    id: contentRecordId(displayKey, newFingerprint),
    displayKey,
    fingerprint: newFingerprint,
    cachedAt,
    content,
  });

  const retained = new Set<string>([newFingerprint]);
  const nextPrevious =
    currentMeta?.activeFingerprint != null && currentMeta.activeFingerprint !== newFingerprint
      ? currentMeta.activeFingerprint
      : (currentMeta?.previousFingerprint ?? null);
  if (nextPrevious != null) retained.add(nextPrevious);

  await metaStore.put({
    displayKey,
    activeFingerprint: newFingerprint,
    previousFingerprint: nextPrevious,
    lastCheckedAt: cachedAt,
    lastSuccessfulUpdateAt: cachedAt,
  });

  await tx.done;

  const allForDisplay = await db.getAllFromIndex("content", "by-displayKey", displayKey);
  const evict = allForDisplay
    .map((record) => record.fingerprint)
    .filter((fingerprint) => !retained.has(fingerprint));

  if (evict.length > 0) {
    const evictTx = db.transaction("content", "readwrite");
    await Promise.all(
      evict.map((fingerprint) => evictTx.store.delete(contentRecordId(displayKey, fingerprint)))
    );
    await evictTx.done;
  }

  return { evict };
}

function safeCacheKey(fingerprint: string): string {
  return fingerprint.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 120);
}

export function assetCacheName(displayKey: string, fingerprint: string): string {
  return `signage-assets__${displayKey.replace("/", "__")}__${safeCacheKey(fingerprint)}`;
}
