import * as React from "react";
import { SearchIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { fieldClass } from "@/src/components/ui/styles";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldClass,
        "flex h-9 px-3 py-1",
        "file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

/** An input with a leading search icon ("Search name or description"). */
function SearchInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-silver-500" />
      <Input type="search" className="pl-9" {...props} />
    </div>
  );
}

/** An input with its action beside it: `www.example.com [Connect]`. */
function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="input-group" className={cn("flex min-w-0 items-center gap-2", className)} {...props} />;
}

export { Input, InputGroup, SearchInput };
