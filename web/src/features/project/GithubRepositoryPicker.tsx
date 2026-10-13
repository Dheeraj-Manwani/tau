import { useState } from "react";
import { GlobeIcon, Link2Icon, LoaderCircleIcon, LockIcon, SearchIcon } from "lucide-react";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/src/components/ui/dialog";
import { cn } from "@/src/lib/utils";
import { errorMessage, useLinkRepo, useUserRepos, type RepoAffiliation } from "./github";
import { githubButtonClass, githubPrimaryClass } from "./githubStyles";

export function GithubRepositoryPicker({ projectId, currentRepo, disabled = false }: {
  projectId: string;
  currentRepo?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [affiliation, setAffiliation] = useState<RepoAffiliation>("all");
  const repos = useUserRepos(projectId, open, page, affiliation);
  const link = useLinkRepo(projectId);
  const filtered = (repos.data?.repos ?? []).filter((repo) =>
    repo.fullName.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const setDialogOpen = (value: boolean) => {
    if (link.isPending) return;
    setOpen(value);
    if (!value) {
      setSearch("");
      setSelected(null);
      setPage(1);
      setAffiliation("all");
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
      <DialogContent className="border-silver-200 bg-space-surface text-silver-900 sm:max-w-lg motion-reduce:animate-none" showCloseButton={!link.isPending} onEscapeKeyDown={(e) => { if (link.isPending) e.preventDefault(); }} onInteractOutside={(e) => { if (link.isPending) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{currentRepo ? "Change repository" : "Link a repository"}</DialogTitle>
          <DialogDescription className="text-silver-600">
            Choose where this project's future pushes go. Linking does not import
            repository files into Tau.{currentRepo && " Changing repository resets the previous push and pull request association."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs">Repository access<select aria-label="Repository access" value={affiliation} disabled={link.isPending || repos.isFetching} onChange={(e) => { setAffiliation(e.target.value as RepoAffiliation); setPage(1); setSelected(null); setSearch(""); }} className="mt-2 h-10 w-full rounded-lg border border-silver-200 bg-space-void px-3 text-xs outline-ring"><option value="all">All accessible repositories</option><option value="owner">Owned by you</option><option value="collaborator">Collaborator access</option><option value="organization_member">Organization membership</option></select></label>
          <div className="relative">
            <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-silver-600" />
            <input
              aria-label="Search repositories"
              value={search}
              disabled={link.isPending}
              onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
              placeholder="Filter repositories on this page…"
              className="h-10 w-full rounded-lg border border-silver-200 bg-space-void pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
          <div aria-label="Available repositories" className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-silver-200 p-1">
            {repos.isLoading ? (
              <p role="status" className="flex items-center gap-2 p-4 text-xs text-silver-600"><LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />Loading repositories…</p>
            ) : repos.isError ? (
              <div role="alert" className="space-y-3 p-4 text-xs text-silver-600">
                <p>{errorMessage(repos.error, "Couldn't load your repositories.")}</p>
                <button type="button" className={githubButtonClass} onClick={() => void repos.refetch()}>Try again</button>
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-xs text-silver-600">{search ? "No matches on this page. Clear the filter or try another page." : "No accessible repositories on this page."}</p>
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
                <span className="min-w-0 flex-1 break-all">{repo.fullName}<span className="mt-1 block text-[10px] text-silver-600">{repo.archived ? "Archived" : repo.canAdmin ? "Admin access" : repo.canPush ? "Write access" : "Read access"}</span></span>
                {repo.fullName === currentRepo && <span className="ml-auto shrink-0 text-silver-600">Linked</span>}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-silver-600"><span>Page {page} · Latest activity</span><div className="flex gap-2"><button className={githubButtonClass} disabled={page === 1 || repos.isFetching || link.isPending} onClick={() => { setPage(page - 1); setSelected(null); }}>Previous</button><button className={githubButtonClass} disabled={!repos.data?.hasNext || repos.isFetching || repos.isError || link.isPending} onClick={() => { setPage(page + 1); setSelected(null); }}>Next</button></div></div>
          <p className="text-xs leading-relaxed text-silver-600">Includes repositories available to this GitHub connection. Missing organization repositories may require organization approval or SSO authorization on GitHub. Read access allows linking; pushing requires write access.</p>
          {link.isError && <p role="alert" className="text-xs text-red-400">{errorMessage(link.error, "Couldn't link repository. Try again.")}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild><button type="button" disabled={link.isPending} className={githubButtonClass}>Cancel</button></DialogClose>
          <button
            type="button"
            disabled={disabled || !selected || link.isPending || repos.isError || repos.isFetching}
            className={cn(githubButtonClass, githubPrimaryClass)}
            onClick={() => selected && link.mutate(selected, { onSuccess: () => { setOpen(false); setSelected(null); setSearch(""); setPage(1); setAffiliation("all"); } })}
          >
            {link.isPending && <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" />}
            {link.isPending ? "Linking…" : "Link repository"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
