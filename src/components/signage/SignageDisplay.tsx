"use client";

import { useSyncState } from "@/lib/signage/store";
import { SignageStage } from "./SignageStage";
import { SignageBoard } from "./SignageBoard";
import { LoadingScreen } from "./LoadingScreen";
import { DebugOverlay } from "./DebugOverlay";
import { DevPanel } from "./DevPanel";

/**
 * All real content rendering happens here, client-side, sourced from
 * IndexedDB via useSyncState — deliberately never from server-rendered
 * props. If this page depended on a server round-trip for its content,
 * a fully offline reload would break by construction.
 */
export function SignageDisplay({
  storeId,
  screenId,
  showDebug,
}: {
  storeId: string;
  screenId: string;
  showDebug: boolean;
}) {
  const state = useSyncState(storeId, screenId);

  return (
    <div className="fixed inset-0 bg-black">
      <SignageStage>
        {state.activeContent ? (
          <SignageBoard content={state.activeContent} />
        ) : (
          <LoadingScreen isOffline={state.connectivity === "offline"} />
        )}
      </SignageStage>

      {showDebug && (
        <>
          <DebugOverlay state={state} storeId={storeId} screenId={screenId} />
          <DevPanel storeId={storeId} screenId={screenId} />
        </>
      )}
    </div>
  );
}
