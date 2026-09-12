import type { SignageContent } from "@/types/signage";

/**
 * A self-contained board used when no DROPBOX_ACCESS_TOKEN is configured.
 *
 * The point of this POC is the offline sync engine, not the artwork, but a
 * deployment with no credentials used to sit on "Loading…" forever — which
 * makes the whole thing look broken to anyone who just followed a link to it.
 * These two SVGs ship with the app, so the board renders, the Service Worker
 * has something real to precache, and the outage behaviour is still
 * demonstrable end to end.
 *
 * The fictional brand keeps the public demo independent of any real client's
 * menu. `fingerprint` is a fixed string rather than a content hash, so the
 * sync engine correctly decides nothing has changed between polls.
 */
export const DEMO_FINGERPRINT = "demo:northline-v1";

export function buildDemoContent(storeId: string, screenId: string): SignageContent {
  return {
    schemaVersion: 1,
    storeId,
    screenId,
    generatedAt: new Date().toISOString(),
    fingerprint: DEMO_FINGERPRINT,
    sections: [
      { id: "main", image: "/demo/main.svg", sourceModifiedAt: null },
      { id: "weekly", image: "/demo/weekly.svg", sourceModifiedAt: null },
    ],
  };
}
