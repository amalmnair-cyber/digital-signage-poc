import { BrandLogo } from "./BrandLogo";

export function LoadingScreen({ isOffline }: { isOffline: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background text-foreground">
      <BrandLogo className="text-[48px]" />
      <p className="text-[16px] text-foreground/60">
        {isOffline
          ? "Waiting for a connection to load content for the first time…"
          : "Loading…"}
      </p>
    </div>
  );
}
