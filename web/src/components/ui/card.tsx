import * as React from "react";

import { cn } from "@/src/lib/utils";

/**
 * Hairlines, not nested boxes (boards/Surfaces.dc.html §03). A card is one
 * surface; groups inside it are `CardRow`s split by 1px lines. The only box
 * allowed inside a card is an `InsetWell` for code, logs and previews.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card" className={cn("rounded-lg border border-line bg-space-surface", className)} {...props} />;
}

/** Title (Geist 600 15, never display), description and one action. */
function CardHeader({
  title,
  description,
  action,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div data-slot="card-header" className={cn("flex items-start justify-between gap-4 px-5.5 pt-5 pb-4", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] leading-snug font-semibold text-silver-900">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] leading-normal text-silver-500">{description}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-5.5 pb-5", className)} {...props} />;
}

/** One group in a card: label and detail on the left, an action on the right. */
function CardRow({
  label,
  detail,
  action,
  className,
  children,
}: {
  label?: React.ReactNode;
  detail?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="card-row"
      className={cn("mx-5.5 flex items-center justify-between gap-4 border-t border-line py-4 first:border-t-0", className)}
    >
      <div className="min-w-0">
        {label && <div className="text-[13.5px] font-medium text-silver-900">{label}</div>}
        {detail && <div className="text-[12.5px] leading-normal text-silver-500">{detail}</div>}
        {children}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** The one nested box: void fill, mono, for logs, code and previews. */
function InsetWell({
  caption,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { caption?: React.ReactNode }) {
  return (
    <div>
      <div
        data-slot="inset-well"
        className={cn(
          "rounded-md border border-line bg-space-void px-4 py-3.5 font-mono text-[12.5px] leading-[1.7] text-silver-600",
          className,
        )}
        {...props}
      >
        {children}
      </div>
      {caption && <p className="mt-2 text-xs text-silver-500">{caption}</p>}
    </div>
  );
}

/** "Deployed 1d ago · Version fa300053 · 23 files · 1.0 MB" */
function MetaLine({ items, className }: { items: React.ReactNode[]; className?: string }) {
  const shown = items.filter((item) => item !== null && item !== undefined && item !== false && item !== "");
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-xs text-silver-500", className)}>
      {shown.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span aria-hidden="true" className="size-[3px] rounded-full bg-current" />}
          <span>{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

/** Display numbers belong on stat tiles: eyebrow, badge, big number, unit. */
function StatTile({
  label,
  badge,
  value,
  unit,
  className,
  children,
}: {
  label: React.ReactNode;
  badge?: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{label}</span>
        {badge}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="display-heading text-[72px]">{value}</span>
        {unit && <span className="font-mono text-[13px] text-silver-500">{unit}</span>}
      </div>
      {children}
    </div>
  );
}

export { Card, CardContent, CardHeader, CardRow, InsetWell, MetaLine, StatTile };
