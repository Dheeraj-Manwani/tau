import { useEffect, useRef, useState } from "react";
import { ArrowUpRightIcon, GitBranchIcon, GitPullRequestIcon, LoaderCircleIcon, UploadIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { cn } from "@/src/lib/utils";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { errorMessage, usePushToGithub, type GithubComparison, type PrSummary, type PushResult } from "./github";
import { githubButtonClass, githubPrimaryClass } from "./githubStyles";

const inputClass = "mt-2 w-full rounded-lg border border-silver-200 bg-space-void px-3 py-2.5 text-xs text-silver-900 outline-ring disabled:opacity-50";

export function GithubPushDialog({ projectId, review, pr, unavailable, onClose, onClosedFocus, onRefresh }: {
  projectId: string;
  review: GithubComparison;
  pr?: PrSummary;
  unavailable: boolean;
  onClose: () => void;
  onClosedFocus: () => void;
  onRefresh: () => void;
}) {
  const update = review.mode === "update_pr";
  const direct = review.mode === "direct";
  const [title, setTitle] = useState(update ? pr?.title ?? "Update from Tau" : "");
  const [description, setDescription] = useState(update ? pr?.body ?? "" : "");
  const [draft, setDraft] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);
  const push = usePushToGithub(projectId);
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (push.isError) titleInput.current?.focus(); }, [push.isError]);
  const sequence = useProjectStore((s) => s.projectId === projectId ? s.headSequence : null);
  const stale = unavailable || (sequence !== null && sequence !== review.localSequence);
  const invalid = !title.trim() || title.trim().length > 200 || description.trim().length > 5000;
  const label = direct ? `Commit to ${review.branch}` : update ? `Update PR #${review.prNumber}` : "Create pull request";
  const close = () => { if (!push.isPending) onClose(); };

  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent className="border-silver-200 bg-space-surface text-silver-900 sm:max-w-xl motion-reduce:animate-none" showCloseButton={!push.isPending} onEscapeKeyDown={(e) => { if (push.isPending) e.preventDefault(); }} onInteractOutside={(e) => { if (push.isPending) e.preventDefault(); }} onCloseAutoFocus={(e) => { e.preventDefault(); onClosedFocus(); }}>
      <DialogHeader>
        <DialogTitle>{result ? result.warning ? "Check your push on GitHub" : "Changes pushed" : direct ? "Commit reviewed changes" : update ? "Update pull request" : "New pull request"}</DialogTitle>
        <DialogDescription className="text-xs text-silver-600">{result ? "Your GitHub result and next steps." : `${review.counts.total} reviewed ${review.counts.total === 1 ? "file" : "files"} in ${review.repo}.`}</DialogDescription>
      </DialogHeader>
      {result ? <div className="space-y-4 text-xs">
        <p className="break-all rounded-lg border border-silver-200 bg-space-void p-3 font-mono text-[11px]">{result.branch}</p>
        {result.warning ? <p role="alert" className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 leading-relaxed text-silver-900">{result.warning}</p> : <p className="text-silver-600">{result.prUrl ? `Pull request #${result.prNumber} is ready on GitHub.` : `Your reviewed changes were committed to ${result.branch}.`}</p>}
        <div className="flex flex-wrap gap-2">
          {result.prUrl && <a href={result.prUrl} target="_blank" rel="noopener noreferrer" className={cn(githubButtonClass, githubPrimaryClass)}>View pull request<ArrowUpRightIcon className="size-3.5" /></a>}
          {result.commitUrl && <a href={result.commitUrl} target="_blank" rel="noopener noreferrer" className={githubButtonClass}>View commit<ArrowUpRightIcon className="size-3.5" /></a>}
          {!result.prUrl && !direct && <a href={`${result.repoUrl}/compare/${encodeURIComponent(result.branch)}?expand=1`} target="_blank" rel="noopener noreferrer" className={githubButtonClass}>Open branch on GitHub<ArrowUpRightIcon className="size-3.5" /></a>}
        </div>
        <DialogFooter><button type="button" onClick={close} className={githubButtonClass}>Done</button></DialogFooter>
      </div> : <form className="space-y-5" onSubmit={async (e) => {
        e.preventDefault();
        if (push.isPending || stale || invalid) return;
        try { setResult(await push.mutateAsync({ title: title.trim(), description: description.trim(), mode: review.mode, preview: review.preview, prNumber: review.prNumber, ...(review.mode === "new_pr" ? { draft } : {}) })); } catch { /* The mutation error remains visible beside the preserved draft. */ }
      }}>
        <div className="space-y-3 rounded-lg border border-silver-200 bg-space-void p-4 text-xs">
          <p className="flex items-start gap-2"><GitBranchIcon className="mt-0.5 size-3.5 shrink-0 text-silver-600" /><span className="break-all font-mono text-[11px]">{review.branch}<span className="text-silver-600"> · {review.headSha.slice(0, 7)}</span></span></p>
          <p className="flex flex-wrap gap-3 text-[11px]"><span className="text-emerald-500">{review.counts.added} added</span><span className="text-blue-500">{review.counts.modified} modified</span><span className="text-red-500">{review.counts.deleted} deleted</span></p>
          <p className="text-[11px] leading-relaxed text-silver-600">{direct ? `This commits directly to ${review.branch}. GitHub branch rules still apply.` : update ? `The reviewed files will be pushed to PR #${review.prNumber}'s existing branch. Its title and description will also be updated.` : `A new Tau branch and pull request will be created against ${review.branch}.`}</p>
          {!!review.counts.deleted && <details><summary className="cursor-pointer text-[11px] text-red-400">{review.counts.deleted} selected {review.counts.deleted === 1 ? "deletion" : "deletions"} included</summary><ul className="mt-2 max-h-24 space-y-1 overflow-y-auto font-mono text-[11px]">{review.files.filter((file) => file.status === "deleted").map((file) => <li key={file.path} className="break-all">{file.path}</li>)}</ul></details>}
        </div>
        <label className="block text-xs font-medium">{direct ? "Commit title" : "Pull request title"}<input ref={titleInput} autoFocus required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} disabled={push.isPending} placeholder={direct ? "Describe your changes" : "What does this change do?"} className={inputClass} /></label>
        <label className="block text-xs font-medium">Description <span className="font-normal text-silver-600">(optional)</span><textarea rows={4} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} disabled={push.isPending} placeholder="Add context for your changes…" className={cn(inputClass, "resize-y")} /></label>
        {review.mode === "new_pr" && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} disabled={push.isPending} className="accent-blue-500" /><GitPullRequestIcon className="size-3.5 text-silver-600" />Create as draft</label>}
        {update && pr?.draft && <p className="text-[11px] text-silver-600">This pull request stays a draft.</p>}
        {stale && <p role="alert" className="text-xs leading-relaxed text-amber-500">The comparison changed or is unavailable. Close this dialog and review the refreshed files before pushing.</p>}
        {push.isError && <p role="alert" className="text-xs leading-relaxed text-red-400">{errorMessage(push.error, "Couldn't push. Refresh the comparison before trying again.")}</p>}
        <DialogFooter>
          <button type="button" disabled={push.isPending} onClick={() => { close(); if (push.isError || stale) onRefresh(); }} className={githubButtonClass}>{push.isError || stale ? "Close and refresh" : "Cancel"}</button>
          <button type="submit" disabled={push.isPending || stale || invalid || push.isError} className={cn(githubButtonClass, githubPrimaryClass)}>{push.isPending ? <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" /> : <UploadIcon className="size-3.5" />}{push.isPending ? "Pushing reviewed changes…" : label}</button>
        </DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>;
}
