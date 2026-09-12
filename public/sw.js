// Hand-written on purpose (no next-pwa/Serwist) so every caching decision
// here is visible and easy to reason about. This file is served as-is from
// /sw.js — it is never bundled/transpiled, so it must stay plain ES that
// every target browser (including whatever ships on the eventual
// Raspberry Pi's Chromium) understands.
//
// Responsibilities, and only these:
//   1. Precache a small app shell so full page loads/reloads/restarts
//      still render when there is no network at all.
//   2. Serve already-cached section images cache-first at fetch time.
// It does NOT do any content downloading, verifying, or fingerprint
// bookkeeping — that all happens in the page itself (src/lib/signage),
// which can call caches.* directly without going through this worker.

const SHELL_CACHE = "signage-shell-v1";
const SHELL_URLS = ["/", "/display/store1/screen1", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {
        // Precaching is best-effort at install time (e.g. first install
        // while briefly offline) — the fetch handler's cache-then-network
        // fallback below still fills the shell in as pages are visited.
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("signage-shell-") && name !== SHELL_CACHE)
            // Never touch "signage-assets__*" buckets here — those belong
            // to the sync engine's own fingerprint-based eviction logic.
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // The Dropbox-backed content API must always be a real network hit —
  // never cached (it's what tells us whether anything changed).
  if (url.pathname.startsWith("/api/")) return;

  // Full page loads / reloads / browser restarts: try the network first
  // (so users normally see live content), fall back to the cached shell
  // when there's no network at all. This is the one behaviour that
  // specifically makes offline reload/restart work.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () => caches.match(request).then((cached) => cached || caches.match("/"))
      )
    );
    return;
  }

  // Hashed Next.js build output: cache-first, populate on first fetch.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Section images (proxied from Dropbox via /signage-assets/...):
  // cache-first against whichever fingerprint bucket the sync engine has
  // already populated for this asset.
  if (url.pathname.startsWith("/signage-assets/")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
