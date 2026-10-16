import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircleIcon } from "lucide-react";
import { Slot } from "radix-ui";

import { cn } from "@/src/lib/utils";

/**
 * boards/Controls.dc.html §01. Blue fill means "this is the thing to do":
 * one `primary` per screen. Everything else is `secondary` (overlay fill,
 * strong edge) or `ghost`. `destructive` starts a loss (outline only);
 * `destructive-solid` lives only inside a confirm modal; `upgrade` is the one
 * orange button, for the free plan only.
 *
 * Hover moves one step, pressed steps back, 150ms. Disabled is 40% with no
 * hover; a disabled primary stays blue so the waiting action is still clear.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 border border-transparent font-medium whitespace-nowrap transition-[background-color,border-color,color] duration-150 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40 aria-invalid:border-red-400 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-blue-500 font-semibold text-blue-900 hover:bg-blue-hi active:bg-blue-lo",
        secondary:
          "border-line-strong bg-space-overlay text-silver-900 hover:border-line-hover hover:bg-space-raised active:bg-space-overlay aria-expanded:border-line-hover aria-expanded:bg-space-raised",
        ghost:
          "text-silver-600 hover:bg-space-raised hover:text-silver-900 active:bg-space-overlay aria-expanded:bg-space-raised aria-expanded:text-silver-900",
        destructive:
          "border-red-400/32 text-red-400 hover:bg-red-400/10 active:bg-red-400/5",
        "destructive-solid":
          "bg-red-400 font-semibold text-[#1a0505] hover:bg-[#fb8a8a] active:bg-red-400",
        upgrade:
          "bg-orange-400 font-semibold text-orange-ink hover:bg-orange-hi active:bg-orange-400",
        link: "h-auto border-0 p-0 text-blue-500 underline-offset-3 hover:text-blue-hi hover:underline",
        /** @deprecated Use `primary`. */
        default:
          "bg-blue-500 font-semibold text-blue-900 hover:bg-blue-hi active:bg-blue-lo",
        /** @deprecated Use `secondary`. */
        outline:
          "border-line-strong bg-space-overlay text-silver-900 hover:border-line-hover hover:bg-space-raised active:bg-space-overlay aria-expanded:border-line-hover aria-expanded:bg-space-raised",
      },
      size: {
        default: "h-9 rounded-md px-3.5 text-[13px]",
        sm: "h-7 gap-1.5 rounded-sm px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 rounded-lg px-5 text-sm",
        icon: "size-8 rounded-sm",
        "icon-sm": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        /** @deprecated Nothing goes under 28px; same as `sm`. */
        xs: "h-7 gap-1.5 rounded-sm px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        /** @deprecated Same as `icon-sm`. */
        "icon-xs": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        /** @deprecated Same as `icon`. */
        "icon-lg": "size-8 rounded-sm",
      },
    },
    compoundVariants: [
      { variant: "link", className: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner before the label and disables the button. */
    loading?: boolean;
  };

function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && !asChild ? (
        <>
          <LoaderCircleIcon
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
