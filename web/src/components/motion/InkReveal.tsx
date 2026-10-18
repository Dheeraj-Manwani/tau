import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
} from "motion/react";

import { useReduceMotion } from "@/src/hooks/useReduceMotion";
import { cn } from "@/src/lib/utils";

/** How tall the soft edge between written and unwritten text is. */
const FEATHER = 56;
/** How fast the edge travels down the text, in px/s. */
const SPEED = 190;
/** Even a single new line takes this long to develop, so it reads as ink. */
const MIN_SWEEP = 0.35;

const GLOW = "linear-gradient(100deg, #ff375f 0%, #bf5af2 32%, #5e5ce6 64%, #0a84ff 100%)";

/**
 * Text that develops like ink: a feathered edge sweeps down it with an
 * iridescent glow at the write-frontier (useplanes.com "Streaming Message").
 * Planes sweeps a finished string; tau's reply grows as it streams, so each
 * time new text renders the edge sweeps down to it and the glow fades out as
 * soon as it lands: nothing waits on the next chunk, a tool call or the end
 * of the run. The reveal retires once the reply is whole and fully developed.
 *
 * Only a block that mounts live reveals. Anything already written when it
 * mounts (history, a reload) renders at once, as does reduced motion.
 */
export function InkReveal({
  live,
  className,
  children,
}: {
  live: boolean;
  className?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  const [revealing, setRevealing] = useState(live);
  const active = revealing && !reduceMotion;
  const ref = useRef<HTMLDivElement>(null);
  const run = useRef<AnimationPlaybackControls | null>(null);
  const fade = useRef<AnimationPlaybackControls | null>(null);

  const edge = useMotionValue(0);
  const glowOpacity = useMotionValue(0);
  const solid = useTransform(edge, (y) => y - FEATHER);
  const mask = useMotionTemplate`linear-gradient(to bottom, #000 ${solid}px, rgba(0,0,0,0) ${edge}px)`;
  const glowStart = useTransform(edge, (y) => y - FEATHER * 1.7);
  const glowPeak = useTransform(edge, (y) => y - FEATHER * 0.55);
  const glowEnd = useTransform(edge, (y) => y + FEATHER * 0.35);
  const glowMask = useMotionTemplate`linear-gradient(to bottom, rgba(0,0,0,0) ${glowStart}px, #000 ${glowPeak}px, rgba(0,0,0,0) ${glowEnd}px)`;

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;

    const caughtUp = () => edge.get() >= el.offsetHeight + FEATHER - 0.5;

    // Landed: the glow goes now, and a reply that is done stops revealing.
    const settle = () => {
      fade.current?.stop();
      fade.current = animate(glowOpacity, 0, { duration: 0.3, ease: "easeOut" });
      if (!live) fade.current.finished.then(() => caughtUp() && setRevealing(false)).catch(() => {});
    };

    const advance = () => {
      const target = el.offsetHeight + FEATHER;
      const distance = target - edge.get();
      if (distance <= 0.5) return settle();
      const moving = run.current?.state === "running";
      run.current?.stop();
      fade.current?.stop();
      fade.current = animate(glowOpacity, 1, { duration: 0.2, ease: "easeOut" });
      // From rest it eases in like Planes' sweep; a chunk landing mid-sweep
      // carries on without the slow start, so the edge never stutters.
      run.current = animate(edge, target, {
        duration: Math.min(4.5, Math.max(MIN_SWEEP, distance / SPEED)),
        ease: moving ? [0, 0, 0.15, 1] : [0.25, 0, 0.15, 1],
      });
      // A stopped run settles too; only one that reaches the text lands.
      run.current.finished.then(() => caughtUp() && settle()).catch(() => {});
    };

    advance();
    const observer = new ResizeObserver(advance);
    observer.observe(el);
    return () => {
      observer.disconnect();
      run.current?.stop();
      fade.current?.stop();
    };
  }, [active, live, edge, glowOpacity]);

  // Cleared explicitly once written: motion keeps the last mask inline
  // otherwise, and a reply that wraps taller later (a narrower panel) would
  // lose its end.
  const textMask = active ? mask : "none";

  return (
    <div className={cn("relative", className)}>
      <motion.div ref={ref} style={{ maskImage: textMask, WebkitMaskImage: textMask }}>
        {children}
      </motion.div>
      {active && (
        <motion.div
          aria-hidden="true"
          inert
          className="pointer-events-none absolute inset-0 select-none [&_*]:!border-transparent [&_*]:!bg-transparent [&_*]:!text-transparent"
          style={{
            color: "transparent",
            backgroundImage: GLOW,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            maskImage: glowMask,
            WebkitMaskImage: glowMask,
            opacity: glowOpacity,
          }}
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}
