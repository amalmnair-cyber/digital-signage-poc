"use client";

import { useEffect, useRef } from "react";

/**
 * Renders children on a fixed 1920x1080 "design surface" and scales +
 * centers the whole thing to fit whatever window/TV it's actually shown
 * on, letterboxing as needed. Every signage component below is built
 * against exact 1920x1080 pixel math instead of responsive breakpoints —
 * the standard approach for kiosk/TV displays.
 *
 * The scale and the centering offset are combined into one `translate()
 * scale()` transform computed in JS, rather than scaling in CSS and
 * centering with flexbox: `transform` never changes an element's layout
 * size, only how it paints, so a flex container centers a scaled box
 * around its *unscaled* dimensions — correct only when the viewport
 * happens to be exactly 16:9, and visibly off-center/clipped otherwise.
 */
export function SignageStage({ children }: { children: React.ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function updateTransform() {
      const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      const left = (window.innerWidth - 1920 * scale) / 2;
      const top = (window.innerHeight - 1080 * scale) / 2;
      stage!.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
    }

    updateTransform();
    window.addEventListener("resize", updateTransform);
    return () => window.removeEventListener("resize", updateTransform);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div ref={stageRef} className="signage-stage">
        {children}
      </div>
    </div>
  );
}
