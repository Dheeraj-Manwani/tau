import { type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "react-hot-toast";

import { queryClient } from "@/src/lib/query-client";
import { TooltipProvider } from "./ui/tooltip";
import { SuccessCelebration } from "./SuccessCelebration";
import { BoltFlash } from "./motion/BoltFlash";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster
          position="bottom-center"
          // boards/Surfaces.dc.html "Toast": the popover surface, one edge,
          // the one shadow; the icon carries the status colour.
          toastOptions={{
            style: {
              background: "var(--space-overlay)",
              color: "var(--silver-900)",
              border: "1px solid var(--line-strong)",
              borderRadius: "14px",
              boxShadow:
                "0 16px 48px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.04)",
              padding: "12px 14px",
              fontSize: "13px",
              lineHeight: "1.5",
            },
            success: {
              iconTheme: { primary: "#34d399", secondary: "#09090b" },
            },
            error: { iconTheme: { primary: "#f87171", secondary: "#09090b" } },
            loading: { iconTheme: { primary: "#60a5fa", secondary: "#34343a" } },
          }}
        />
        {children}
        <SuccessCelebration />
        <BoltFlash />
      </TooltipProvider>

      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
