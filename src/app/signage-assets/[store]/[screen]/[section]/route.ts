import { downloadFile, listSectionFiles } from "@/lib/dropbox/client";
import { SECTION_IDS, isSafePathSegment, type SectionId } from "@/types/signage";

// Streams real image bytes from Dropbox on every request — never
// build-time-cacheable. Deliberately outside /api/ so the Service
// Worker's fetch handler treats it like any other cacheable asset
// (see public/sw.js) instead of its "always bypass /api/" rule.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/signage-assets/[store]/[screen]/[section]">
) {
  const { store, screen, section } = await params;

  if (!isSafePathSegment(store) || !isSafePathSegment(screen)) {
    return new Response("Invalid store/screen", { status: 400 });
  }
  if (!SECTION_IDS.includes(section as SectionId)) {
    return new Response("Unknown section", { status: 404 });
  }

  const files = await listSectionFiles(store, screen);
  const file = files.get(section);
  if (!file) {
    return new Response("No image uploaded for this section yet", { status: 404 });
  }

  const { bytes, contentType } = await downloadFile(file.path);

  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
