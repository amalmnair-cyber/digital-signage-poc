"use client";

import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import { getSyncManager, type SyncState } from "./syncManager";

/**
 * React bridge for one store/screen's sync manager. Mounting this hook
 * starts the manager (cache-first read, background check, 15-minute
 * timer) exactly once per displayKey, no matter how many components use
 * the hook or how many times effects re-run under StrictMode — `init()`
 * is called from an effect (never during render) and is itself guarded
 * to be a no-op after the first call.
 */
export function useSyncState(storeId: string, screenId: string): SyncState {
  const manager = getSyncManager(storeId, screenId);

  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);

  useEffect(() => {
    manager.init();
  }, [manager]);

  return state;
}

export function useSyncManager(storeId: string, screenId: string) {
  return getSyncManager(storeId, screenId);
}
