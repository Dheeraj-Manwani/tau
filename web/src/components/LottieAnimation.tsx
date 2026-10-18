import { useEffect, useRef } from "react";

import { useReduceMotion } from "@/src/hooks/useReduceMotion";
import { cn } from "@/src/lib/utils";

/**
 * Plays a Lottie JSON from `public/` (e.g. "/Sleepy-Moon.json"). The light SVG
 * player is loaded on first use so it stays out of the main bundle. Every
 * fill is painted `currentColor`, so the file's own palette doesn't matter:
 * set the colour with a `text-*` class. Under reduce motion it holds frame 0.
 */
export function LottieAnimation({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;

    void import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (cancelled) return;
      const anim = lottie.loadAnimation({
        container,
        renderer: "svg",
        loop: !reduceMotion,
        autoplay: !reduceMotion,
        path: `${import.meta.env.BASE_URL}${src.replace(/^\//, "")}`,
      });
      destroy = () => anim.destroy();
    });

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [src, reduceMotion]);

  return <span ref={ref} aria-hidden className={cn("block [&_path]:fill-current", className)} />;
}
