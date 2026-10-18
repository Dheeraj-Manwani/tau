import { useEffect, useRef, useState } from "react";
import { ArrowUpRightIcon, CircleDotIcon, ExternalLinkIcon, GitPullRequestIcon, LoaderCircleIcon, PlusIcon, RefreshCwIcon, WrenchIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/src/components/ui/dialog";
import { cn } from "@/src/lib/utils";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { useSendMessage } from "./useSendMessage";
import { errorMessage, type GithubProjectInfo, type PrSummary } from "./github";
import { githubPrState } from "./githubPresentation";
import { useProjectToolNavigation } from "./toolNavigation";
import { githubButtonClass, githubCardClass, githubPrimaryClass } from "./githubStyles";
import { githubIssuePrompt, githubResultState, githubSafeLink, useCreateGithubIssue, useGithubIssueDetail, useGithubIssues, useGithubPullDetail, useGithubPulls, type GithubCheck, type GithubDetailSection, type GithubIssue, type GithubIssueResult, type GithubListState, type GithubReview } from "./githubCollaboration";

const dialogClass = "sm:max-w-xl motion-reduce:animate-none";

function PageControls({ page, hasNext, busy, onPage }: { page: number; hasNext: boolean; busy: boolean; onPage: (page: number) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[11px]">
    <span className="text-silver-600">Page {page} · Sorted by latest activity</span>
    <div className="flex gap-2"><button className={githubButtonClass} disabled={busy || page === 1} onClick={() => onPage(page - 1)}>Previous</button><button className={githubButtonClass} disabled={busy || !hasNext} onClick={() => onPage(page + 1)}>Next</button></div>
  </div>;
}
function StateFilter({ state, busy, onChange }: { state: GithubListState; busy: boolean; onChange: (state: GithubListState) => void }) {
  return <select aria-label="Filter by state" value={state} disabled={busy} onChange={(e) => onChange(e.target.value as GithubListState)} className="rounded-lg border border-line bg-space-void px-3 py-2 text-xs text-silver-900 outline-ring"><option value="open">Open</option><option value="closed">Closed</option><option value="all">All</option></select>;
}
export function GithubListLoading({ children }: { children: string }) { return <p role="status" className="flex items-center gap-2 p-5 text-xs text-silver-600"><LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" />{children}</p>; }
export function GithubListLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) { return <div role="alert" className="space-y-3 p-5 text-xs"><p>{errorMessage(error, "GitHub could not load these results.")}</p><button className={githubButtonClass} onClick={onRetry}>Try again</button></div>; }

export function GithubPullRequests({ projectId, info, blocked }: { projectId: string; info: GithubProjectInfo; blocked: boolean }) {
  const [state, setState] = useState<GithubListState>("open");
  const [page, setPage] = useState(1);
  const query = useGithubPulls(projectId, info.repo!.fullName, state, page, !blocked);
  return <section className={githubCardClass} aria-label="Repository pull requests">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
      <div><h2 className="text-sm font-medium">Pull requests</h2><p className="mt-1 text-xs text-silver-600">Review changes, feedback, and checks.</p></div>
      <div className="flex flex-wrap gap-2"><StateFilter state={state} busy={blocked || query.isFetching} onChange={(value) => { setState(value); setPage(1); }} /><button aria-label="Refresh pull requests" className={githubButtonClass} disabled={blocked || query.isFetching} onClick={() => void query.refetch()}><RefreshCwIcon className="size-3.5" /></button><a href={`${info.repo!.htmlUrl}/pulls`} target="_blank" rel="noopener noreferrer" className={githubButtonClass}>GitHub<ExternalLinkIcon className="size-3.5" /></a></div>
    </div>
    {blocked ? <p role="alert" className="p-5 text-xs text-silver-600">Refresh GitHub above before loading pull requests.</p> : query.isError ? <GithubListLoadError error={query.error} onRetry={() => void query.refetch()} /> : !query.data ? <GithubListLoading>Loading pull requests…</GithubListLoading> : query.data.items.length ? <div className="divide-y divide-line">{query.data.items.map((pr) => <PullRequestRow key={pr.number} projectId={projectId} repo={info.repo!.fullName} pr={pr} blocked={blocked} />)}</div> : <p className="px-6 py-10 text-center text-xs text-silver-600">No {state === "all" ? "" : `${state} `}pull requests on this page.</p>}
    <PageControls page={page} hasNext={query.data?.hasNext ?? false} busy={blocked || query.isFetching} onPage={setPage} />
  </section>;
}

function PullRequestRow({ projectId, repo, pr, blocked }: { projectId: string; repo: string; pr: PrSummary; blocked: boolean }) {
  const [open, setOpen] = useState(false);
  const state = githubPrState(pr);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button className="flex min-h-20 w-full items-start gap-3 p-5 text-left transition-colors hover:bg-space-overlay focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"><GitPullRequestIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-silver-600" /><span className="min-w-0 flex-1"><span className="block break-words text-xs font-medium">{pr.title}</span><span className="mt-1 block text-[11px] text-silver-600">#{pr.number}{pr.author && ` · @${pr.author}`}</span></span><span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", state.className)}>{state.label}</span></button></DialogTrigger>
    <DialogContent className={dialogClass}>
      <DialogHeader><DialogTitle className="font-sans text-base font-semibold break-words normal-case">{pr.title}</DialogTitle><DialogDescription className="text-xs text-silver-600">Pull request #{pr.number} · {state.label}</DialogDescription></DialogHeader>
      {open && <PullRequestDetail projectId={projectId} repo={repo} number={pr.number} blocked={blocked} fallbackUrl={pr.url} />}
    </DialogContent>
  </Dialog>;
}

