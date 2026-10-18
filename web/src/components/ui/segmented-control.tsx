import * as React from "react";
import { motion, useMotionValue, useSpring, useTransform, useVelocity } from "motion/react";

import { useReduceMotion } from "@/src/hooks/useReduceMotion";
import { cn } from "@/src/lib/utils";

export interface SegmentedControlOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

const PILL_SPRING = { stiffness: 380, damping: 24, mass: 0.6 } as const;
const WIDTH_SPRING = { stiffness: 400, damping: 28, mass: 0.5 } as const;
const LABEL_SPRING = { type: "spring", stiffness: 400, damping: 28, mass: 0.5 } as const;
const PRESS_SPRING = { stiffness: 600, damping: 22, mass: 0.4 } as const;
const ICON_INACTIVE_TRANSITION = { duration: 0.2, ease: "easeOut" } as const;

const PILL_CLASS = "rounded-full border border-white/20 bg-white/[0.16] shadow-[0_1px_3px_rgba(0,0,0,0.4)]";

/**
 * A pill tab switch from useplanes.com "Segmented Control": a glass pill that
 * springs to the chosen tab, stretching and blurring with its own speed, the
 * separators beside it folding away, and the new tab's icon giving a small hop.
 * Sized for the project bar's 32px row (Preview / Code / Tools).
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  ...props
}: {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<React.ComponentProps<"div">, "onChange">) {
  const reduceMotion = useReduceMotion();
  const tablistId = React.useId();
  const buttonRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Safari drops frames animating `filter`, so it gets the pill without blur.
  const [isSafari] = React.useState(() => /^((?!chrome|android).)*safari/i.test(navigator.userAgent));

  const activeIndex = Math.max(
    options.findIndex((o) => o.value === value),
    0,
  );

  const rawX = useMotionValue(0);
  const rawW = useMotionValue(0);
  const springX = useSpring(rawX, PILL_SPRING);
  const springW = useSpring(rawW, WIDTH_SPRING);
  const velX = useVelocity(springX);
  // The faster the pill travels, the longer and softer it gets.
  const stretch = useTransform(velX, (v) => Math.min(Math.abs(v) * 0.04, 12));
  const pillW = useTransform([springW, stretch], ([w, s]: number[]) => w + s);
  const pillX = useTransform([springX, stretch], ([x, s]: number[]) => Math.max(0, x - s / 2));
  const pillBlur = useTransform(velX, (v) => `blur(${Math.min(Math.abs(v) * 0.011, 5)}px)`);

  const [layout, setLayout] = React.useState<{ ready: boolean; separators: number[] }>({
    ready: false,
    separators: [],
  });
  const isFirst = React.useRef(true);

  const measure = React.useCallback(() => {
    const btn = buttonRefs.current[activeIndex];
    if (!btn || !containerRef.current) return;
    // The first placement (and any after a resize) jumps; a new choice springs.
    if (isFirst.current) {
      rawX.jump(btn.offsetLeft);
      rawW.jump(btn.offsetWidth);
      isFirst.current = false;
    } else {
      rawX.set(btn.offsetLeft);
      rawW.set(btn.offsetWidth);
    }
    const separators: number[] = [];
    for (let i = 0; i < options.length - 1; i++) {
      const b = buttonRefs.current[i];
      if (b) separators.push(b.offsetLeft + b.offsetWidth);
    }
    setLayout({ ready: true, separators });
  }, [activeIndex, options.length, rawX, rawW]);

  const optionsKey = options.map((o) => `${o.value}:${o.label}`).join("|");
  React.useLayoutEffect(() => {
    measure();
  }, [measure, optionsKey]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      isFirst.current = true;
      measure();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const select = (i: number) => {
    const option = options[i];
    if (!option) return;
    onChange(option.value);
    buttonRefs.current[i]?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    if (e.key === "Home") return select(0);
    if (e.key === "End") return select(options.length - 1);
    select((index + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length);
  };

  if (!options.length) return null;

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "relative isolate inline-flex w-fit shrink-0 items-center rounded-full border border-white/20 bg-white/[0.05] p-[3px] select-none",
        className,
      )}
      {...props}
    >
      {layout.ready &&
        (reduceMotion ? (
          <span
            aria-hidden="true"
            className={cn("pointer-events-none absolute top-[3px] bottom-[3px]", PILL_CLASS)}
            style={{ left: rawX.get(), width: rawW.get() }}
          />
        ) : (
          <motion.span
            aria-hidden="true"
            className={cn("pointer-events-none absolute top-[3px] bottom-[3px] left-0", PILL_CLASS)}
            style={{ x: pillX, width: pillW, filter: isSafari ? undefined : pillBlur }}
          />
        ))}

      {layout.separators.map((x, i) => {
        const besideActive = i === activeIndex - 1 || i === activeIndex;
        return (
          <motion.span
            key={i}
            aria-hidden="true"
            animate={{ opacity: besideActive ? 0 : 1, scaleY: besideActive ? 0.3 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="pointer-events-none absolute top-[20%] bottom-[20%] w-px origin-center bg-white/10"
            style={{ left: x }}
          />
        );
      })}

      {options.map((option, index) => (
        <SegmentedControlTab
          key={option.value}
          ref={(node) => {
            buttonRefs.current[index] = node;
          }}
          option={option}
          active={index === activeIndex}
          tablistId={tablistId}
          reduceMotion={!!reduceMotion}
          disableBlur={isSafari}
          onClick={() => onChange(option.value)}
          onKeyDown={(e) => onKeyDown(e, index)}
        />
      ))}
    </div>
  );
}

function SegmentedControlTab({
  ref,
  option,
  active,
  tablistId,
  reduceMotion,
  disableBlur,
  onClick,
  onKeyDown,
}: {
  ref: React.Ref<HTMLButtonElement>;
  option: SegmentedControlOption;
  active: boolean;
  tablistId: string;
  reduceMotion: boolean;
  disableBlur: boolean;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const press = useMotionValue(1);
  const pressScale = useSpring(press, PRESS_SPRING);
  const down = () => !reduceMotion && press.set(0.93);
  const up = () => !reduceMotion && press.set(1);

  return (
    <motion.button
      ref={ref}
      type="button"
      role="tab"
      id={`${tablistId}-${option.value}`}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      style={{ scale: pressScale }}
      className="relative z-10 inline-flex h-6 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border-none bg-transparent px-3 text-[13px] leading-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      <motion.span
        animate={{ opacity: active ? 1 : 0.55, scale: active ? 1 : 0.975 }}
        transition={reduceMotion ? { duration: 0 } : LABEL_SPRING}
        className="inline-flex min-w-0 items-center gap-1.5"
      >
        {option.icon && (
          <motion.span
            initial={false}
            animate={
              reduceMotion
                ? { opacity: active ? 1 : 0.7, y: 0, scale: 1 }
                : active
                  ? {
                      opacity: [0.86, 1, 1],
                      y: [0, -1.5, 0],
                      scale: [1, 1.035, 1],
                      ...(disableBlur ? {} : { filter: ["blur(1.5px)", "blur(0px)", "blur(0px)"] }),
                    }
                  : { opacity: 0.7, y: 0, scale: 1, ...(disableBlur ? {} : { filter: "blur(0px)" }) }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : active
                  ? {
                      y: { duration: 0.36, times: [0, 0.42, 1], ease: "easeOut" },
                      scale: { duration: 0.36, times: [0, 0.42, 1], ease: "easeOut" },
                      opacity: { duration: 0.2, ease: "easeOut" },
                      filter: { duration: 0.22, ease: "easeOut" },
                    }
                  : ICON_INACTIVE_TRANSITION
            }
            className="inline-flex size-3.5 shrink-0 items-center justify-center will-change-transform [&_svg]:size-3.5"
          >
            {option.icon}
          </motion.span>
        )}
        <span
          className={cn(
            "truncate",
            active ? "font-semibold text-silver-900" : "font-medium text-silver-900/70",
          )}
        >
          {option.label}
        </span>
      </motion.span>
    </motion.button>
  );
}
