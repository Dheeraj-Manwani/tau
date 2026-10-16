import * as React from "react";
import { PaperclipIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";

/** A dashed drop target that opens the file picker, with its limits below. */
function FileDrop({
  label,
  caption,
  icon: Icon = PaperclipIcon,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "children"> & {
  label: React.ReactNode;
  caption?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={cn(
          "flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-line-strong text-[13px] font-medium text-silver-600 transition-colors duration-150 outline-none hover:border-blue-500/34 hover:bg-blue-500/12 hover:text-silver-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40",
          className,
        )}
        {...props}
      >
        <Icon className="size-4" />
        {label}
      </button>
      {caption && <p className="text-xs leading-normal text-silver-500">{caption}</p>}
    </div>
  );
}

export { FileDrop };
