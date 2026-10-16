import * as React from "react";

import { cn } from "@/src/lib/utils";
import { fieldClass } from "@/src/components/ui/styles";

/** The text field's multi-line twin: same edge, inset fill and focus ring. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClass, "min-h-20 resize-y px-3 py-2.5 leading-[1.55]", className)}
      {...props}
    />
  );
}

export { Textarea };
