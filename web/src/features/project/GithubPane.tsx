import { useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs } from "radix-ui";
import {
  ArrowUpRightIcon, CircleDotIcon, ExternalLinkIcon, FileDiffIcon,
  GitBranchIcon, GitPullRequestIcon, GlobeIcon, InfoIcon,
  LoaderCircleIcon, LockIcon, PlusIcon, RefreshCwIcon, Settings2Icon, UploadIcon,
} from "lucide-react";
import { GithubMark } from "@/src/components/ui/github-mark";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/src/components/ui/dialog";
import { startGithubConnect } from "@/src/features/auth/github";
import { cn } from "@/src/lib/utils";
import { ToolPaneContent } from "./ToolPaneContent";
import { useGithubProject, type GithubProjectInfo, type PrSummary } from "./github";
import { githubEditLabel, githubPullRequests, githubPrState } from "./githubPresentation";
import { GithubRepositoryPicker } from "./GithubRepositoryPicker";
import { GithubSettings } from "./GithubSettings";
import { githubButtonClass, githubCardClass, githubPrimaryClass } from "./githubStyles";
import { selectedGithubSection, useProjectToolNavigation, type GithubSection } from "./toolNavigation";

const sections = [
  { id: "changes", label: "Changes", icon: FileDiffIcon },
  { id: "pull-requests", label: "Pull requests", icon: GitPullRequestIcon },
  { id: "issues", label: "Issues", icon: CircleDotIcon },
  { id: "settings", label: "Settings", icon: Settings2Icon },
] as const;

