import { useState } from "react";
import { PaletteIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";
import {
  countChoices,
  sameDesign,
  useDesignCatalog,
  withoutImport,
  type DesignConfig,
} from "@/src/features/design/api";
import { DesignPicker, PickerSkeleton } from "@/src/features/design/DesignPicker";

/**
 * The composer's control for an app's look: a button that says what has been
 * chosen, and a dialog to choose it in.
 *
 * Sits beside the effort toggle and is sized like it. Nothing chosen reads
 * "Auto", which is the default and the recommended one — the button exists so
 * that someone who cares can say so, not so that everyone has to answer a
 * design question before they can build.
 *
 * Renders nothing where the server builds new projects on the older templates
 * (`catalog.enabled`): a choice there would be stored and ignored.
 */
export function DesignButton({
  value,
  onChange,
  disabled = false,
  savedDefault = null,
  onSaveDefault,
}: {
  value: DesignConfig;
  onChange: (next: DesignConfig) => void;
  disabled?: boolean;
  /** The user's default look, which the composer starts from. */
  savedDefault?: DesignConfig | null;
  /** Keep the current choice as the default look for new projects. */
  onSaveDefault?: (config: Omit<DesignConfig, "designMd">) => void;
}) {
  const [open, setOpen] = useState(false);
  const catalog = useDesignCatalog();

  if (!catalog.data?.enabled) return null;

  const chosen = countChoices(value);
  // What of this choice could be a default: everything but an imported file.
  const keepable = withoutImport(value);
  const isDefault = savedDefault != null && sameDesign(value, savedDefault);
  const style = catalog.data.styles.find((s) => s.key === value.style);
  const label = value.designMd
    ? value.reference
      ? "Screenshot"
      : "Your design"
    : (style?.name ?? (chosen > 0 ? "Custom" : "Auto"));

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={`Choose how the app looks. Currently: ${label}`}
        data-tour="design"
        // The STYLE chip (boards/Home.dc.html): mono caps, one strong edge,
        // neutral whether or not a look is chosen; the label says which.
        className={cn(
          "flex h-7 cursor-pointer items-center gap-1.5 rounded-sm border border-line-strong px-2.5 font-mono text-[11px] font-medium tracking-[0.06em] uppercase transition-colors duration-150 outline-none hover:bg-space-raised hover:text-silver-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40",
          chosen > 0 ? "text-silver-900" : "text-silver-600",
        )}
      >
        {value.accent ? (
          <span
            className="size-3 shrink-0 rounded-full border border-black/20"
            style={{ backgroundColor: value.accent }}
          />
        ) : (
          <PaletteIcon className="size-3.5 shrink-0" />
        )}
        <span className="text-silver-500">Style</span>
        <span className="max-w-28 truncate">{label}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-5 sm:max-w-[min(960px,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>How should it look?</DialogTitle>
            <DialogDescription>
              All of this is optional. Whatever you leave on Auto, tau decides
              from what you ask it to build.
              {isDefault && " This is your default look."}
            </DialogDescription>
          </DialogHeader>

          {catalog.data ? (
            <DesignPicker catalog={catalog.data} value={value} onChange={onChange} />
          ) : (
            <PickerSkeleton />
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              className="sm:mr-auto"
              disabled={chosen === 0}
              onClick={() => onChange({})}
            >
              Reset to auto
            </Button>
            {savedDefault && !isDefault && (
              <Button variant="ghost" onClick={() => onChange(savedDefault)}>
                Use my default
              </Button>
            )}
            {onSaveDefault && keepable && !isDefault && (
              <Button
                variant="ghost"
                title="New projects will start from this look"
                onClick={() => onSaveDefault(keepable)}
              >
                Make this my default
              </Button>
            )}
            <Button onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
