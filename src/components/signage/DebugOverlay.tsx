import type { SyncState } from "@/lib/signage/syncManager";

const PHASE_LABEL: Record<SyncState["updatePhase"], string | null> = {
  idle: null,
  checking: "Checking…",
  downloading: "Downloading…",
  verifying: "Verifying…",
  activating: "Activating…",
  failed: "Update failed",
};

function formatTime(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function shortFingerprint(fingerprint: string | null): string {
  if (!fingerprint) return "—";
  return fingerprint.length > 22 ? `${fingerprint.slice(0, 22)}…` : fingerprint;
}

/**
 * Deliberately a single small pill, not a status panel — this only ever
 * shows on top of the Mac browser while NEXT_PUBLIC_SHOW_DEBUG is on
 * during testing. The full breakdown (active/previous fingerprint, last
 * checked/updated, Dropbox path, error detail) is still there, just in
 * the native title tooltip on hover instead of always taking up space.
 */
export function DebugOverlay({
  state,
  storeId,
  screenId,
}: {
  state: SyncState;
  storeId: string;
  screenId: string;
}) {
  const phaseLabel = PHASE_LABEL[state.updatePhase];
  const isBusy = state.updatePhase !== "idle" && state.updatePhase !== "failed";
  const statusText =
    phaseLabel ?? (state.connectivity === "online" ? "Synced" : "Offline");

  const tooltip = [
    state.connectivity === "online" ? "ONLINE" : "OFFLINE",
    `Active: ${shortFingerprint(state.activeFingerprint)}`,
    `Previous: ${shortFingerprint(state.previousFingerprint)}`,
    `Last checked: ${formatTime(state.lastCheckedAt)}`,
    `Last update: ${formatTime(state.lastSuccessfulUpdateAt)}`,
    `Dropbox: .../Digital Signage/${storeId}/${screenId}/`,
    state.lastError ? `Error: ${state.lastError.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      title={tooltip}
      className="fixed left-3 top-3 z-50 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 font-mono text-[10px] text-white/80 backdrop-blur"
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          state.updatePhase === "failed"
            ? "bg-red-400"
            : state.connectivity === "online"
              ? "bg-emerald-400"
              : "bg-red-400"
        } ${isBusy ? "animate-pulse" : ""}`}
      />
      <span>{statusText}</span>
    </div>
  );
}
