import type * as React from "react";
import { LoaderCircleIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";

const TONE_ICON = {
  neutral: "text-silver-600",
  warning: "text-orange-400",
  error: "text-red-400",
} as const;

/**
 * What the preview shows when there is no app to show: asleep, failed, paused
 * for credits. One calm tier B layout on void: an icon tile (the tone lives in
 * the icon, never in a glow), a Display S title, a line of help, an optional
 * inset well and at most one primary.
 */
export function PreviewStateCard({
  icon: Icon,
  tone = "neutral",
  busy = false,
  title,
  description,
  detail,
  actions,
  coverImageUrl,
  role,
}: {
  /** Without one the tile holds the τ mark: tau's idle face for "nothing to show yet". */
  icon?: LucideIcon;
  tone?: keyof typeof TONE_ICON;
  /** Swaps the icon for a blue spinner while something is already happening. */
  busy?: boolean;
  /** Without a title the card is a quiet status line (mono) under the tile. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Shown in an inset well under the copy, e.g. an error excerpt. */
  detail?: React.ReactNode;
  actions?: React.ReactNode;
  /** The app's last screenshot, dimmed behind the card so it still feels like this project. */
  coverImageUrl?: string | null;
  role?: "alert" | "status";
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-space-void p-6">
      {coverImageUrl && (
        <>
          <img
            src={coverImageUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full scale-110 object-cover object-top opacity-25 blur-md"
          />
          <div className="absolute inset-0 bg-space-void/85" />
        </>
      )}
      <div role={role} className="relative flex w-full max-w-md flex-col items-center gap-4 text-center">
        <span className="grid size-11 place-items-center rounded-lg border border-line-strong bg-space-surface">
          {busy ? (
            <LoaderCircleIcon aria-hidden className="size-5 animate-spin text-blue-500 motion-reduce:animate-none" />
          ) : Icon ? (
            <Icon aria-hidden className={cn("size-5", TONE_ICON[tone])} />
          ) : (
            <span aria-hidden className="logo-mark size-5 [filter:none]" />
          )}
        </span>
        {title ? (
          <div className="flex flex-col gap-2">
            <h2 className="display-heading display-s text-silver-900">{title}</h2>
            {description && (
              <p className="mx-auto max-w-sm text-[13.5px] leading-[1.6] text-silver-600">{description}</p>
            )}
          </div>
        ) : (
          description && <p className="font-mono text-xs text-silver-500">{description}</p>
        )}
        {detail && (
          <pre className="scrollbar-thin max-h-32 w-full overflow-auto rounded-md border border-line bg-space-surface px-3.5 py-3 text-left font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-silver-600">
            {detail}
          </pre>
        )}
        {actions && <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">{actions}</div>}
      </div>
    </div>
  );
}
