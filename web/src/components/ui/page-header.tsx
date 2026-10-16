import * as React from "react";

import { cn } from "@/src/lib/utils";

/**
 * A page's Display title (L 48 for full pages, M 32 for workspace tools), its
 * description, and the page's one primary action on the right.
 */
function PageHeader({
  title,
  description,
  actions,
  size = "m",
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  size?: "l" | "m";
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0">
        <h1 className={size === "l" ? "display-l" : "display-m"}>{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm leading-relaxed text-silver-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </header>
  );
}

export { PageHeader };
