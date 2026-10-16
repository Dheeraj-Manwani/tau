import { StarIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";

/** Five stars; the chosen ones fill blue, matching selection everywhere. */
function Rating({
  value,
  onChange,
  label = "Rating",
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex gap-1.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          className="cursor-pointer rounded-xs p-0.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <StarIcon
            aria-hidden="true"
            strokeWidth={1.6}
            className={cn(
              "size-6.5 transition-colors duration-150",
              n <= value ? "fill-blue-500 text-blue-500" : "fill-transparent text-[#6b6b75] hover:text-silver-600",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export { Rating };
