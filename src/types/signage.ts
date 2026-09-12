/** The two image slots every screen is composed of, in layout order. */
export const SECTION_IDS = ["main", "weekly"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface SignageSection {
  id: SectionId;
  /** Same-origin URL the browser fetches/caches — never a raw Dropbox URL or token. */
  image: string;
  /** Dropbox's own last-modified time for this file, for the debug overlay only. */
  sourceModifiedAt: string | null;
}

/**
 * What the mock^H^H^H real remote (the Dropbox-backed API route) returns for
 * one store/screen. There's no meaningful "version number" for a folder of
 * images the way there was for hand-authored JSON fixtures, so instead of
 * an increasing integer, `fingerprint` is an opaque string built from
 * Dropbox's own per-file content hashes — the sync engine just checks
 * "does this differ from what I already have," not "is this newer."
 */
export interface SignageContent {
  schemaVersion: 1;
  storeId: string;
  screenId: string;
  generatedAt: string;
  fingerprint: string;
  sections: SignageSection[];
}

export function displayKeyFor(storeId: string, screenId: string): string {
  return `${storeId}/${screenId}`;
}

export function collectImageUrls(content: SignageContent): string[] {
  return content.sections.map((section) => section.image);
}

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;

/** Route params land straight in a Dropbox path string — validate first. */
export function isSafePathSegment(value: string): boolean {
  return SAFE_SEGMENT.test(value);
}
