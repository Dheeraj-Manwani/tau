import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  ArrowUpRightIcon, CircleDotIcon, FileDiffIcon,
  GitBranchIcon, GitPullRequestIcon, GlobeIcon,
  LockIcon, RefreshCwIcon, Settings2Icon,
} from "lucide-react";
import { GithubMark } from "@/src/components/ui/github-mark";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { startGithubConnect } from "@/src/features/auth/github";
import { cn } from "@/src/lib/utils";
import { ToolPaneContent } from "./ToolPaneContent";
import { useGithubProject, projectGithubKeys, errorMessage, type GithubProjectInfo } from "./github";
import { GithubCreateRepository } from "./GithubCreateRepository";
import { GithubPullRequests, GithubIssues } from "./GithubCollaborationPane";
import { GithubChanges } from "./GithubChanges";
import { GithubSettings } from "./GithubSettings";
import { githubPullRequests } from "./githubPresentation";
import { selectedGithubSection, selectedGithubPr, useProjectToolNavigation, type GithubSection } from "./toolNavigation";

const sections = [
  { id: "changes", label: "Changes", icon: FileDiffIcon },
  { id: "pull-requests", label: "Pull requests", icon: GitPullRequestIcon },
  { id: "issues", label: "Issues", icon: CircleDotIcon },
  { id: "settings", label: "Settings", icon: Settings2Icon },
] as const;

/** Tools → GitHub (boards/Workspace-GitHub.dc.html, Workspace-GitHub-Tabs.dc.html). */
export function GithubPane({ projectId }: { projectId: string }) {
  const query = useGithubProject(projectId);
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: projectGithubKeys.info(projectId) });
  const info = query.data;
  const [params] = useSearchParams();
  const section = selectedGithubSection(params);
  const openTool = useProjectToolNavigation();
  const root = useRef<HTMLDivElement>(null);
  const openPrCount = info ? githubPullRequests(info).filter((pr) => pr.state === "open").length : 0;

  return (
    <div ref={root} className="h-full overflow-y-auto text-silver-900 [scrollbar-gutter:stable]">
      <ToolPaneContent className="flex flex-col gap-[22px]">
        <PageHeader
          title="GitHub"
          description="Your repository, changes, and collaboration in one place."
          actions={
            <Button
              variant="secondary"
              disabled={query.isFetching}
              onClick={() => void refresh()}
              aria-label="Refresh GitHub"
            >
              <RefreshCwIcon className={cn(query.isFetching && "animate-spin motion-reduce:animate-none")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          }
        />
        {!info ? (
          query.isError ? (
            <GithubLoadError error={query.error} onRetry={() => void refresh()} />
          ) : (
            <Card className="flex items-center gap-3 p-5.5" role="status" aria-label="Loading GitHub workspace">
              <Skeleton className="size-10" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
            </Card>
          )
        ) : (
          <>
            {query.isError && <GithubLoadError error={query.error} onRetry={() => void refresh()} />}
            <RepositoryHeader info={info} />
            <Tabs
              value={section}
              onValueChange={(value) => { openTool("github", value as GithubSection); root.current?.scrollTo({ top: 0 }); }}
              className="flex flex-col gap-[22px]"
            >
              <TabsList aria-label="GitHub sections">
                {sections.map(({ id, label, icon: Icon }) => (
                  <TabsTrigger key={id} value={id}>
                    <Icon aria-hidden="true" className="hidden sm:block" />
                    {label}
                    {id === "pull-requests" && openPrCount > 0 && <TabsCount>{openPrCount}</TabsCount>}
                  </TabsTrigger>
                ))}
              </TabsList>
              {sections.map(({ id }) => (
                <TabsContent key={id} value={id}>
                  {!info.connected ? <ConnectGithub blocked={query.isError} /> : id === "settings" ? (
                    <GithubSettings key={projectId} projectId={projectId} info={info} blocked={query.isError || query.isFetching} />
                  ) : !info.repo ? <CreateRepository projectId={projectId} blocked={query.isError || query.isFetching} /> : id === "changes" ? (
                    <GithubChanges key={`${projectId}:${info.repo.fullName}:${info.pushMode}:${selectedGithubPr(params) ?? ""}`} projectId={projectId} info={info} blocked={query.isError} />
                  ) : id === "pull-requests" ? <GithubPullRequests key={`${projectId}:${info.repo.fullName}`} projectId={projectId} info={info} blocked={query.isError} /> : <GithubIssues key={`${projectId}:${info.repo.fullName}`} projectId={projectId} info={info} blocked={query.isError} />}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </ToolPaneContent>
    </div>
  );
}

function GithubLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Alert
      tone="danger"
      action={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    >
      {errorMessage(error, "Couldn't refresh GitHub. Try again to check your connection and repository.")}
    </Alert>
  );
}

/** The repository card: mono name, visibility, branch, who is connected and
 *  with what access, and a way out to GitHub. */
function RepositoryHeader({ info }: { info: GithubProjectInfo }) {
  const repo = info.repo;
  return (
    <Card className="flex flex-col items-start justify-between gap-4 p-5.5 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex w-full min-w-0 flex-1 items-center gap-3.5 sm:w-auto">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line-strong bg-space-overlay">
          <GithubMark className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-mono text-sm font-semibold break-all">
              {repo?.fullName ?? (info.connected ? "No repository created" : "Connect your GitHub account")}
            </h2>
            {repo && (
              <Badge>
                {repo.visibility === "private" ? <LockIcon /> : <GlobeIcon />}
                {repo.visibility === "private" ? "Private" : repo.visibility === "internal" ? "Internal" : "Public"}
              </Badge>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-silver-500">
            {repo && (
              <span className="inline-flex items-center gap-1.5 font-mono break-all">
                <GitBranchIcon className="size-3.5 shrink-0" />
                {repo.defaultBranch}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 break-all">
              <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", info.connected ? "bg-green-400" : "bg-line-hover")} />
              {info.connected ? (info.username ? `Connected as @${info.username}` : "Account connected") : "Account not connected"}
            </span>
            {repo && (
              <Badge tone="mono">
                {repo.archived ? "Archived" : repo.canAdmin ? "Admin access" : repo.canPush ? "Write access" : "Read access"}
              </Badge>
            )}
          </div>
        </div>
      </div>
      {repo && (
        <Button variant="secondary" asChild>
          <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer">
            Open repository
            <ArrowUpRightIcon />
          </a>
        </Button>
      )}
    </Card>
  );
}

function ConnectGithub({ blocked }: { blocked: boolean }) {
  return (
    <Card className="flex flex-col items-start gap-4 p-6">
      <div>
        <h2 className="text-[15px] font-semibold">Bring your project to GitHub</h2>
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-silver-500">
          Connect your account to create a repository and follow your pull requests. Your project stays here in Tau.
        </p>
      </div>
      <Button disabled={blocked} onClick={startGithubConnect}>
        <GithubMark className="size-4" />
        Connect GitHub
      </Button>
    </Card>
  );
}

function CreateRepository({ projectId, blocked }: { projectId: string; blocked: boolean }) {
  return (
    <Card className="flex flex-col items-start gap-4 p-6">
      <div>
        <h2 className="text-[15px] font-semibold">Create a home for your code</h2>
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-silver-500">
          Create a new private repository for this project. Then review your changes, push code, and open pull requests.
        </p>
      </div>
      <GithubCreateRepository projectId={projectId} disabled={blocked} />
    </Card>
  );
}
