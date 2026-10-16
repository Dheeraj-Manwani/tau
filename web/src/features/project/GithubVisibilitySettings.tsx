import { useEffect, useRef, useState } from "react";
import { GlobeIcon, LoaderCircleIcon, LockIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/src/components/ui/dialog";
import { cn } from "@/src/lib/utils";
import { errorMessage, usePatchGithub, type RepoSummary } from "./github";
import { githubButtonClass, githubPrimaryClass } from "./githubStyles";

export function GithubVisibilitySettings({ projectId, repo, blocked }: { projectId: string; repo: RepoSummary; blocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const patch = usePatchGithub(projectId);
  const input = useRef<HTMLInputElement>(null);
  const makePrivate = repo.visibility !== "private";
  const pending = patch.isPending;
  useEffect(() => { if (patch.isError) input.current?.focus(); }, [patch.isError]);
  const close = () => { if (!pending) { setOpen(false); setConfirmation(""); patch.reset(); } };
  return <div className="mt-5 space-y-3 border-t border-line pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-xs font-medium">Repository visibility</h3><p className="mt-1 text-xs text-silver-600">{repo.visibility === "private" ? "Private" : repo.visibility === "internal" ? "Internal" : "Public"}{repo.archived && " · Archived"}</p></div>
      <Dialog open={open} onOpenChange={(value) => { if (pending) return; if (value) setOpen(true); else close(); }}>
        <DialogTrigger asChild><button disabled={blocked || !repo.canChangeVisibility || pending} className={githubButtonClass}>{makePrivate ? <LockIcon className="size-3.5" /> : <GlobeIcon className="size-3.5" />}Make {makePrivate ? "private" : "public"}</button></DialogTrigger>
        <DialogContent className="motion-reduce:animate-none" showCloseButton={!pending} onEscapeKeyDown={(e) => { if (pending) e.preventDefault(); }} onInteractOutside={(e) => { if (pending) e.preventDefault(); }}>
          <DialogHeader><DialogTitle>Make repository {makePrivate ? "private" : "public"}?</DialogTitle><DialogDescription className="break-words text-xs leading-relaxed text-silver-600">{makePrivate ? "Access to this repository will be restricted. Existing public forks remain public, and some GitHub features may change." : "Anyone will be able to see this repository's files, commit history and Actions logs. Review them for sensitive information before making it public."} This changes {repo.fullName} on GitHub.</DialogDescription></DialogHeader>
          <a href="https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline">Review GitHub's visibility effects</a>
          <label className="block text-xs">Type <span className="break-all font-mono font-medium">{repo.fullName}</span> to confirm<input ref={input} autoFocus aria-label="Confirm repository name" value={confirmation} disabled={pending} onChange={(e) => setConfirmation(e.target.value)} className="mt-2 w-full rounded-lg border border-line bg-space-void px-3 py-2.5 text-xs outline-ring" /></label>
          {patch.isError && <p role="alert" className="text-xs leading-relaxed text-red-400">{errorMessage(patch.error, "Couldn't confirm the visibility change.")} Close and refresh GitHub to check the current visibility before trying again.</p>}
          {(blocked || !repo.canChangeVisibility) && <p role="alert" className="text-xs text-orange-400">Refresh GitHub before changing visibility.</p>}
          <DialogFooter><button className={githubButtonClass} disabled={pending} onClick={close}>Cancel</button><button disabled={blocked || !repo.canChangeVisibility || pending || patch.isError || confirmation.trim() !== repo.fullName} className={cn(githubButtonClass, githubPrimaryClass)} onClick={() => patch.mutate({ repo: repo.fullName, private: makePrivate }, { onSuccess: () => { setOpen(false); setConfirmation(""); } })}>{pending && <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" />}{pending ? "Changing visibility…" : `Make ${makePrivate ? "private" : "public"}`}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    <p className="text-[11px] leading-relaxed text-silver-600">{repo.canChangeVisibility ? "Admin access verified. GitHub organization policies may still restrict visibility changes." : repo.visibilityReason ?? "Repository admin access is required to change visibility."}</p>
  </div>;
}
