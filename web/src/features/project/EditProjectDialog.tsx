import { useState, type KeyboardEvent } from "react";
import { XIcon } from "lucide-react";
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
import { Input } from "@/src/components/ui/input";
import { Alert } from "@/src/components/ui/alert";
import { Field } from "@/src/components/ui/field";
import { Textarea } from "@/src/components/ui/textarea";
import { conflictSummary, useCheckInstructions } from "@/src/features/settings/instructionCheck";
import { useSettings } from "@/src/hooks/useSettings";
import {
  useUpdateProject,
  type UpdateProjectResponse,
} from "@/src/features/project/api";

const MAX_DESCRIPTION = 2_000;
/** Mirrors `MAX_PROJECT_INSTRUCTIONS_CHARS` on the server. */
const MAX_INSTRUCTIONS = 4_000;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 32;

export interface EditableProject {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  instructions: string | null;
}

interface EditProjectDialogProps {
  project: EditableProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (updated: UpdateProjectResponse) => void;
}

/**
 * The actual form, mounted only while a project is set — same trick as
 * `FeedbackModal`'s `{isOpen && <FeedbackForm />}`: it keys the mutation hook
 * to a real project id instead of juggling a nullable one, and `key={project.id}`
 * below gives every project its own fresh draft state rather than leaking the
 * previous project's edits in for a flash before the effect would reset them.
 */
function EditProjectForm({
  project,
  onOpenChange,
  onSaved,
}: {
  project: EditableProject;
  onOpenChange: (open: boolean) => void;
  onSaved?: EditProjectDialogProps["onSaved"];
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [tags, setTags] = useState<string[]>(project.tags ?? []);
  const [instructions, setInstructions] = useState(project.instructions ?? "");
  const [tagDraft, setTagDraft] = useState("");
  const update = useUpdateProject(project.id);
  const check = useCheckInstructions();
  const { instructions: accountInstructions } = useSettings();

  const addTag = (raw: string) => {
    const value = raw.trim().slice(0, MAX_TAG_LENGTH);
    setTagDraft("");
    if (!value || tags.length >= MAX_TAGS) return;
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    setTags((prev) => [...prev, value]);
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagDraft);
    } else if (e.key === "Backspace" && tagDraft.length === 0 && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !update.isPending;

  const handleSave = () => {
    if (!canSave) return;
    update.mutate(
      {
        name: trimmedName,
        description: description.trim(),
        tags,
        instructions: instructions.trim(),
      },
      {
        onSuccess: (updated) => {
          toast.success("Project updated");
          // Advice, a moment later: the project is saved whatever it says.
          if (instructions.trim()) {
            check.mutate(
              { account: accountInstructions || undefined, project: instructions.trim() },
              {
                onSuccess: (conflicts) => {
                  const said = conflictSummary(conflicts);
                  if (said) toast(said, { duration: 9_000 });
                },
              },
            );
          }
          onOpenChange(false);
          onSaved?.(updated);
        },
        onError: () => toast.error("Failed to update project"),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit project</DialogTitle>
        <DialogDescription>
          Update the name, description and tags, and tell tau what to keep in
          mind here.
        </DialogDescription>
      </DialogHeader>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <Field label="Name" htmlFor="edit-project-name">
          <Input
            id="edit-project-name"
            value={name}
            maxLength={100}
            disabled={update.isPending}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={trimmedName.length === 0 || undefined}
            autoFocus
          />
        </Field>

        <Field
          label={<>Description <Optional /></>}
          htmlFor="edit-project-description"
        >
          <Textarea
            id="edit-project-description"
            value={description}
            maxLength={MAX_DESCRIPTION}
            disabled={update.isPending}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this project about?"
            rows={3}
          />
        </Field>

        <Field
          label={<>Tags <Optional /></>}
          htmlFor="edit-project-tags"
          help="Press Enter or comma to add a tag."
        >
          <div
            onClick={() => document.getElementById("edit-project-tags")?.focus()}
            className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-line-strong bg-space-void px-2 py-1.5 transition-[border-color,box-shadow] duration-150 hover:border-line-hover focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgb(96_165_250/0.2)]"
          >
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex h-6 items-center gap-1 rounded-xs border border-line-strong bg-space-raised pr-1 pl-2 text-xs text-silver-900"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  disabled={update.isPending}
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  className="grid size-4 cursor-pointer place-items-center rounded-[4px] text-silver-500 transition-colors hover:text-silver-900 disabled:opacity-40"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
            <input
              id="edit-project-tags"
              value={tagDraft}
              disabled={update.isPending || tags.length >= MAX_TAGS}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => addTag(tagDraft)}
              placeholder={tags.length === 0 ? "e.g. side project, client work" : ""}
              className="h-6 min-w-20 flex-1 bg-transparent px-1 text-[13px] text-silver-900 outline-none placeholder:text-silver-500 focus-visible:outline-none disabled:opacity-40"
            />
          </div>
        </Field>

        <Field
          label={<>Instructions for tau <Optional /></>}
          htmlFor="edit-project-instructions"
          counter={
            instructions.length > MAX_INSTRUCTIONS * 0.8
              ? `${instructions.length.toLocaleString()} / ${MAX_INSTRUCTIONS.toLocaleString()}`
              : undefined
          }
          help={
            <>
              tau reads these with every request in this project, so you
              don&rsquo;t have to repeat them.
            </>
          }
        >
          <Textarea
            id="edit-project-instructions"
            value={instructions}
            maxLength={MAX_INSTRUCTIONS}
            disabled={update.isPending}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={"e.g. The pricing page is signed off, don't change it without asking.\nPrices are in pounds."}
            rows={4}
          />
        </Field>

        {update.error && (
          <Alert tone="danger">Couldn&rsquo;t update the project. Try again.</Alert>
        )}
      </form>

      <DialogFooter>
        <Button
          type="button"
          variant="secondary"
          disabled={update.isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={trimmedName.length === 0}
          loading={update.isPending}
          onClick={handleSave}
        >
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </>
  );
}

function Optional() {
  return <span className="font-normal text-silver-500">(optional)</span>;
}

/** Edit-project modal shared verbatim by Home (`MyProjects`) and the project
 *  page (`ProjectSwitcher`) — same component, same fields, opened from either
 *  place a project's identity shows up. */
export function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSaved,
}: EditProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        {project && (
          <EditProjectForm
            key={project.id}
            project={project}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
