import "server-only";

/**
 * Minimal, dependency-free Dropbox API v2 client — plain fetch calls
 * instead of the official SDK, so there's nothing here to read but the
 * actual two HTTP calls this app needs. Server-only: DROPBOX_ACCESS_TOKEN
 * must never reach the browser bundle.
 */

const SIGNAGE_ROOT = process.env.DROPBOX_SIGNAGE_ROOT ?? "/Website Project trail/Digital Signage";
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg"] as const;

/**
 * Whether a Dropbox token is present at all. Lets callers fall back to the
 * bundled demo board instead of surfacing a 502 to a visitor who was never
 * going to have this deployment's credentials.
 */
export function isDropboxConfigured(): boolean {
  return Boolean(process.env.DROPBOX_ACCESS_TOKEN);
}

function getAccessToken(): string {
  const token = process.env.DROPBOX_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "DROPBOX_ACCESS_TOKEN is not set. Add it to .env.local (see README for how to generate one)."
    );
  }
  return token;
}

function folderPath(storeId: string, screenId: string): string {
  return `${SIGNAGE_ROOT}/${storeId}/${screenId}`;
}

interface DropboxFileEntry {
  ".tag": string;
  name: string;
  path_lower: string;
  content_hash?: string;
  server_modified?: string;
}

async function dropboxApiCall<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Dropbox API request failed (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Files matching `<baseName>.<png|jpg|jpeg>` (case-insensitive) in the
 * store/screen folder, keyed by base name. A signage folder only ever
 * holds a couple of images, so this deliberately doesn't handle
 * list_folder pagination (`has_more`) — there's nothing to paginate.
 */
export async function listSectionFiles(
  storeId: string,
  screenId: string
): Promise<Map<string, { path: string; contentHash: string | null; serverModified: string | null }>> {
  const result = new Map<string, { path: string; contentHash: string | null; serverModified: string | null }>();

  let entries: DropboxFileEntry[];
  try {
    const data = await dropboxApiCall<{ entries: DropboxFileEntry[] }>(
      "https://api.dropboxapi.com/2/files/list_folder",
      { path: folderPath(storeId, screenId) }
    );
    entries = data.entries;
  } catch (error) {
    // A folder that doesn't exist yet (e.g. before the first image is
    // uploaded) is a normal, expected state — treat it as "no files yet"
    // rather than a hard failure.
    if (error instanceof Error && error.message.includes("path/not_found")) {
      return result;
    }
    throw error;
  }

  for (const entry of entries) {
    if (entry[".tag"] !== "file") continue;
    const dotIndex = entry.name.lastIndexOf(".");
    if (dotIndex === -1) continue;
    const baseName = entry.name.slice(0, dotIndex).toLowerCase();
    const extension = entry.name.slice(dotIndex + 1).toLowerCase();
    if (!IMAGE_EXTENSIONS.includes(extension as (typeof IMAGE_EXTENSIONS)[number])) continue;

    result.set(baseName, {
      path: entry.path_lower,
      contentHash: entry.content_hash ?? null,
      serverModified: entry.server_modified ?? null,
    });
  }

  return result;
}

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export async function downloadFile(path: string): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Dropbox download failed (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }

  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
  const bytes = await res.arrayBuffer();
  return { bytes, contentType };
}
