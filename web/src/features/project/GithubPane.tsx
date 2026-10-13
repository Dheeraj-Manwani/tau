import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Tabs } from "radix-ui";
import {
  ArrowUpRightIcon, CircleDotIcon, FileDiffIcon,
  GitBranchIcon, GitPullRequestIcon, GlobeIcon,
  LoaderCircleIcon, LockIcon, RefreshCwIcon, Settings2Icon,
} from "lucide-react";
import { GithubMark } from "@/src/components/ui/github-mark";
import { startGithubConnect } from "@/src/features/auth/github";
import { cn } from "@/src/lib/utils";
import { ToolPaneContent } from "./ToolPaneContent";
import { useGithubProject, projectGithubKeys, errorMessage, type GithubProjectInfo } from "./github";
import { GithubCreateRepository } from "./GithubCreateRepository";
import { GithubPullRequests, GithubIssues } from "./GithubCollaborationPane";
import { GithubChanges } from "./GithubChanges";
import { GithubSettings } from "./GithubSettings";
import { githubButtonClass, githubCardClass, githubPrimaryClass } from "./githubStyles";
import { selectedGithubSection, selectedGithubPr, useProjectToolNavigation, type GithubSection } from "./toolNavigation";

const sections = [
  { id: "changes", label: "Changes", icon: FileDiffIcon },
  { id: "pull-requests", label: "Pull requests", icon: GitPullRequestIcon },
  { id: "issues", label: "Issues", icon: CircleDotIcon },
  { id: "settings", label: "Settings", icon: Settings2Icon },
] as const;

export function GithubPane({ projectId }: { projectId: string }) {
  const query = useGithubProject(projectId);
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: projectGithubKeys.info(projectId) });
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
            onClick={() => void refresh()}
            aria-label="Refresh GitHub"
            className={cn(githubButtonClass, "shrink-0")}
          >
            <RefreshCwIcon className={cn("size-3.5", query.isFetching && "animate-spin motion-reduce:animate-none")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </header>
        {!info ? (
          query.isError ? <GithubLoadError error={query.error} onRetry={() => void refresh()} /> : (
            <div role="status" className={cn(githubCardClass, "flex items-center gap-3 p-6 text-sm text-silver-600")}>
              <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />Loading GitHub workspace…
            </div>
          )
        ) : (
          <>
            {query.isError && <GithubLoadError error={query.error} onRetry={() => void refresh()} />}
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
                  ) : !info.repo ? <CreateRepository projectId={projectId} blocked={query.isError || query.isFetching} /> : id === "changes" ? (
                    <GithubChanges key={`${projectId}:${info.repo.fullName}:${info.pushMode}:${selectedGithubPr(params) ?? ""}`} projectId={projectId} info={info} blocked={query.isError} />
                  ) : id === "pull-requests" ? <GithubPullRequests key={`${projectId}:${info.repo.fullName}`} projectId={projectId} info={info} blocked={query.isError} /> : <GithubIssues key={`${projectId}:${info.repo.fullName}`} projectId={projectId} info={info} blocked={query.isError} />}
                </Tabs.Content>
              ))}
            </Tabs.Root>
          </>
        )}
      </ToolPaneContent>
    </div>
  );
}

function GithubLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs">
      <p>{errorMessage(error, "Couldn't refresh GitHub. Try again to check your connection and repository.")}</p>
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
            <h2 className="break-all text-sm font-medium">{repo?.fullName ?? (info.connected ? "No repository created" : "Connect your GitHub account")}</h2>
            {repo && <span className="inline-flex items-center gap-1 rounded-full border border-silver-200 px-2 py-0.5 text-[10px] text-silver-600">
              {repo.visibility === "private" ? <LockIcon className="size-3" /> : <GlobeIcon className="size-3" />}
              {repo.visibility === "private" ? "Private" : repo.visibility === "internal" ? "Internal" : "Public"}
            </span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-silver-600">
            {repo && <span className="inline-flex items-center gap-1.5 break-all"><GitBranchIcon className="size-3.5 shrink-0" />{repo.defaultBranch}</span>}
            <span className="inline-flex items-center gap-1.5 break-all"><span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", info.connected ? "bg-emerald-500" : "bg-silver-400")} />
              {info.connected ? info.username ? `Connected as @${info.username}` : "Account connected" : "Account not connected"}
            </span>
            {repo && <span>{repo.archived ? "Archived" : repo.canAdmin ? "Admin access" : repo.canPush ? "Write access" : "Read access"}</span>}
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
        <p className="mt-2 max-w-md text-xs leading-relaxed text-silver-600">Connect your account to create a repository and follow your pull requests. Your project stays here in Tau.</p>
      </div>
      <button type="button" disabled={blocked} onClick={startGithubConnect} className={cn(githubButtonClass, githubPrimaryClass)}><GithubMark className="size-4" />Connect GitHub</button>
    </div>
  );
}

function CreateRepository({ projectId, blocked }: { projectId: string; blocked: boolean }) {
  return (
    <div className={cn(githubCardClass, "space-y-4 p-6")}>
      <div>
        <h2 className="text-sm font-medium">Create a home for your code</h2>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-silver-600">Create a new private repository for this project. Then review your changes, push code, and open pull requests.</p>
      </div>
      <GithubCreateRepository projectId={projectId} disabled={blocked} />
    </div>
  );
}
