import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

/** "Page 1" (or "Page 1 of 3" when the count is known) with small secondary
 *  Previous / Next. Previous is disabled on page one, not hidden. */
function Pagination({
  page,
  pageCount,
  hasNext,
  onPrevious,
  onNext,
  note,
  className,
}: {
  page: number;
  /** How many pages there are, when known. */
  pageCount?: number;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** Extra text after the page, e.g. "Sorted by latest activity". */
  note?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-between gap-4 border-t border-line pt-4", className)}
    >
      <span className="text-[13px] text-silver-500">
        Page {page}
        {pageCount !== undefined && ` of ${pageCount}`}
        {note && ` · ${note}`}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={onPrevious}>
          <ChevronLeftIcon />
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={!hasNext} onClick={onNext}>
          Next
          <ChevronRightIcon />
        </Button>
      </div>
    </nav>
  );
}

export { Pagination };
