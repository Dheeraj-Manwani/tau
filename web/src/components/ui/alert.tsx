import * as React from "react";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";

/**
 * Say it once, in one colour (boards/Surfaces.dc.html §01): a tinted block
 * with an icon and a matching edge, never a coloured left border. The text
 * stays white so it passes contrast; the colour lives in the icon, tint and
 * edge. An optional action goes on the right as a small secondary button.
 */
const tones = {
  info: { box: "border-blue-500/34 bg-blue-500/12", icon: "text-blue-500", Icon: InfoIcon },
  warning: { box: "border-orange-400/34 bg-orange-400/11", icon: "text-orange-400", Icon: TriangleAlertIcon },
  success: { box: "border-green-400/32 bg-green-400/11", icon: "text-green-400", Icon: CircleCheckIcon },
  danger: { box: "border-red-400/32 bg-red-400/10", icon: "text-red-400", Icon: CircleAlertIcon },
} satisfies Record<string, { box: string; icon: string; Icon: LucideIcon }>;

export type AlertTone = keyof typeof tones;

function Alert({
  tone = "info",
  title,
  icon,
  action,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  tone?: AlertTone;
  title?: React.ReactNode;
  /** Replaces the tone's default icon. */
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  const { box, icon: iconClass, Icon: DefaultIcon } = tones[tone];
  const Icon = icon ?? DefaultIcon;
  return (
    <div
      data-slot="alert"
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-lg border px-4 py-3.5 text-[13px] leading-[1.55] text-silver-900", box, className)}
      {...props}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", iconClass)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
      {action && <div className="-my-0.5 shrink-0">{action}</div>}
    </div>
  );
}

export { Alert };
