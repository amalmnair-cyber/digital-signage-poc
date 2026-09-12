let simulateOffline = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function isSimulatedOffline(): boolean {
  return simulateOffline;
}

export function setSimulatedOffline(value: boolean): void {
  simulateOffline = value;
  notify();
}

export function subscribeSimulatedOffline(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Escape hatch for local iteration: a hand-written Service Worker that's
 * stuck serving a stale cached chunk is the most common hand-rolled-SW
 * papercut. This clears everything so the next reload starts fresh.
 */
export async function unregisterServiceWorkerAndClearCaches(): Promise<void> {
  if (typeof window === "undefined") return;

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}