function PullRequestDetail({ projectId, repo, number, blocked, fallbackUrl }: { projectId: string; repo: string; number: number; blocked: boolean; fallbackUrl: string }) {
  const query = useGithubPullDetail(projectId, repo, number, !blocked);
  const openTool = useProjectToolNavigation();
  const detail = query.data;
  return <div className="min-w-0 space-y-4 text-xs">
    {blocked ? <p role="alert">Refresh GitHub before reviewing this pull request.</p> : query.isError ? <GithubListLoadError error={query.error} onRetry={() => void query.refetch()} /> : !detail || query.isFetching ? <GithubListLoading>Loading reviews and checks…</GithubListLoading> : <>
      <p className="break-all rounded-lg border border-line bg-space-void p-3 font-mono text-[11px]">{detail.pr.headBranch} &rarr; {detail.pr.baseBranch} · {detail.headSha.slice(0, 7)}</p>
      <p className="flex flex-wrap gap-3 text-[11px]"><span>{detail.files} files</span><span>{detail.commits} commits</span><span className="text-green-400">+{detail.additions}</span><span className="text-red-400">−{detail.deletions}</span></p>
      <div className="rounded-lg border border-line bg-space-void p-4"><h3 className="font-medium">Description</h3><p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-silver-600">{detail.pr.body || "No description provided."}</p></div>
      <ReviewResults section={detail.reviews} headSha={detail.headSha} />
      <CheckResults title="Checks" section={detail.checks} />
      <CheckResults title="Commit statuses" section={detail.statuses} />
      <p className="text-[11px] leading-relaxed text-silver-600">Results are for {detail.headSha.slice(0, 7)}. {detail.mergeable === false ? "GitHub reports merge conflicts." : detail.mergeable === null ? "GitHub is still checking merge conflicts." : "Review branch rules and merge requirements on GitHub."}</p>
    </>}
    <div className="flex flex-wrap gap-2">
      {detail?.pr.canUpdate && !blocked && !query.isFetching && !query.isError && <button className={cn(githubButtonClass, githubPrimaryClass)} onClick={() => openTool("github", "changes", false, number)}>Review changes for this PR</button>}
      <a href={githubSafeLink(detail?.pr.url ?? fallbackUrl)} target="_blank" rel="noopener noreferrer" className={githubButtonClass}>Open on GitHub<ArrowUpRightIcon className="size-3.5" /></a>
      <button aria-label="Refresh pull request details" className={githubButtonClass} disabled={blocked || query.isFetching} onClick={() => void query.refetch()}><RefreshCwIcon className="size-3.5" />Refresh</button>
    </div>
  </div>;
}

