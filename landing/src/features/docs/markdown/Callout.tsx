import type { ReactNode } from "react";
import { InfoIcon, LightbulbIcon, TriangleAlertIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";
import type { CalloutKind } from "./calloutKind";

/**
 * GitHub-flavoured alerts: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`.
 *
 * Authors already type this syntax out of habit, and it renders as a plain
 * blockquote anywhere else: on GitHub, in an editor preview: so the source
 * stays readable outside our renderer.
 *
 * Drawn as the app's Alert (boards/Surfaces.dc.html §01): a tinted block with
 * an icon and a matching edge, the text staying white so it passes contrast,
 * and never a coloured left border.
 */

const STYLES: Record<
  CalloutKind,
  { icon: typeof InfoIcon; label: string; box: string; icon_: string }
> = {
  NOTE: {
    icon: InfoIcon,
    label: "Note",
    box: "border-blue-500/34 bg-blue-500/12",
    icon_: "text-blue-500",
  },
  TIP: {
    icon: LightbulbIcon,
    label: "Tip",
    box: "border-green-400/32 bg-green-400/11",
    icon_: "text-green-400",
  },
  WARNING: {
    icon: TriangleAlertIcon,
    label: "Warning",
    box: "border-orange-400/34 bg-orange-400/11",
    icon_: "text-orange-400",
  },
};

export function Callout({
  kind,
  children,
}: {
  kind: CalloutKind;
  children: ReactNode;
}) {
  const style = STYLES[kind];
  const Icon = style.icon;

  return (
    <div
      role={kind === "WARNING" ? "alert" : "note"}
      className={cn("my-6 flex items-start gap-3 rounded-lg border px-4 py-3.5", style.box)}
    >
      <Icon aria-hidden="true" className={cn("mt-1 size-4 shrink-0", style.icon_)} />
      <div className="min-w-0 flex-1 text-sm leading-[1.6] text-silver-900 [&>p]:mb-2 [&>p:last-child]:mb-0">
        <p className="font-semibold">{style.label}</p>
        {children}
      </div>
    </div>
  );
}

export default Callout;
