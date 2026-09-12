import { NextResponse } from "next/server";
import { isDropboxConfigured, listSectionFiles } from "@/lib/dropbox/client";
import { buildDemoContent } from "@/lib/signage/demoContent";
import { SECTION_IDS, isSafePathSegment, type SignageContent, type SignageSection } from "@/types/signage";

// The whole point is checking Dropbox for changes — this must never be
// treated as static/build-time-cacheable.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/signage/[store]/[screen]">
) {
  const { store, screen } = await params;

  if (!isSafePathSegment(store) || !isSafePathSegment(screen)) {
    return NextResponse.json({ error: "Invalid store/screen" }, { status: 400 });
  }

  // No credentials configured (e.g. the public demo deployment): serve the
  // bundled demo board rather than a 502 the visitor can do nothing about.
  if (!isDropboxConfigured()) {
    return NextResponse.json(buildDemoContent(store, screen));
  }

  let files;
  try {
    files = await listSectionFiles(store, screen);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const sections: SignageSection[] = [];
  const fingerprintParts: string[] = [];

  for (const sectionId of SECTION_IDS) {
    const file = files.get(sectionId);
    fingerprintParts.push(`${sectionId}:${file?.contentHash ?? "none"}`);
    if (!file) continue;
    sections.push({
      id: sectionId,
      // The content hash is a cache-buster, not something the asset route
      // reads: without it, every version of this section shares the exact
      // same URL, so a Service Worker cache bucket from an older fetch can
      // still hold a Response for that URL and get served instead of the
      // newer one — a plain caches.match() searches across all buckets by
      // URL, it doesn't know one is "newer." Baking the hash in means a
      // changed file is a genuinely different URL, so there's nothing
      // stale left to accidentally match.
      image: `/signage-assets/${store}/${screen}/${sectionId}?h=${file.contentHash ?? "none"}`,
      sourceModifiedAt: file.serverModified,
    });
  }

  const content: SignageContent = {
    schemaVersion: 1,
    storeId: store,
    screenId: screen,
    generatedAt: new Date().toISOString(),
    fingerprint: fingerprintParts.join("|"),
    sections,
  };

  return NextResponse.json(content);
}
