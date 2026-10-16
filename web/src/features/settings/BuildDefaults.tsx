import { useState } from "react";
import { ScrollTextIcon } from "lucide-react";
import toast from "react-hot-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { SettingsRow } from "@/src/features/settings/SettingsRow";
import {
  describeChoice,
  sameDesign,
  useDesignCatalog,
  withoutImport,
  type DesignConfig,
} from "@/src/features/design/api";
import { DesignPicker } from "@/src/features/design/DesignPicker";
import { useSettings } from "@/src/hooks/useSettings";
import { InstructionConflicts } from "@/src/features/settings/instructionConflicts";
import { useCheckInstructions } from "@/src/features/settings/instructionCheck";

/** Mirrors `MAX_USER_INSTRUCTIONS_CHARS` on the server. */
const MAX_INSTRUCTIONS = 2_000;

/**
 * What the user wants in everything they build, said once.
 *
 * Saved with a button, not as they type: tau reads these on every request, and
 * half a sentence is an instruction too.
 */
export function StandingInstructionsCard() {
  const { instructions, setInstructions } = useSettings();
  const [draft, setDraft] = useState(instructions);
  const changed = draft.trim() !== instructions;
  // What the check said about the text as last saved; gone as soon as it is edited.
  const check = useCheckInstructions();
  const conflicts = changed ? undefined : check.data;

  return (
    <div className="flex flex-col gap-3 pb-5">
      <label htmlFor="standing-instructions" className="flex flex-col gap-1.5">
        <span className="flex items-center gap-2.5 text-sm font-semibold text-silver-900">
          <ScrollTextIcon className="size-4 shrink-0 text-silver-600" />
          Instructions for tau
        </span>
        <span className="text-[12.5px] leading-[1.55] text-silver-500">
          What tau should keep in mind in everything you build, so you
          don&rsquo;t have to repeat it. A project can add its own under Edit
          project.
        </span>
      </label>

      <Textarea
        id="standing-instructions"
        value={draft}
        maxLength={MAX_INSTRUCTIONS}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={"e.g. Write interface copy in British English.\nI'm colour-blind: never rely on red and green alone."}
        rows={3}
        className="scrollbar-thin"
      />

      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-silver-500 tabular-nums">
          {draft.length > MAX_INSTRUCTIONS * 0.8
            ? `${draft.length.toLocaleString()} / ${MAX_INSTRUCTIONS.toLocaleString()}`
            : instructions && !changed
              ? "Saved. tau reads these with every request."
              : ""}
        </span>
        <span className="flex shrink-0 gap-2">
          {changed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft(instructions)}
            >
              Discard
            </Button>
          )}
          <Button
            size="sm"
            disabled={!changed}
            onClick={() => {
              setInstructions(draft);
              setDraft(draft.trim());
              if (draft.trim()) check.mutate({ account: draft.trim() });
              else check.reset();
              toast.success(
                draft.trim() ? "Instructions saved" : "Instructions cleared",
              );
            }}
          >
            Save
          </Button>
        </span>
      </div>
      <InstructionConflicts conflicts={conflicts} />
    </div>
  );
}

/**
 * The look new projects start from. Chosen with the same picker the composer
 * uses, minus the DESIGN.md import: a design file is written for one app.
 *
 * Renders nothing where the server builds on the older templates, which have
 * no design step.
 */
export function DefaultLookCard() {
  const { defaultDesign, setDefaultDesign } = useSettings();
  const catalog = useDesignCatalog();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DesignConfig>({});

  if (!catalog.data?.enabled) return null;

  const parts = defaultDesign ? describeChoice(defaultDesign, catalog.data) : [];
  const keepable = withoutImport(draft);

  return (
    <>
      <SettingsRow
        title="Default look"
        help={
          defaultDesign ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {defaultDesign.accent && (
                <span
                  className="size-3 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                  style={{ backgroundColor: defaultDesign.accent }}
                  title={defaultDesign.accent}
                />
              )}
              {parts.length > 0 ? parts.join(" · ") : defaultDesign.accent}
            </span>
          ) : (
            "tau picks a look that suits each thing you build. Choose one here to start every new project from it instead."
          )
        }
        control={
          <>
            {defaultDesign && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDefaultDesign(null);
                  toast.success("tau will pick the look for new projects");
                }}
              >
                Clear
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setDraft(defaultDesign ?? {});
                setOpen(true);
              }}
            >
              {defaultDesign ? "Change" : "Choose"}
            </Button>
          </>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-5 sm:max-w-[min(960px,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>Your default look</DialogTitle>
            <DialogDescription>
              New projects start from this. Whatever you leave on Auto, tau
              still decides, and you can choose differently for any one project
              when you start it.
            </DialogDescription>
          </DialogHeader>

          <DesignPicker
            catalog={catalog.data}
            value={draft}
            onChange={setDraft}
            allowImport={false}
          />

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={sameDesign(draft, defaultDesign)}
              onClick={() => {
                setDefaultDesign(keepable);
                setOpen(false);
                toast.success(
                  keepable
                    ? "New projects will start from this look"
                    : "tau will pick the look for new projects",
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
