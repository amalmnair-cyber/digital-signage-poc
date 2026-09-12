import { collectImageUrls, displayKeyFor, type SignageContent } from "@/types/signage";
import { activateContent, assetCacheName, readActiveContent, readMeta, touchLastChecked } from "./db";
import { describeInvalidContent, validateContent } from "./validateContent";
import { isSimulatedOffline } from "./devControls";

export type UpdatePhase =
  | "idle"
  | "checking"
  | "downloading"
  | "verifying"
  | "activating"
  | "failed";

export interface SyncError {
  message: string;
  phase: UpdatePhase;
  at: string;
}

export interface SyncState {
  connectivity: "online" | "offline";
  updatePhase: UpdatePhase;
  hasLoadedFromCache: boolean;
  activeContent: SignageContent | null;
  activeFingerprint: string | null;
  previousFingerprint: string | null;
  lastCheckedAt: string | null;
  lastSuccessfulUpdateAt: string | null;
  lastError: SyncError | null;
}

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const BUSY_PHASES = new Set<UpdatePhase>(["checking", "downloading", "verifying", "activating"]);

export interface SyncManager {
  subscribe(listener: () => void): () => void;
  getSnapshot(): SyncState;
  init(): void;
  checkNow(): Promise<void>;
}

function initialState(): SyncState {
  return {
    connectivity: "online",
    updatePhase: "idle",
    hasLoadedFromCache: false,
    activeContent: null,
    activeFingerprint: null,
    previousFingerprint: null,
    lastCheckedAt: null,
    lastSuccessfulUpdateAt: null,
    lastError: null,
  };
}

function createSyncManager(storeId: string, screenId: string): SyncManager {
  const displayKey = displayKeyFor(storeId, screenId);
  let state = initialState();
  const listeners = new Set<() => void>();
  let initialized = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function setState(patch: Partial<SyncState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  async function fetchRemoteContent(): Promise<SignageContent> {
    if (isSimulatedOffline()) {
      throw new Error("Simulated offline (dev panel)");
    }
    const res = await fetch(`/api/signage/${storeId}/${screenId}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Signage API returned HTTP ${res.status}`);
    }
    const json: unknown = await res.json();
    if (!validateContent(json)) {
      throw new Error(`Malformed content received: ${describeInvalidContent(json)}`);
    }
    return json;
  }

  function handleFailure(phase: Exclude<UpdatePhase, "idle" | "failed">, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    setState({
      updatePhase: "failed",
      connectivity: phase === "checking" ? "offline" : state.connectivity,
      lastError: { message, phase, at: new Date().toISOString() },
    });
  }

  async function checkNow(): Promise<void> {
    if (BUSY_PHASES.has(state.updatePhase)) return;
    setState({ updatePhase: "checking" });

    let remote: SignageContent;
    try {
      remote = await fetchRemoteContent();
    } catch (error) {
      handleFailure("checking", error);
      return;
    }

    const checkedAt = new Date().toISOString();
    await touchLastChecked(displayKey, checkedAt);
    setState({ connectivity: "online", lastCheckedAt: checkedAt });

    const currentFingerprint = state.activeFingerprint;
    if (currentFingerprint != null && remote.fingerprint === currentFingerprint) {
      setState({ updatePhase: "idle" });
      return;
    }

    // --- Download: everything must succeed before anything active changes ---
    setState({ updatePhase: "downloading" });
    const cacheName = assetCacheName(displayKey, remote.fingerprint);
    const imageUrls = collectImageUrls(remote);
    let cache: Cache;
    try {
      cache = await caches.open(cacheName);
      // Cache.addAll is spec-atomic: one failed URL fails the whole call
      // and leaves this cache bucket empty. That's what makes "don't
      // activate a broken update" a guarantee rather than a hope. If
      // there are no images at all yet (fresh Dropbox folder), addAll([])
      // trivially succeeds — an empty-but-valid state.
      await cache.addAll(imageUrls);
    } catch (error) {
      await caches.delete(cacheName).catch(() => {});
      handleFailure("downloading", error);
      return;
    }

    // --- Verify: confirm every asset is really there before activating ---
    setState({ updatePhase: "verifying" });
    for (const url of imageUrls) {
      const match = await cache.match(url);
      if (!match) {
        await caches.delete(cacheName).catch(() => {});
        handleFailure("verifying", new Error(`Missing cached asset: ${url}`));
        return;
      }
    }

    // --- Activate: the only step that ever writes the active pointer ---
    setState({ updatePhase: "activating" });
    const cachedAt = new Date().toISOString();
    const { evict } = await activateContent(displayKey, remote, cachedAt);
    await Promise.all(evict.map((fingerprint) => caches.delete(assetCacheName(displayKey, fingerprint))));

    setState({
      updatePhase: "idle",
      activeContent: remote,
      activeFingerprint: remote.fingerprint,
      previousFingerprint: currentFingerprint,
      lastSuccessfulUpdateAt: cachedAt,
      lastError: null,
    });
  }

  function scheduleNextCheck() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      await checkNow();
      scheduleNextCheck();
    }, CHECK_INTERVAL_MS);
  }

  function handleOnline() {
    setState({ connectivity: "online" });
    void checkNow();
  }

  function handleOffline() {
    setState({ connectivity: "offline" });
  }

  function init() {
    if (initialized) return;
    initialized = true;

    void (async () => {
      const [meta, activeContent] = await Promise.all([readMeta(displayKey), readActiveContent(displayKey)]);
      setState({
        activeContent: activeContent ?? null,
        activeFingerprint: meta?.activeFingerprint ?? null,
        previousFingerprint: meta?.previousFingerprint ?? null,
        lastCheckedAt: meta?.lastCheckedAt ?? null,
        lastSuccessfulUpdateAt: meta?.lastSuccessfulUpdateAt ?? null,
        connectivity: navigator.onLine ? "online" : "offline",
        hasLoadedFromCache: true,
      });

      void checkNow();
      scheduleNextCheck();
    })();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return state;
    },
    init,
    checkNow,
  };
}

const managers = new Map<string, SyncManager>();

/** One manager per store/screen, shared across every mount (React StrictMode included). */
export function getSyncManager(storeId: string, screenId: string): SyncManager {
  const displayKey = displayKeyFor(storeId, screenId);
  let manager = managers.get(displayKey);
  if (!manager) {
    manager = createSyncManager(storeId, screenId);
    managers.set(displayKey, manager);
  }
  return manager;
}
