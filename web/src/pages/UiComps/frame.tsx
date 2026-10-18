import { useContext, type ReactNode } from "react";

import { cn } from "@/src/lib/utils";

import { FilterContext, SectionContext, slug } from "./context";

/** One screen (or primitive group); its id is the `#hash` it is linked by. */
export function Section({
  id,
  title,
  eyebrow,
  description,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SectionContext.Provider value={{ id, title }}>
      <section id={id} className="flex scroll-mt-24 flex-col gap-6">
        <div>
          <p className="eyebrow">// {eyebrow ?? id}</p>
          <h2 className="display-heading mt-2 text-[40px] text-silver-900">{title}</h2>
          {description && <p className="mt-2 max-w-2xl text-[13px] text-silver-600">{description}</p>}
        </div>
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">{children}</div>
      </section>
    </SectionContext.Provider>
  );
}

/** One state, labelled. `#<section>/<label-slug>` scrolls to and rings it. */
export function Spec({
  label,
  children,
  wide,
  note,
  className,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  /** What drives this state, e.g. the input the state function was given. */
  note?: ReactNode;
  className?: string;
}) {
  const filter = useContext(FilterContext).trim().toLowerCase();
  const section = useContext(SectionContext);
  if (filter && !`${section.title} ${label}`.toLowerCase().includes(filter)) return null;
  return (
    <div
      id={section.id ? `${section.id}/${slug(label)}` : undefined}
      className={cn(
        "flex min-w-0 scroll-mt-24 flex-col gap-4 rounded-lg border border-line bg-space-surface p-5.5 target:ring-2 target:ring-blue-500 data-[target=true]:ring-2 data-[target=true]:ring-blue-500",
        wide && "col-span-full",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="lab">{label}</p>
        {section.id && (
          <a href={`#${section.id}/${slug(label)}`} className="font-mono text-[11px] text-silver-500 hover:text-silver-900">
            #
          </a>
        )}
      </div>
      {children}
      {note && <p className="font-mono text-[11px] leading-relaxed break-words text-silver-500">{note}</p>}
    </div>
  );
}

export const Row = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-center gap-3">{children}</div>;

/** A fixed-height box for things that fill their parent (panes, loaders). */
export function Frame({ height = 420, children, className }: { height?: number; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("relative isolate overflow-hidden rounded-md border border-line bg-space-void", className)}
      style={{ height }}
    >
      {children}
    </div>
  );
}
