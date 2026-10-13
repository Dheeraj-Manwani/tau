import { useState } from "react";
import { GitBranchIcon, LoaderCircleIcon, LockIcon, PlusIcon } from "lucide-react";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/src/components/ui/dialog";
import { cn } from "@/src/lib/utils";
import { errorMessage, useCreateGithubRepository } from "./github";
import { githubButtonClass, githubPrimaryClass } from "./githubStyles";

export function GithubCreateRepository({ projectId, disabled = false }: {
  projectId: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useCreateGithubRepository(projectId);
  const validName = /^[a-zA-Z0-9_.-]{1,100}$/.test(name.trim()) && ![".", "..", ".git"].includes(name.trim().toLowerCase());
  const setDialogOpen = (value: boolean) => {
    if (create.isPending) return;
    setOpen(value);
    if (!value) { setName(""); setDescription(""); create.reset(); }
  };

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <button type="button" disabled={disabled} className={cn(githubButtonClass, githubPrimaryClass)}>
          <PlusIcon className="size-3.5" />Create repository
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-silver-200 bg-space-surface text-silver-900 sm:max-w-lg motion-reduce:animate-none"
        showCloseButton={!create.isPending}
        onEscapeKeyDown={(e) => { if (create.isPending) e.preventDefault(); }}
        onInteractOutside={(e) => { if (create.isPending) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Create a repository</DialogTitle>
          <DialogDescription className="text-silver-600">
            Give this project a new home in your connected GitHub account.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={(e) => {
          e.preventDefault();
          if (disabled || !validName || create.isPending) return;
          create.mutate({ name: name.trim(), description: description.trim() }, { onSuccess: () => setOpen(false) });
        }}>
          <div className="space-y-4">
            <label className="block text-xs font-medium">Repository name
              <input required maxLength={100} value={name} disabled={create.isPending} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                onChange={(e) => { setName(e.target.value); create.reset(); }} placeholder="my-project" aria-describedby="github-repo-name-hint"
                className="mt-2 h-10 w-full rounded-lg border border-silver-200 bg-space-void px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
            </label>
            <p id="github-repo-name-hint" className="text-[11px] leading-relaxed text-silver-600">Use letters, numbers, periods, hyphens, or underscores. Choose a name you haven’t used on GitHub.</p>
            <label className="block text-xs font-medium">Description <span className="font-normal text-silver-600">(optional)</span>
              <textarea maxLength={350} value={description} disabled={create.isPending} onChange={(e) => setDescription(e.target.value)}
                placeholder="What are you building?" rows={3}
                className="mt-2 w-full resize-none rounded-lg border border-silver-200 bg-space-void p-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
            </label>
            <div className="space-y-3 rounded-lg border border-silver-200 bg-space-overlay p-4 text-xs">
              <div className="flex items-start gap-2.5"><LockIcon className="mt-0.5 size-4 shrink-0 text-silver-600" /><div><p className="font-medium">Private repository</p><p className="mt-1 leading-relaxed text-silver-600">Only you and people you invite can access it. You can change visibility in Settings later.</p></div></div>
              <div className="flex items-start gap-2.5"><GitBranchIcon className="mt-0.5 size-4 shrink-0 text-silver-600" /><p className="leading-relaxed text-silver-600">After creating, review your project’s changes and push code or open a pull request.</p></div>
            </div>
            {create.isError && <p role="alert" className="text-xs leading-relaxed text-red-400">{errorMessage(create.error, "Couldn't create repository. Try again.")}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><button type="button" disabled={create.isPending} className={githubButtonClass}>Cancel</button></DialogClose>
            <button type="submit" disabled={disabled || !validName || create.isPending} className={cn(githubButtonClass, githubPrimaryClass)}>
              {create.isPending && <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" />}
              {create.isPending ? "Creating…" : "Create repository"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
