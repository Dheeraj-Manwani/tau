import * as React from "react";

import { cn } from "@/src/lib/utils";

/**
 * Label above, help below (boards/Controls.dc.html §02). The counter sits on
 * the label row in mono ("30/60"). An error replaces the help line in red;
 * pair it with `aria-invalid` on the control so its edge turns red too.
 */
function Field({
  label,
  htmlFor,
  counter,
  help,
  error,
  className,
  children,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  counter?: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-slot="field" className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {(label || counter) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] leading-none font-medium text-silver-900">
              {label}
            </label>
          )}
          {counter && <span className="font-mono text-[11px] leading-none text-silver-500">{counter}</span>}
        </div>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-xs leading-normal text-red-400">
          {error}
        </p>
      ) : (
        help && <p className="text-xs leading-normal text-silver-500">{help}</p>
      )}
    </div>
  );
}

export { Field };
