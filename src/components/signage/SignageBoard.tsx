import Image from "next/image";
import type { SectionId, SignageContent } from "@/types/signage";

const SECTION_WIDTH_CLASS: Record<SectionId, string> = {
  main: "w-[1440px]", // 75% of 1920
  weekly: "w-[480px]", // 25% of 1920
};

const SECTION_SIZES: Record<SectionId, string> = {
  main: "1440px",
  weekly: "480px",
};

const SECTION_WAITING_LABEL: Record<SectionId, string> = {
  main: "main menu",
  weekly: "weekly feature",
};

function SectionPanel({ content, id }: { content: SignageContent; id: SectionId }) {
  const section = content.sections.find((candidate) => candidate.id === id);

  return (
    <div className={`relative h-full ${SECTION_WIDTH_CLASS[id]} shrink-0 bg-surface`}>
      {section ? (
        <Image
          src={section.image}
          alt=""
          fill
          sizes={SECTION_SIZES[id]}
          className="object-cover"
          priority={id === "main"}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-8 text-center">
          <p className="text-[14px] text-foreground/40">
            Waiting for the {SECTION_WAITING_LABEL[id]} image in Dropbox…
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The whole screen is just the two designed images, edge to edge — no
 * coded header/logo/text laid over them, since the point of this model is
 * that whoever designs the PNG has full control of what it looks like.
 */
export function SignageBoard({ content }: { content: SignageContent }) {
  return (
    <div className="animate-fade-in flex h-full w-full bg-background">
      <SectionPanel content={content} id="main" />
      <SectionPanel content={content} id="weekly" />
    </div>
  );
}
