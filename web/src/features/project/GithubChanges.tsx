import { useRef, useState } from "react";
import { ChevronRightIcon, FileDiffIcon, LoaderCircleIcon, RefreshCwIcon, SearchIcon, UploadIcon } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { errorMessage, useGithubChanges, useGithubDiff, type GithubComparison, type GithubFileChange, type GithubProjectInfo, type PushMode } from "./github";
import { githubButtonClass, githubCardClass, githubPrimaryClass } from "./githubStyles";
import { githubBytes, githubPatchLines } from "./githubDiffPresentation";

import { useSearchParams } from "react-router-dom";
import { selectedGithubPr } from "./toolNavigation";
import { githubPullRequests } from "./githubPresentation";
import { GithubPushDialog } from "./GithubPushDialog";

const statusStyles = {
  added: "bg-emerald-500/10 text-emerald-500",
  modified: "bg-blue-500/10 text-blue-500",
  deleted: "bg-red-500/10 text-red-500",
};

export function GithubChanges({ projectId, info, blocked }: { projectId: string; info: GithubProjectInfo; blocked: boolean }) {
  const [params] = useSearchParams();
  const prs = githubPullRequests(info).filter((pr) => pr.canUpdate);
  const selected = selectedGithubPr(params);
  const [mode, setMode] = useState<PushMode>(selected ? "update_pr" : info.pushMode);
  const [prNumber, setPrNumber] = useState<number | undefined>(selected ?? prs[0]?.number);
  const [review, setReview] = useState<GithubComparison | null>(null);
  const pushButton = useRef<HTMLButtonElement>(null);
  const section = useRef<HTMLElement>(null);
  const [deletions, setDeletions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const query = useGithubChanges(projectId, info.repo!.fullName, mode, deletions, !blocked && (mode !== "update_pr" || !!prNumber), mode === "update_pr" ? prNumber : undefined);
  const comparison = query.data;
  const files = comparison?.files.filter((file) => file.path.toLowerCase().includes(search.toLowerCase())) ?? [];

  return (
    <>
    <section ref={section} tabIndex={-1} className={cn(githubCardClass, "min-w-0 overflow-hidden outline-ring")} aria-label="Project changes">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-silver-200 p-5">
        <div>
          <h2 className="text-sm font-medium">Project changes</h2>
          <p className="mt-1 text-xs text-silver-600">Compare your Tau files with GitHub before pushing.</p>
        </div>
        <button ref={pushButton} type="button" disabled={blocked || query.isFetching || query.isError || query.isPlaceholderData || !comparison?.counts.total || !comparison.canPush} onClick={() => comparison && setReview(comparison)} className={cn(githubButtonClass, githubPrimaryClass)} aria-describedby="github-push-note"><UploadIcon className="size-3.5" />Push changes</button>
      </div>
      <div className="space-y-3 border-b border-silver-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-silver-600">
            Compare for
            <select aria-label="Comparison target" value={mode} disabled={blocked || query.isFetching} onChange={(e) => { setMode(e.target.value as PushMode); setDeletions([]); }} className="max-w-full rounded-lg border border-silver-200 bg-space-void px-3 py-2 text-xs text-silver-900 outline-ring">
              <option value="new_pr">New pull request</option>
              <option value="update_pr" disabled={!prs.length}>Update a pull request</option>
              <option value="direct">Direct commit to {info.repo!.defaultBranch}</option>
            </select>
          </label>
          {mode === "update_pr" && <label className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-silver-600">Pull request
            <select aria-label="Pull request to update" value={prNumber ?? ""} disabled={blocked || query.isFetching} onChange={(e) => { setPrNumber(Number(e.target.value)); setDeletions([]); }} className="max-w-full rounded-lg border border-silver-200 bg-space-void px-3 py-2 text-xs text-silver-900 outline-ring">
              {!prs.some((pr) => pr.number === prNumber) && <option value={prNumber ?? ""}>{prNumber ? `#${prNumber} · Check availability` : "Choose a pull request"}</option>}
              {prs.map((pr) => <option key={pr.number} value={pr.number}>#{pr.number} · {pr.title}</option>)}
            </select>
          </label>}
          <button type="button" disabled={blocked || query.isFetching} onClick={() => void query.refetch()} className={githubButtonClass} aria-label="Refresh comparison"><RefreshCwIcon className={cn("size-3.5", query.isFetching && "animate-spin motion-reduce:animate-none")} /><span>Refresh</span></button>
        </div>
        {comparison && !query.isError && <p className="break-all text-[11px] text-silver-600">Comparing with <span className="font-mono text-silver-900">{comparison.branch}</span> at <span className="font-mono">{comparison.headSha.slice(0, 7)}</span>{query.isFetching && " · Refreshing…"}</p>}
        <p id="github-push-note" className="text-[11px] leading-relaxed text-silver-600">{comparison?.canPush === false ? "Your account has read-only access. Ask a repository owner for write access to push." : "Review the files, then compose your push. Repository-only files are preserved unless you select their deletion."}</p>
      </div>
      {blocked ? <div role="alert" className="p-5 text-xs text-silver-600">Refresh GitHub above to check your connection before comparing files.</div> : mode === "update_pr" && !prNumber ? <p className="p-5 text-xs text-silver-600">Choose an open pull request to compare its changes.</p> : query.isError ? (
        <div role="alert" className="space-y-3 p-5 text-xs">
          <p>{errorMessage(query.error, "Couldn't compare files with GitHub.")}</p>
          <div className="flex flex-wrap gap-2"><button type="button" className={githubButtonClass} onClick={() => void query.refetch()}>Try again</button>{deletions.length > 0 && <button type="button" className={githubButtonClass} onClick={() => setDeletions([])}>Clear deletion selection</button>}</div>
        </div>
      ) : !comparison ? <div role="status" className="flex items-center gap-3 p-6 text-xs text-silver-600"><LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />Comparing project files…</div> : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-silver-200 p-5">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="mr-1 font-medium text-silver-900">{comparison.counts.total} {comparison.counts.total === 1 ? "file" : "files"} changed</span>
              <span className="text-emerald-500">{comparison.counts.added} added</span><span className="text-blue-500">{comparison.counts.modified} modified</span><span className="text-red-500">{comparison.counts.deleted} deleted</span>
            </div>
            {comparison.files.length > 0 && <label className="relative w-full sm:w-52"><SearchIcon aria-hidden="true" className="absolute left-3 top-2.5 size-3.5 text-silver-600" /><input aria-label="Filter changed files" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter files…" className="w-full rounded-lg border border-silver-200 bg-space-void py-2 pl-9 pr-3 text-xs outline-ring" /></label>}
          </div>
          {!comparison.files.length ? (
            <div className="px-6 py-10 text-center"><FileDiffIcon className="mx-auto mb-3 size-5 text-silver-600" /><h3 className="text-sm font-medium">No changes to review</h3><p className="mt-2 text-xs text-silver-600">Your included Tau files match this GitHub branch.</p></div>
          ) : files.length ? (
            <div className="divide-y divide-silver-200">{files.map((file) => <FileChangeRow key={`${comparison.preview}:${file.path}`} projectId={projectId} file={file} preview={comparison.preview} onRefresh={() => void query.refetch()} />)}</div>
          ) : <p className="p-6 text-center text-xs text-silver-600">No changed files match your search.</p>}
          {comparison.repositoryOnly.length > 0 && <details className="border-t border-silver-200 p-5">
            <summary className="cursor-pointer text-xs font-medium outline-ring">{comparison.repositoryOnly.length} repository-only {comparison.repositoryOnly.length === 1 ? "file" : "files"}</summary>
            <p className="mb-3 mt-3 text-[11px] leading-relaxed text-silver-600">These files are absent from Tau and are preserved by default. Select a file only if you want to review its deletion. This selection does not delete anything.</p>
            <div className="max-h-52 space-y-2 overflow-y-auto">{comparison.repositoryOnly.map((file) => <label key={file.path} className="flex items-start gap-2 text-xs">
              <input type="checkbox" aria-label={`Review deletion of ${file.path}`} checked={deletions.includes(file.path)} disabled={query.isFetching || (deletions.length >= 100 && !deletions.includes(file.path))} onChange={(e) => setDeletions((paths) => e.target.checked ? [...paths, file.path] : paths.filter((p) => p !== file.path))} className="mt-0.5 accent-blue-500" />
              <span className="min-w-0 flex-1 break-all font-mono text-[11px]">{file.path}</span><span className="shrink-0 text-[10px] text-silver-600">{githubBytes(file.sizeBytes)}</span>
            </label>)}</div>
            {deletions.length >= 100 && <p className="mt-3 text-[11px] text-silver-600">Review up to 100 deletions at a time.</p>}
          </details>}
          {comparison.excludedCount > 0 && <p className="border-t border-silver-200 px-5 py-3 text-[11px] text-silver-600">{comparison.excludedCount} {comparison.excludedCount === 1 ? "file is" : "files are"} excluded by credential rules or .gitignore.</p>}
        </>
      )}
    </section>
    {review && <GithubPushDialog projectId={projectId} review={review} pr={prs.find((pr) => pr.number === review.prNumber)} unavailable={blocked || query.isFetching || query.isError || !comparison?.canPush || comparison.preview !== review.preview} onClose={() => setReview(null)} onClosedFocus={() => { if (pushButton.current && !pushButton.current.disabled) pushButton.current.focus(); else section.current?.focus(); }} onRefresh={() => void query.refetch()} />}
    </>
  );
}

function FileChangeRow({ projectId, file, preview, onRefresh }: { projectId: string; file: GithubFileChange; preview: string; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="group min-w-0" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-5 py-4 text-xs transition-colors hover:bg-space-overlay focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        <ChevronRightIcon aria-hidden="true" className="size-3.5 shrink-0 text-silver-600 group-open:rotate-90" />
        <span className="min-w-0 flex-1 break-all font-mono text-[11px]">{file.path}</span>
        <span className="shrink-0 text-[10px] text-silver-600">{file.kind === "text" ? `${githubBytes(file.beforeBytes)} → ${githubBytes(file.afterBytes)}` : file.kind === "binary" ? "Binary" : "Large file"}</span>
        <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] capitalize", statusStyles[file.status])}>{file.status}</span>
      </summary>
      {open && <FileDiff projectId={projectId} preview={preview} path={file.path} onRefresh={onRefresh} />}
    </details>
  );
}

function FileDiff({ projectId, preview, path, onRefresh }: { projectId: string; preview: string; path: string; onRefresh: () => void }) {
  const query = useGithubDiff(projectId, preview, path, true);
  if (query.isError) return <div role="alert" className="space-y-3 border-t border-silver-200 p-5 text-xs"><p>{errorMessage(query.error, "Couldn't load this diff.")}</p><div className="flex flex-wrap gap-2"><button className={githubButtonClass} onClick={() => void query.refetch()}>Retry diff</button><button className={githubButtonClass} onClick={onRefresh}>Refresh file list</button></div><p className="text-silver-600">If files or the branch changed, refresh the comparison.</p></div>;
  if (!query.data || query.isFetching) return <div role="status" className="flex items-center gap-2 border-t border-silver-200 p-5 text-xs text-silver-600"><LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" />Loading diff…</div>;
  const diff = query.data;
  if (diff.kind !== "text" || diff.patch === null) return <p className="border-t border-silver-200 p-5 text-xs text-silver-600">{diff.kind === "binary" ? "Binary file changed. A text diff isn't available." : "This change is too large for an inline diff. Review the file in the code editor or on GitHub."}</p>;
  return <div className="min-w-0 border-t border-silver-200">
    <p className="flex gap-3 px-5 py-2 text-[11px]"><span className="text-emerald-500">+{diff.additions} lines</span><span className="text-red-500">−{diff.deletions} lines</span></p>
    <div role="region" aria-label={`Diff for ${path}`} tabIndex={0} className="max-h-96 overflow-auto border-t border-silver-200 bg-space-void font-mono text-[11px] leading-5 outline-ring">
      <div className="min-w-max">{githubPatchLines(diff.patch).map((line, index) => <div key={index} className={cn("flex pr-4", line.kind === "added" && "bg-emerald-500/10 text-emerald-400", line.kind === "removed" && "bg-red-500/10 text-red-400", line.kind === "header" && "bg-blue-500/5 text-silver-600")}>
        <span aria-hidden="true" className="w-10 shrink-0 select-none pr-2 text-right text-silver-500">{line.before}</span><span aria-hidden="true" className="w-10 shrink-0 select-none pr-2 text-right text-silver-500">{line.after}</span><span className="whitespace-pre">{line.text}</span>
      </div>)}</div>
    </div>
  </div>;
}
