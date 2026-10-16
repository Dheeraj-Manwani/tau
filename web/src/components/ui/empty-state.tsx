import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";

/**
 * Empty states (boards/Surfaces.dc.html §01). Without a title it is the
 * simple one-liner ("No domains connected yet."); with a title it gets an
 * icon tile, a line of help and at most one action.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  if (!title)
    return (
      <div className={cn("rounded-lg border border-dashed border-line-strong p-7 text-center text-[13px] text-silver-600", className)}>
        {description}
      </div>
    );
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2.5 rounded-lg border border-dashed border-line-strong p-8 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="grid size-10 place-items-center rounded-md border border-line-strong bg-space-surface text-silver-600">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      )}
      <p className="text-sm font-semibold text-silver-900">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-silver-500">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export { EmptyState };
