import { ChoiceCard } from "@/src/components/ui/checkbox";
import { cn } from "@/src/lib/utils";
import type { CreditPack } from "@/src/features/billing/api";
import { formatPrice } from "@/src/features/billing/creditPacks";

/** A credit pack as a choice card: the whole card is the radio; selected
 *  is a blue edge and a 12% blue tint. Sits in a `RadioGroup`. */
export function PackCard({
  pack,
  tag,
  selected,
  compact = false,
}: {
  pack: CreditPack;
  tag?: string;
  selected: boolean;
  /** Smaller number for the three-up row inside a modal. */
  compact?: boolean;
}) {
  return (
    <ChoiceCard
      value={pack.id}
      aria-label={`${pack.credits} credits for ${formatPrice(pack.price)}`}
      className={cn(compact && "gap-1 px-3 py-3")}
    >
      {tag && (
        <span
          className={cn(
            "font-mono text-[11px] tracking-[0.12em] uppercase",
            selected ? "text-blue-500" : "text-silver-500",
          )}
        >
          {tag}
        </span>
      )}
      <span className="flex items-baseline gap-1.5">
        <span className={cn("display-heading", compact ? "text-[26px]" : "text-[34px]")}>
          {pack.credits.toLocaleString()}
        </span>
        <span className="font-mono text-[11px] text-silver-500">CR</span>
      </span>
      <span className="font-mono text-[13px] text-silver-600">{formatPrice(pack.price)}</span>
    </ChoiceCard>
  );
}
