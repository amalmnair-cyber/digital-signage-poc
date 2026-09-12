"use client";

import { useEffect } from "react";

/**
 * Registers the hand-written Service Worker (public/sw.js) once, app-wide.
 * This is the piece that makes a fully offline page reload or browser
 * restart possible at all — everything else in src/lib/signage runs as
 * ordinary page JS and talks to Cache Storage/IndexedDB directly.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  }, []);

  return children;
}
