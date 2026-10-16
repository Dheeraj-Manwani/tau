import { Card } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { useSpend } from "./api";

/**
 * Building vs deployed-app AI, over the last 30 days.
 *
 * Two very different things spend from one balance and only one of them used to
 * be visible: every rollup read `TokenUsage`, which covers builds alone. A user
 * whose deployed app was burning credits saw the number fall with nothing on the
 * page accounting for it.
 *
 * Charts use blue, then neutral steps (boards/Billing.dc.html).
 */
export function SpendSplitCard() {
  const { data, isLoading } = useSpend();

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-3 px-6 py-5.5" aria-label="Loading credit usage">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-2 w-full" />
      </Card>
    );
  }
  if (!data || data.total.credits <= 0) return null;

  const build = data.build.credits;
  const runtime = data.runtime.credits;
  const rows = [
    { label: "Building", value: build, swatch: "bg-blue-500", muted: false },
    { label: "Your apps' AI", value: runtime, swatch: "bg-silver-600", muted: true },
  ];

  return (
    <Card className="flex flex-col gap-4 px-6 py-5.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">Where your credits went</h2>
        <span className="font-mono text-[11.5px] text-silver-500">last {data.windowDays} days</span>
      </div>

      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {build > 0 && <div className="bg-blue-500" style={{ flex: build }} />}
        {runtime > 0 && <div className="bg-silver-600" style={{ flex: runtime }} />}
      </div>

      <div className="flex flex-col">
        {rows.map(({ label, value, swatch, muted }) => (
          <div
            key={label}
            className="flex items-center justify-between border-b border-line py-2.5 text-[13.5px] last:border-b-0 last:pb-0"
          >
            <span className={`flex items-center gap-2.5 ${muted ? "text-silver-600" : ""}`}>
              <span className={`size-2 rounded-full ${swatch}`} aria-hidden />
              {label}
            </span>
            <span className={`font-mono tabular-nums ${muted ? "text-silver-600" : ""}`}>{value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
