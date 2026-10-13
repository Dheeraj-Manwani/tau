import { useState } from "react";
import { GlobeIcon, Link2Icon, LoaderCircleIcon, LockIcon, SearchIcon } from "lucide-react";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/src/components/ui/dialog";
import { cn } from "@/src/lib/utils";
import { errorMessage, useLinkRepo, useUserRepos } from "./github";
import { githubButtonClass, githubPrimaryClass } from "./githubStyles";

export function GithubRepositoryPicker({ projectId, currentRepo, disabled = false }: {
  projectId: string;
  currentRepo?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const repos = useUserRepos(projectId, open);
  const link = useLinkRepo(projectId);
  const filtered = (repos.data ?? []).filter((repo) =>
    repo.fullName.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const setDialogOpen = (value: boolean) => {
    if (link.isPending) return;
    setOpen(value);
    if (!value) {
      setSearch("");
      setSelected(null);
      link.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <button type="button" disabled={disabled} className={githubButtonClass}>
          <Link2Icon className="size-3.5" />
          {currentRepo ? "Change repository" : "Link existing repository"}
        </button>
      </DialogTrigger>
      <DialogContent className="border-silver-200 bg-space-surface text-silver-900 sm:max-w-lg motion-reduce:animate-none" showCloseButton={!link.isPending}>
        <DialogHeader>
          <DialogTitle>{currentRepo ? "Change repository" : "Link a repository"}</DialogTitle>
          <DialogDescription className="text-silver-600">
            Choose where this project's future pushes go. Linking does not import
            repository files into Tau.{currentRepo && " Changing repository resets the previous push and pull request association."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-silver-600" />
            <input
              aria-label="Search repositories"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
              placeholder="Search your repositories…"
              className="h-10 w-full rounded-lg border border-silver-200 bg-space-void pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
          <div aria-label="Available repositories" className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-silver-200 p-1">
            {repos.isLoading ? (
              <p role="status" className="flex items-center gap-2 p-4 text-xs text-silver-600"><LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />Loading repositories…</p>
            ) : repos.isError ? (
              <div role="alert" className="space-y-3 p-4 text-xs text-silver-600">
                <p>Couldn't load your repositories.</p>
                <button type="button" className={githubButtonClass} onClick={() => void repos.refetch()}>Try again</button>
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-xs text-silver-600">{search ? "No matching repositories." : "No owned repositories available."}</p>
            ) : filtered.map((repo) => (
              <button
                key={repo.fullName}
                type="button"
                aria-pressed={selected === repo.fullName}
                disabled={link.isPending || repo.fullName === currentRepo}
                onClick={() => setSelected(repo.fullName)}
                className={cn("flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50", selected === repo.fullName ? "bg-blue-500/10 text-blue-500" : "hover:bg-space-overlay")}
              >
                {repo.private ? <LockIcon className="size-3.5 shrink-0" /> : <GlobeIcon className="size-3.5 shrink-0" />}
                <span className="min-w-0 break-all">{repo.fullName}</span>
                {repo.fullName === currentRepo && <span className="ml-auto shrink-0 text-silver-600">Linked</span>}
              </button>
            ))}
          </div>
          <p className="text-xs text-silver-600">Showing up to 100 repositories owned by your connected account.</p>
          {link.isError && <p role="alert" className="text-xs text-red-400">{errorMessage(link.error, "Couldn't link repository. Try again.")}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild><button type="button" disabled={link.isPending} className={githubButtonClass}>Cancel</button></DialogClose>
          <button
            type="button"
            disabled={disabled || !selected || link.isPending || repos.isError || repos.isFetching}
            className={cn(githubButtonClass, githubPrimaryClass)}
            onClick={() => selected && link.mutate(selected, { onSuccess: () => { setOpen(false); setSelected(null); setSearch(""); } })}
          >
            {link.isPending && <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" />}
            {link.isPending ? "Linking…" : "Link repository"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