function ReviewResults({ section, headSha }: { section: GithubDetailSection<GithubReview>; headSha: string }) {
  return <div className="rounded-lg border border-line bg-space-void p-4"><h3 className="font-medium">Review history</h3>
    {!section.available ? <p className="mt-2 text-silver-600">{section.reason}</p> : !section.items.length ? <p className="mt-2 text-silver-600">No submitted reviews.</p> : <div className="mt-3 max-h-64 space-y-3 overflow-y-auto">{section.items.map((review) => { const state = githubResultState(review.state); return <div key={review.id} className="space-y-2 border-t border-line pt-3 first:border-0 first:pt-0"><p className="flex flex-wrap items-center justify-between gap-2"><a href={githubSafeLink(review.url)} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">@{review.author}</a><span className={cn("rounded-md px-2 py-0.5 text-[11px]", state.className)}>{state.label}</span></p>{review.body && <p className="whitespace-pre-wrap break-words leading-relaxed text-silver-600">{review.body}</p>}<p className="text-[11px] text-silver-600">{review.commitSha.slice(0, 7)}{review.commitSha !== headSha && " · Earlier commit"}{review.submittedAt && ` · ${new Date(review.submittedAt).toLocaleString()}`}</p></div>; })}</div>}
    {section.hasMore && <p className="mt-3 text-[11px] text-silver-600">Showing the first 100 reviews. Open on GitHub for the full history.</p>}
  </div>;
}
function CheckResults({ title, section }: { title: string; section: GithubDetailSection<GithubCheck> }) {
  return <div className="rounded-lg border border-line bg-space-void p-4"><h3 className="font-medium">{title}</h3>
    {!section.available ? <p className="mt-2 text-silver-600">{section.reason}</p> : !section.items.length ? <p className="mt-2 text-silver-600">No {title.toLowerCase()} reported for this commit.</p> : <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{section.items.map((check) => { const state = githubResultState(check.state); const url = githubSafeLink(check.url); return <div key={`${check.source}:${check.id}`} className="flex items-start justify-between gap-3"><span className="min-w-0 break-words">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">{check.name}<ArrowUpRightIcon className="ml-1 inline size-3" /></a> : check.name}</span><span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[11px]", state.className)}>{state.label}</span></div>; })}</div>}
    {section.hasMore && <p className="mt-3 text-[11px] text-silver-600">More results are available on GitHub.</p>}
  </div>;
}

export function GithubIssues({ projectId, info, blocked }: { projectId: string; info: GithubProjectInfo; blocked: boolean }) {
  const [state, setState] = useState<GithubListState>("open");
  const [page, setPage] = useState(1);
  const [create, setCreate] = useState(false);
  const createButton = useRef<HTMLButtonElement>(null);
  const query = useGithubIssues(projectId, info.repo!.fullName, state, page, !blocked);
  return <section className={githubCardClass} aria-label="Repository issues">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
      <div><h2 className="text-sm font-medium">Issues</h2><p className="mt-1 text-xs text-silver-600">Track work and bring a fix into Tau.</p></div>
      <div className="flex flex-wrap gap-2"><StateFilter state={state} busy={blocked || query.isFetching} onChange={(value) => { setState(value); setPage(1); }} /><button aria-label="Refresh issues" className={githubButtonClass} disabled={blocked || query.isFetching} onClick={() => void query.refetch()}><RefreshCwIcon className="size-3.5" /></button><button ref={createButton} className={cn(githubButtonClass, githubPrimaryClass)} disabled={blocked || query.isFetching || query.isError || !query.data?.canCreate} onClick={() => setCreate(true)}><PlusIcon className="size-3.5" />New issue</button></div>
    </div>
    {query.data?.disabledReason && <p className="border-b border-line px-5 py-3 text-xs text-silver-600">{query.data.disabledReason}</p>}
    {blocked ? <p role="alert" className="p-5 text-xs text-silver-600">Refresh GitHub above before loading issues.</p> : query.isError ? <GithubListLoadError error={query.error} onRetry={() => void query.refetch()} /> : !query.data ? <GithubListLoading>Loading issues…</GithubListLoading> : query.data.items.length ? <div className="divide-y divide-line">{query.data.items.map((issue) => <IssueRow key={issue.number} projectId={projectId} repo={info.repo!.fullName} issue={issue} blocked={blocked} />)}</div> : <p className="px-6 py-10 text-center text-xs text-silver-600">{query.data.hasNext ? "No issues on this page. Pull requests are omitted; continue to the next page." : `No ${state === "all" ? "" : `${state} `}issues on this page.`}</p>}
    <PageControls page={page} hasNext={query.data?.hasNext ?? false} busy={blocked || query.isFetching} onPage={setPage} />
    {create && <CreateIssueDialog projectId={projectId} repo={info.repo!.fullName} unavailable={blocked || query.isError || !query.data?.canCreate} onClose={() => setCreate(false)} onClosedFocus={() => createButton.current?.focus()} />}
  </section>;
}

function IssueRow({ projectId, repo, issue, blocked }: { projectId: string; repo: string; issue: GithubIssue; blocked: boolean }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button className="flex min-h-20 w-full items-start gap-3 p-5 text-left transition-colors hover:bg-space-overlay focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"><CircleDotIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-silver-600" /><span className="min-w-0 flex-1"><span className="block break-words text-xs font-medium">{issue.title}</span><span className="mt-1 block text-[11px] text-silver-600">#{issue.number} · @{issue.author}</span>{issue.labels.length > 0 && <span className="mt-2 flex flex-wrap gap-1">{issue.labels.map((label) => <span key={label} className="max-w-full break-words rounded-md border border-line px-1.5 py-0.5 text-[11px] text-silver-600">{label}</span>)}</span>}</span><span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", issue.state === "open" ? "bg-green-400/10 text-green-400" : "bg-blue-500/10 text-blue-500")}>{issue.state === "open" ? "Open" : "Closed"}</span></button></DialogTrigger>
    <DialogContent className={dialogClass}><DialogHeader><DialogTitle className="font-sans text-base font-semibold break-words normal-case">{issue.title}</DialogTitle><DialogDescription className="text-xs text-silver-600">Issue #{issue.number} · {repo}</DialogDescription></DialogHeader>{open && <IssueDetail projectId={projectId} repo={repo} number={issue.number} blocked={blocked} onAccepted={() => setOpen(false)} fallbackUrl={issue.url} />}</DialogContent>
  </Dialog>;
}
function IssueDetail({ projectId, repo, number, blocked, onAccepted, fallbackUrl }: { projectId: string; repo: string; number: number; blocked: boolean; onAccepted: () => void; fallbackUrl: string }) {
  const query = useGithubIssueDetail(projectId, repo, number, !blocked);
  const { send, canSend, isSending } = useSendMessage(projectId);
  const setChatOpen = useProjectStore((s) => s.setChatOpen);
  const issue = query.data?.issue;
  return <div className="space-y-4 text-xs">
    {blocked ? <p role="alert">Refresh GitHub before loading this issue.</p> : query.isError ? <GithubListLoadError error={query.error} onRetry={() => void query.refetch()} /> : !issue || query.isFetching ? <GithubListLoading>Loading issue description…</GithubListLoading> : <>
      <p className="text-[11px] text-silver-600">@{issue.author} · {issue.state === "open" ? "Open" : "Closed"} · {issue.comments} comments{issue.assignees.length > 0 && ` · Assigned to ${issue.assignees.map((name) => `@${name}`).join(", ")}`}</p>
      <div className="rounded-lg border border-line bg-space-void p-4"><h3 className="font-medium">Description</h3><p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-silver-600">{issue.body || "No description provided."}</p></div>
      <p className="text-[11px] leading-relaxed text-silver-600">Fix with Tau sends this issue's title, link, and fetched description to your project chat. {issue.body.length > 8000 && "The first 8,000 description characters will be sent. "}Changes stay in Tau for review.</p>
      {!canSend && !isSending && <p className="text-[11px] text-silver-600">Wait for Tau to finish the current task before starting a fix.</p>}
    </>}
    <div className="flex flex-wrap gap-2">
      <button className={cn(githubButtonClass, githubPrimaryClass)} disabled={blocked || !canSend || query.isFetching || query.isError || !issue || query.data?.repo !== repo || issue.state !== "open"} onClick={() => {
        if (!issue || !canSend || blocked || query.isError) return;
        send(githubIssuePrompt(repo, issue), { onAccepted: () => { onAccepted(); setChatOpen(true); } });
      }}>{isSending ? <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" /> : <WrenchIcon className="size-3.5" />}{isSending ? "Starting fix…" : "Fix with Tau"}</button>
      <a href={githubSafeLink(issue?.url ?? fallbackUrl)} target="_blank" rel="noopener noreferrer" className={githubButtonClass}>Open on GitHub<ArrowUpRightIcon className="size-3.5" /></a>
      <button aria-label="Refresh issue details" className={githubButtonClass} disabled={blocked || query.isFetching || isSending} onClick={() => void query.refetch()}><RefreshCwIcon className="size-3.5" />Refresh</button>
    </div>
  </div>;
}

function CreateIssueDialog({ projectId, repo, unavailable, onClose, onClosedFocus }: { projectId: string; repo: string; unavailable: boolean; onClose: () => void; onClosedFocus: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<GithubIssueResult | null>(null);
  const mutation = useCreateGithubIssue(projectId);
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (mutation.isError) titleInput.current?.focus(); }, [mutation.isError]);
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose(); }}><DialogContent className={dialogClass} showCloseButton={!mutation.isPending} onEscapeKeyDown={(e) => { if (mutation.isPending) e.preventDefault(); }} onInteractOutside={(e) => { if (mutation.isPending) e.preventDefault(); }} onCloseAutoFocus={(e) => { e.preventDefault(); onClosedFocus(); }}>
    <DialogHeader><DialogTitle>{result ? "Issue created" : "New issue"}</DialogTitle><DialogDescription className="text-xs text-silver-600">{result ? `Issue #${result.number} is ready on GitHub.` : `Create an issue in ${repo}.`}</DialogDescription></DialogHeader>
    {result ? <><a href={githubSafeLink(result.issueUrl)} target="_blank" rel="noopener noreferrer" className={cn(githubButtonClass, githubPrimaryClass)}>View issue<ArrowUpRightIcon className="size-3.5" /></a><DialogFooter><button className={githubButtonClass} onClick={onClose}>Done</button></DialogFooter></> : <form className="space-y-5" onSubmit={async (e) => { e.preventDefault(); if (mutation.isPending || mutation.isError || unavailable || !title.trim()) return; try { setResult(await mutation.mutateAsync({ repo, title: title.trim(), description: description.trim() })); } catch { /* Keep the draft and show the error. */ } }}>
      <label className="block text-xs font-medium">Issue title<input ref={titleInput} autoFocus required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} disabled={mutation.isPending} placeholder="Describe the bug or idea" className="mt-2 w-full rounded-lg border border-line bg-space-void px-3 py-2.5 text-xs outline-ring" /></label>
      <label className="block text-xs font-medium">Description <span className="font-normal text-silver-600">(optional)</span><textarea rows={6} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} disabled={mutation.isPending} placeholder="What happened, what you expected, and how to reproduce it…" className="mt-2 w-full resize-y rounded-lg border border-line bg-space-void px-3 py-2.5 text-xs outline-ring" /></label>
      {unavailable && <p role="alert" className="text-xs text-orange-400">Repository access changed. Close and refresh GitHub before creating the issue.</p>}
      {mutation.isError && <p role="alert" className="text-xs leading-relaxed text-red-400">{errorMessage(mutation.error, "Couldn't confirm issue creation. Check GitHub before creating another.")}</p>}
      <DialogFooter><button type="button" disabled={mutation.isPending} className={githubButtonClass} onClick={onClose}>Cancel</button><button type="submit" disabled={unavailable || !title.trim() || mutation.isPending || mutation.isError} className={cn(githubButtonClass, githubPrimaryClass)}>{mutation.isPending ? <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" /> : <PlusIcon className="size-3.5" />}{mutation.isPending ? "Creating issue…" : "Create issue"}</button></DialogFooter>
    </form>}
  </DialogContent></Dialog>;
}
