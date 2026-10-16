import * as React from "react";

import { cn } from "@/src/lib/utils";

/**
 * One flat Settings row (boards/Overlays.dc.html): title and help on the left,
 * the control on the right, a hairline above. No card inside the card.
 */
export function SettingsRow({
  title,
  htmlFor,
  help,
  warning,
  control,
  className,
}: {
  title: React.ReactNode;
  /** Makes the text a label for the control, so clicking it toggles a switch. */
  htmlFor?: string;
  help?: React.ReactNode;
  /** An orange line under the help, for something the user has to fix. */
  warning?: React.ReactNode;
  control: React.ReactNode;
  className?: string;
}) {
  const Text = htmlFor ? "label" : "div";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-line py-4",
        className,
      )}
    >
      <Text htmlFor={htmlFor} className="flex min-w-[min(200px,100%)] flex-1 flex-col gap-0.5">
        <span className="text-[13.5px] font-medium text-silver-900">{title}</span>
        {help && <span className="max-w-[330px] text-[12.5px] leading-normal text-silver-500">{help}</span>}
        {warning && <span className="mt-1 text-[12.5px] leading-normal text-orange-400">{warning}</span>}
      </Text>
      <div className="flex shrink-0 gap-2">{control}</div>
    </div>
  );
}
