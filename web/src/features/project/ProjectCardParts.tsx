import { Skeleton } from "@/src/components/ui/skeleton";

/** The three-dot window bar every project card wears. */
export function CardChrome() {
  return (
    <div className="flex h-[22px] shrink-0 items-center gap-1 border-b border-line px-2.5" aria-hidden="true">
      <i className="size-1 rounded-full bg-[#3a3a40]" />
      <i className="size-1 rounded-full bg-[#3a3a40]" />
      <i className="size-1 rounded-full bg-[#3a3a40]" />
    </div>
  );
}

/** Never built, building, or no capture: a quiet striped well. */
export function ThumbnailPlaceholder({ label = "Preview" }: { label?: string }) {
  return (
    <div className="grid size-full place-items-center bg-[repeating-linear-gradient(135deg,#0e0e10_0_10px,#131316_10px_20px)]">
      <span className="font-mono text-[10px] tracking-[0.1em] text-silver-500 uppercase select-none">{label}</span>
    </div>
  );
}

/** A loading card with the same shape as the real one. */
export function ProjectCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-space-surface">
      <CardChrome />
      <Skeleton className="h-[150px] rounded-none" />
      <div className="flex flex-col gap-2 px-4 py-3.5">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
}
