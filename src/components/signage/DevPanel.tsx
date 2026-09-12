"use client";

import { useState } from "react";
import { useSyncManager } from "@/lib/signage/store";
import {
  isSimulatedOffline,
  setSimulatedOffline,
  unregisterServiceWorkerAndClearCaches,
} from "@/lib/signage/devControls";

export function DevPanel({ storeId, screenId }: { storeId: string; screenId: string }) {
  const manager = useSyncManager(storeId, screenId);
  const [offline, setOffline] = useState(() => isSimulatedOffline());
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function toggleOffline() {
    const next = !offline;
    setSimulatedOffline(next);
    setOffline(next);
    if (!next) void manager.checkNow();
  }

  function handleCheckNow() {
    setBusy("check");
    setActionError(null);
    void manager
      .checkNow()
      .catch((error: unknown) => {
        setActionError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setBusy(null));
  }

  function handleClearAll() {
    setBusy("clear");
    void unregisterServiceWorkerAndClearCaches()
      .then(() => window.location.reload())
      .catch((error: unknown) => {
        setActionError(error instanceof Error ? error.message : String(error));
        setBusy(null);
      });
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 w-[300px] rounded-lg border border-white/10 bg-black/85 p-3 font-mono text-[11px] text-white/90 shadow-lg backdrop-blur">
      <p className="mb-2 font-bold tracking-wide text-white/70">DEV PANEL</p>

      {actionError && (
        <p className="mb-2 truncate rounded bg-red-500/20 px-2 py-1 text-red-300" title={actionError}>
          {actionError}
        </p>
      )}

      <p className="mb-2 text-white/50">
        Replace <code>main.png</code> / <code>weekly.png</code> in the Dropbox folder, then Check now
        (or wait up to 15 min).
      </p>

      <div className="flex items-center justify-between rounded bg-white/5 px-2 py-1.5">
        <span>Simulate offline</span>
        <button
          type="button"
          onClick={toggleOffline}
          className={`rounded-full px-3 py-0.5 text-[10px] font-bold ${
            offline ? "bg-red-500 text-white" : "bg-emerald-500 text-black"
          }`}
        >
          {offline ? "OFFLINE" : "ONLINE"}
        </button>
      </div>

      <button
        type="button"
        onClick={handleCheckNow}
        disabled={busy !== null}
        className="mt-2 block w-full rounded bg-brand-red/80 px-2 py-1.5 text-center font-semibold hover:bg-brand-red disabled:opacity-50"
      >
        {busy === "check" ? "Checking…" : "Check now"}
      </button>

      <button
        type="button"
        onClick={handleClearAll}
        disabled={busy !== null}
        className="mt-2 block w-full rounded border border-white/20 px-2 py-1.5 text-center text-white/60 hover:bg-white/10 disabled:opacity-50"
      >
        {busy === "clear" ? "Clearing…" : "Unregister SW & clear caches"}
      </button>
    </div>
  );
}