export function GithubPane({ projectId }: { projectId: string }) {
  const query = useGithubProject(projectId);
  const info = query.data;
  const [params] = useSearchParams();
  const section = selectedGithubSection(params);
  const openTool = useProjectToolNavigation();
  const root = useRef<HTMLDivElement>(null);

  return (
    <div ref={root} className="h-full overflow-y-auto text-silver-900 [scrollbar-gutter:stable]">
      <ToolPaneContent className="space-y-5 pb-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-medium">GitHub</h1>
            <p className="mt-1 text-xs text-silver-600">Your repository, changes, and collaboration in one place.</p>
          </div>
          <button
            type="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            aria-label="Refresh GitHub"
            className={cn(githubButtonClass, "shrink-0")}
          >
            <RefreshCwIcon className={cn("size-3.5", query.isFetching && "animate-spin motion-reduce:animate-none")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </header>
        {!info ? (
          query.isError ? <GithubLoadError onRetry={() => void query.refetch()} /> : (
            <div role="status" className={cn(githubCardClass, "flex items-center gap-3 p-6 text-sm text-silver-600")}>
              <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />Loading GitHub workspace…
            </div>
          )
        ) : (
          <>
            {query.isError && <GithubLoadError onRetry={() => void query.refetch()} />}
            <RepositoryHeader info={info} />
            <Tabs.Root
              value={section}
              onValueChange={(value) => { openTool("github", value as GithubSection); root.current?.scrollTo({ top: 0 }); }}
              className="space-y-5"
            >
              <Tabs.List aria-label="GitHub sections" className="flex gap-1 overflow-x-auto border-b border-silver-200">
                {sections.map(({ id, label, icon: Icon }) => (
                  <Tabs.Trigger
                    key={id}
                    value={id}
                    className="inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 border-transparent px-2 text-xs font-medium text-silver-600 transition-colors hover:text-silver-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 sm:px-3"
                  >
                    <Icon aria-hidden="true" className="hidden size-3.5 sm:block" />{label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              {sections.map(({ id }) => (
                <Tabs.Content key={id} value={id} className="focus-visible:outline-2 focus-visible:outline-ring">
                  {!info.connected ? <ConnectGithub blocked={query.isError} /> : id === "settings" ? (
                    <GithubSettings key={projectId} projectId={projectId} info={info} blocked={query.isError || query.isFetching} />
                  ) : !info.repo ? <LinkRepository projectId={projectId} blocked={query.isError || query.isFetching} /> : id === "changes" ? (
                    <GithubChanges info={info} />
                  ) : id === "pull-requests" ? <GithubPullRequests info={info} /> : <GithubIssues info={info} />}
                </Tabs.Content>
              ))}
            </Tabs.Root>
          </>
        )}
      </ToolPaneContent>
    </div>
  );
}

function GithubLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs">
      <p>Couldn't refresh GitHub. Try again to check your connection and repository.</p>
      <button type="button" className={githubButtonClass} onClick={onRetry}>Try again</button>
    </div>
  );
}

function RepositoryHeader({ info }: { info: GithubProjectInfo }) {
  const repo = info.repo;
  return (
    <div className={cn(githubCardClass, "flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center")}>
      <div className="flex w-full min-w-0 flex-1 items-start gap-3 sm:w-auto">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-silver-200 bg-space-overlay"><GithubMark className="size-5" /></div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="break-all text-sm font-medium">{repo?.fullName ?? (info.connected ? "No repository linked" : "Connect your GitHub account")}</h2>
            {repo && <span className="inline-flex items-center gap-1 rounded-full border border-silver-200 px-2 py-0.5 text-[10px] text-silver-600">
              {repo.visibility === "private" ? <LockIcon className="size-3" /> : <GlobeIcon className="size-3" />}
              {repo.visibility === "private" ? "Private" : "Public"}
            </span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-silver-600">
            {repo && <span className="inline-flex items-center gap-1.5 break-all"><GitBranchIcon className="size-3.5 shrink-0" />{repo.defaultBranch}</span>}
            <span className="inline-flex items-center gap-1.5 break-all"><span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", info.connected ? "bg-emerald-500" : "bg-silver-400")} />
              {info.connected ? info.username ? `Connected as @${info.username}` : "Account connected" : "Account not connected"}
            </span>
          </div>
        </div>
      </div>
      {repo && <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" className={githubButtonClass}>Open repository<ArrowUpRightIcon className="size-3.5" /></a>}
    </div>
  );
}

function ConnectGithub({ blocked }: { blocked: boolean }) {
  return (
    <div className={cn(githubCardClass, "space-y-4 p-6")}>
      <div>
        <h2 className="text-sm font-medium">Bring your project to GitHub</h2>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-silver-600">Connect your account to link a repository and follow your pull requests. Your project stays here in Tau.</p>
      </div>
      <button type="button" disabled={blocked} onClick={startGithubConnect} className={cn(githubButtonClass, githubPrimaryClass)}><GithubMark className="size-4" />Connect GitHub</button>
    </div>
  );
}

function LinkRepository({ projectId, blocked }: { projectId: string; blocked: boolean }) {
  return (
    <div className={cn(githubCardClass, "space-y-4 p-6")}>
      <div>
        <h2 className="text-sm font-medium">Choose a home for your code</h2>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-silver-600">Link an existing repository to see its pull requests and manage the connection.</p>
      </div>
      <GithubRepositoryPicker projectId={projectId} disabled={blocked} />
      <p className="text-xs text-silver-600">Creating a repository from this workspace will be available soon.</p>
    </div>
  );
}

function GithubChanges({ info }: { info: GithubProjectInfo }) {
  return (
    <section className={githubCardClass} aria-label="Project changes">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-silver-200 p-5">
        <div>
          <h2 className="text-sm font-medium">Project changes</h2>
          <p className="mt-1 text-xs text-silver-600">{githubEditLabel(info.unpushedChanges)}</p>
        </div>
        <button type="button" disabled className={cn(githubButtonClass, githubPrimaryClass)} aria-describedby="github-push-unavailable"><UploadIcon className="size-3.5" />Push changes</button>
      </div>
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-silver-200 bg-space-overlay text-silver-600"><FileDiffIcon className="size-5" /></div>
        <h3 className="text-sm font-medium">File comparison isn't available yet</h3>
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-silver-600">This edit count tracks updates made in Tau. A file-by-file comparison with GitHub will appear here when available.</p>
        <p id="github-push-unavailable" className="mt-5 inline-flex max-w-sm items-start gap-2 text-xs leading-relaxed text-silver-600"><InfoIcon className="mt-0.5 size-3.5 shrink-0" />Pushing changes from this workspace will be available with file review.</p>
      </div>
    </section>
  );
}

function GithubPullRequests({ info }: { info: GithubProjectInfo }) {
  const prs = githubPullRequests(info);
  return (
    <section className={githubCardClass} aria-label="Repository pull requests">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-silver-200 p-5">
        <div>
          <h2 className="text-sm font-medium">Pull requests</h2>
          <p className="mt-1 text-xs text-silver-600">Recent open pull requests and your last Tau pull request.</p>
        </div>
        <a href={`${info.repo!.htmlUrl}/pulls`} target="_blank" rel="noopener noreferrer" className={githubButtonClass}>View all on GitHub<ExternalLinkIcon className="size-3.5" /></a>
      </div>
      {prs.length ? (
        <div className="divide-y divide-silver-200">{prs.map((pr) => <PullRequestRow key={pr.number} pr={pr} />)}</div>
      ) : (
        <div className="space-y-2 px-6 py-12 text-center"><GitPullRequestIcon className="mx-auto mb-4 size-6 text-silver-600" /><h3 className="text-sm font-medium">No pull requests to show</h3><p className="text-xs text-silver-600">Pull requests from your linked repository will appear here.</p></div>
      )}
      <p className="border-t border-silver-200 px-5 py-3 text-[11px] text-silver-600">Showing up to 10 open pull requests. Review and check details are available on GitHub.</p>
    </section>
  );
}

function PullRequestRow({ pr }: { pr: PrSummary }) {
  const state = githubPrState(pr);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="flex min-h-20 w-full items-start gap-3 p-5 text-left transition-colors hover:bg-space-overlay focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
          <GitPullRequestIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-silver-600" />
          <div className="min-w-0 flex-1"><p className="break-words text-xs font-medium">{pr.title}</p><p className="mt-1 text-[11px] text-silver-600">#{pr.number}</p></div>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px]", state.className)}>{state.label}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="border-silver-200 bg-space-surface text-silver-900 sm:max-w-lg motion-reduce:animate-none">
        <DialogHeader>
          <DialogTitle className="break-words">{pr.title}</DialogTitle>
          <DialogDescription className="text-silver-600">Pull request #{pr.number} · {state.label}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-xs">
          <div className="rounded-lg border border-silver-200 bg-space-void p-4"><p className="font-medium">Reviews and checks</p><p className="mt-2 leading-relaxed text-silver-600">Detailed reviews, checks, and the description aren't available in Tau yet. Open this pull request on GitHub to review them.</p></div>
          <a href={pr.url} target="_blank" rel="noopener noreferrer" className={cn(githubButtonClass, githubPrimaryClass)}>Open on GitHub<ArrowUpRightIcon className="size-3.5" /></a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GithubIssues({ info }: { info: GithubProjectInfo }) {
  return (
    <section className={githubCardClass} aria-label="Repository issues">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-silver-200 p-5">
        <div><h2 className="text-sm font-medium">Issues</h2><p className="mt-1 text-xs text-silver-600">Track bugs, ideas, and the next things to build.</p></div>
        <button type="button" disabled aria-describedby="github-issues-unavailable" className={githubButtonClass}><PlusIcon className="size-3.5" />New issue</button>
      </div>
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <CircleDotIcon className="mb-4 size-6 text-silver-600" />
        <h3 className="text-sm font-medium">Issues aren't available in Tau yet</h3>
        <p id="github-issues-unavailable" className="mt-2 max-w-sm text-xs leading-relaxed text-silver-600">View and create issues on GitHub while issue management is being added here.</p>
        <a href={`${info.repo!.htmlUrl}/issues`} target="_blank" rel="noopener noreferrer" className={cn(githubButtonClass, "mt-5")}>View issues on GitHub<ArrowUpRightIcon className="size-3.5" /></a>
      </div>
    </section>
  );
}
