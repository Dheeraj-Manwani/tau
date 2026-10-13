import { useState } from "react";
import { ExternalLinkIcon, LoaderCircleIcon, Unlink2Icon } from "lucide-react";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/src/components/ui/dialog";
import { cn } from "@/src/lib/utils";
import { GithubMark } from "@/src/components/ui/github-mark";
import { errorMessage, useDisconnectGithub, usePatchGithub, useUnlinkRepo, type GithubProjectInfo, type PushMode } from "./github";
import { GithubCreateRepository } from "./GithubCreateRepository";
import { githubButtonClass, githubCardClass } from "./githubStyles";
import { GithubVisibilitySettings } from "./GithubVisibilitySettings";

export function GithubSettings({ projectId, info, blocked }: {
  projectId: string;
  info: GithubProjectInfo;
  blocked: boolean;
}) {
  const patch = usePatchGithub(projectId);
  const unlink = useUnlinkRepo(projectId);
  const disconnect = useDisconnectGithub();
  const [confirm, setConfirm] = useState<"unlink" | "disconnect" | null>(null);
  const [confirmRepo, setConfirmRepo] = useState<string | null>(null);
  const pending = unlink.isPending || disconnect.isPending;
  const error = confirm === "unlink" ? unlink.error : disconnect.error;
  const repo = info.repo;

  return (
    <div className="space-y-4">
      <section className={githubCardClass} aria-label="Push preference">
        <div className="p-5">
          <h2 className="text-sm font-medium">Push preference</h2>
          <p className="mt-1 text-xs leading-relaxed text-silver-600">Choose the default action for future pushes from this project.</p>
          <label htmlFor="github-push-mode" className="mt-5 block text-xs font-medium">Default push action</label>
          <select
            id="github-push-mode"
            value={info.pushMode}
            disabled={blocked || patch.isPending}
            onChange={(e) => patch.mutate({ pushMode: e.target.value as PushMode })}
            className="mt-2 h-10 w-full rounded-lg border border-silver-200 bg-space-void px-3 text-xs focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 sm:max-w-xs"
          >
            <option value="new_pr">Create a new pull request</option>
            <option value="update_pr">Update the last Tau pull request</option>
            <option value="direct">Commit to the default branch</option>
          </select>
          {patch.isPending && <p role="status" className="mt-2 text-xs text-silver-600">Saving preference…</p>}
          {patch.isError && <p role="alert" className="mt-2 text-xs text-red-400">{errorMessage(patch.error, "Couldn't save preference. Try again.")}</p>}
        </div>
      </section>
      <section className={cn(githubCardClass, "divide-y divide-silver-200")} aria-label="Repository settings">
        <div className="p-5">
          <h2 className="text-sm font-medium">Repository</h2>
          <p className="mt-1 break-all text-xs text-silver-600">{repo?.fullName ?? "No repository created"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!repo && <GithubCreateRepository projectId={projectId} disabled={blocked || pending} />}
            {repo && <a href={`${repo.htmlUrl}/settings`} target="_blank" rel="noopener noreferrer" className={githubButtonClass}>Settings on GitHub<ExternalLinkIcon className="size-3.5" /></a>}
          </div>
          {repo && <><p className="mt-3 text-xs text-silver-600">Your access: {repo.canAdmin ? "Admin" : repo.canPush ? "Write" : "Read"}{repo.archived && " · Archived"}</p><GithubVisibilitySettings key={repo.fullName} projectId={projectId} repo={repo} blocked={blocked || pending || patch.isPending} /></>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <h2 className="text-sm font-medium">Connected account</h2>
            <p className="mt-1 break-all text-xs text-silver-600">{info.username ? `@${info.username}` : "GitHub account connected"}</p>
          </div>
          <Dialog open={confirm === "disconnect" && confirmRepo === (repo?.fullName ?? null)} onOpenChange={(value) => { if (!pending) { setConfirm(value ? "disconnect" : null); setConfirmRepo(repo?.fullName ?? null); disconnect.reset(); } }}>
            <DialogTrigger asChild><button type="button" disabled={blocked || pending} className={githubButtonClass}><GithubMark className="size-3.5" />Disconnect account</button></DialogTrigger>
            <DialogContent className="border-silver-200 bg-space-surface text-silver-900 motion-reduce:animate-none" showCloseButton={!pending}>
              <DialogHeader>
                <DialogTitle>Disconnect GitHub?</DialogTitle>
                <DialogDescription className="text-silver-600">This disconnects your GitHub account from all Tau projects. Repositories and their history stay on GitHub. You can reconnect at any time.</DialogDescription>
              </DialogHeader>
              {!!error && <p role="alert" className="text-xs text-red-400">{errorMessage(error, "Couldn't disconnect GitHub. Try again.")}</p>}
              <DialogFooter>
                <DialogClose asChild><button disabled={pending} className={githubButtonClass}>Cancel</button></DialogClose>
                <button disabled={blocked || pending} className={cn(githubButtonClass, "text-red-400")} onClick={() => disconnect.mutate(undefined, { onSuccess: () => setConfirm(null) })}>
                  {pending && <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" />}{pending ? "Disconnecting…" : "Disconnect GitHub"}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>
      {repo && <section className={cn(githubCardClass, "p-5")} aria-label="Last confirmed push"><h2 className="text-sm font-medium">Last confirmed push</h2>{info.lastPush ? <div className="mt-3 space-y-2 text-xs text-silver-600"><p><time dateTime={info.lastPush.at}>{new Date(info.lastPush.at).toLocaleString()}</time></p><p className="break-all">Branch <span className="font-mono text-silver-900">{info.lastPush.branch}</span></p><a href={info.lastPush.commitUrl} target="_blank" rel="noopener noreferrer" className={githubButtonClass}>View commit {info.lastPush.commitSha.slice(0, 7)}<ExternalLinkIcon className="size-3.5" /></a></div> : <p className="mt-2 text-xs leading-relaxed text-silver-600">No confirmed push has been recorded by Tau. Earlier pushes may not have tracking metadata.</p>}</section>}
      {repo && (
        <section className={cn(githubCardClass, "flex flex-wrap items-center justify-between gap-3 p-5")} aria-label="Unlink repository">
          <div className="min-w-0">
            <h2 className="text-sm font-medium">Unlink repository</h2>
            <p className="mt-1 text-xs text-silver-600">Remove this project's repository association.</p>
          </div>
          <Dialog open={confirm === "unlink" && confirmRepo === repo.fullName} onOpenChange={(value) => { if (!pending) { setConfirm(value ? "unlink" : null); setConfirmRepo(repo.fullName); unlink.reset(); } }}>
            <DialogTrigger asChild><button type="button" disabled={blocked || pending} className={cn(githubButtonClass, "text-red-400")}><Unlink2Icon className="size-3.5" />Unlink repository</button></DialogTrigger>
            <DialogContent className="border-silver-200 bg-space-surface text-silver-900 motion-reduce:animate-none" showCloseButton={!pending}>
              <DialogHeader>
                <DialogTitle>Unlink repository?</DialogTitle>
                <DialogDescription className="break-words text-silver-600">This detaches {repo.fullName} from the project and resets its push and pull request association. The repository and its history stay on GitHub.</DialogDescription>
              </DialogHeader>
              {!!error && <p role="alert" className="text-xs text-red-400">{errorMessage(error, "Couldn't unlink repository. Try again.")}</p>}
              <DialogFooter>
                <DialogClose asChild><button disabled={pending} className={githubButtonClass}>Cancel</button></DialogClose>
                <button disabled={blocked || pending} className={cn(githubButtonClass, "text-red-400")} onClick={() => unlink.mutate(undefined, { onSuccess: () => setConfirm(null) })}>
                  {pending && <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" />}{pending ? "Unlinking…" : "Unlink repository"}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      )}
    </div>
  );
}
