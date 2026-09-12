import { SECTION_IDS, type SignageContent } from "@/types/signage";

export function validateContent(value: unknown): value is SignageContent {
  return typeof describeInvalidContent(value) === "undefined";
}

export function describeInvalidContent(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return "not an object";
  const c = value as Record<string, unknown>;

  if (c.schemaVersion !== 1) return "schemaVersion must be 1";
  if (typeof c.storeId !== "string") return "storeId must be a string";
  if (typeof c.screenId !== "string") return "screenId must be a string";
  if (typeof c.generatedAt !== "string") return "generatedAt must be a string";
  if (typeof c.fingerprint !== "string" || c.fingerprint.length === 0) {
    return "fingerprint must be a non-empty string";
  }

  if (!Array.isArray(c.sections)) return "sections must be an array";
  for (const [i, section] of c.sections.entries()) {
    const reason = describeInvalidSection(section);
    if (reason) return `sections[${i}]: ${reason}`;
  }

  return undefined;
}

function describeInvalidSection(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return "not an object";
  const s = value as Record<string, unknown>;
  if (typeof s.id !== "string" || !(SECTION_IDS as readonly string[]).includes(s.id)) {
    return `id must be one of: ${SECTION_IDS.join(", ")}`;
  }
  if (typeof s.image !== "string" || !s.image.startsWith("/")) {
    return "image must be a root-relative path string";
  }
  if (s.sourceModifiedAt !== null && typeof s.sourceModifiedAt !== "string") {
    return "sourceModifiedAt must be a string or null";
  }
  return undefined;
}
