import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import {
  countChoices,
  sameDesign,
  useDesignCatalog,
  withoutImport,
  type DesignConfig,
} from "@/src/features/design/api";
import { DesignPicker, PickerSkeleton } from "@/src/features/design/DesignPicker";

/**
 * Where an app's look is chosen. Opened from the composer's settings menu
 * ("Browse styles"); nothing chosen is Auto, the default and the recommended
 * one, so nobody has to answer a design question before they can build.
 */
export function DesignDialog({
  open,
  onOpenChange,
  value,
  onChange,
  savedDefault = null,
  onSaveDefault,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: DesignConfig;
  onChange: (next: DesignConfig) => void;
  /** The user's default look, which the composer starts from. */
  savedDefault?: DesignConfig | null;
  /** Keep the current choice as the default look for new projects. */
  onSaveDefault?: (config: Omit<DesignConfig, "designMd">) => void;
}) {
  const catalog = useDesignCatalog();
  const chosen = countChoices(value);
  // What of this choice could be a default: everything but an imported file.
  const keepable = withoutImport(value);
  const isDefault = savedDefault != null && sameDesign(value, savedDefault);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
