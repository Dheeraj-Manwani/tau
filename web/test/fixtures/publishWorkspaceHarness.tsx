import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { RightPanel } from "../../src/features/project/RightPanel";
import { api } from "../../src/lib/api-client";
import { queryClient } from "../../src/lib/query-client";
import { useProjectStore } from "../../src/stores/useProjectStore";
import { projectGithubKeys, type GithubProjectInfo, type GithubComparison, type GithubFileDiff } from "../../src/features/project/github";
import { type GithubIssue, type GithubPrDetail } from "../../src/features/project/githubCollaboration";
import {
  deployKeys,
  type DeploymentSummary,
  type DeployStatus,
} from "../../src/features/project/deploy";
import "../../src/index.css";

// Browser-only fixture: the actual project shell and controls, with no real network requests.
const projectId = "publish-ui-fixture";
const scenario = new URLSearchParams(location.search).get("scenario") ?? "live";
const githubScenario = new URLSearchParams(location.search).get("githubState") ?? "linked";
const clean = new URLSearchParams(location.search).get("clean") === "1";
let githubError = githubScenario === "error";
let creationError = githubScenario === "creation-error";
let comparisonError = githubScenario === "changes-error";
let diffError = githubScenario === "diff-error" || githubScenario === "diff-stale";
let diffReads = 0;
let pushedPr: number | null = null;
let prDetailReads = 0;
let issueDetailReads = 0;
let collaborationError = githubScenario === "collaboration-error";
const fixtureIssue = (number: number, title: string, body: string, state = "open"): GithubIssue => ({ number, title, body, state, url: `https://github.com/acme/atlas/issues/${number}`, author: "alex", updatedAt: "2026-10-13T12:00:00Z", createdAt: "2026-10-12T10:00:00Z", comments: 3, labels: ["bug", "workspace"], assignees: ["dheer"] });
let fixtureIssues = [
  fixtureIssue(18, "Mobile toolbar overlaps file review", githubScenario === "long-issue" ? "Steps to reproduce. ".repeat(600) : "On a 390px screen, the toolbar covers the final lines of the file diff.\n\nSteps to reproduce:\n1. Open GitHub in Tools.\n2. Expand a file diff.\n3. Scroll to the final lines.\n\nExpected: all lines remain visible and keyboard focus stays inside the panel."),
  fixtureIssue(16, "Show a clearer stale comparison message", "Explain how to refresh when the GitHub branch changes."),
  fixtureIssue(14, "Keep section tabs visible on mobile", "Allow all section labels to fit.", "closed"),
];
let githubInfo: GithubProjectInfo = {
  connected: scenario === "github" && githubScenario !== "disconnected",
  username: "alex",
  repo: scenario === "github" && !["unlinked", "disconnected", "creation-error", "creation-pending"].includes(githubScenario)
    ? { fullName: "acme/atlas", htmlUrl: "https://github.com/acme/atlas", visibility: "private", defaultBranch: "main", canPush: !["read-only", "archived"].includes(githubScenario), canAdmin: !["read-only", "write-only"].includes(githubScenario), canChangeVisibility: !["read-only", "write-only", "archived", "fork"].includes(githubScenario), archived: githubScenario === "archived", visibilityReason: githubScenario === "archived" ? "This repository is archived." : githubScenario === "fork" ? "Fork visibility follows its repository network." : "Repository admin access is required to change visibility." }
    : null,
  lastPr: { number: 42, title: "Add workspace navigation", state: "open", url: "https://github.com/acme/atlas/pull/42", author: "alex", headBranch: "tau/add-workspace-navigation", baseBranch: "main", updatedAt: "2026-10-13T10:00:00Z", draft: true, canUpdate: githubScenario !== "read-only", body: "Adds the GitHub workspace with file review and consistent navigation.\n\nVerified desktop and mobile layouts." },
  openPrs: [
    { number: 42, title: "Add workspace navigation", state: "open", url: "https://github.com/acme/atlas/pull/42" },
    { number: 39, title: "Improve mobile layout", state: "open", url: "https://github.com/acme/atlas/pull/39", canUpdate: githubScenario !== "read-only", headBranch: "tau/improve-mobile-layout", baseBranch: "main", body: "Makes the workspace fit small screens." },
  ],
  unpushedChanges: 3,
  pushMode: "new_pr",
  lastPush: githubScenario === "no-push-metadata" ? null : { at: "2026-10-13T03:00:00Z", commitSha: "c153a40832d80ac81491194d26145119d3d9b201", commitUrl: "https://github.com/acme/atlas/commit/c153a40832d80ac81491194d26145119d3d9b201", branch: "tau/add-workspace-navigation" },
};
if (githubScenario === "empty") githubInfo = { ...githubInfo, lastPr: null, openPrs: [], unpushedChanges: 0 };
const now = new Date().toISOString();
const live: DeploymentSummary = {
  id: "live1234-5678",
  status: "READY",
  target: "FULLSTACK",
  fileCount: 24,
  sizeBytes: 340000,
  error: null,
  createdAt: new Date(Date.now() - 80_000).toISOString(),
  completedAt: new Date(Date.now() - 15_000).toISOString(),
  isLive: true,
  canRollback: false,
};
let status: DeployStatus = {
  slug: "atlas",
  url: "https://atlas.bytauai.pro",
  primaryUrl: "https://atlas.example.com",
  suggestedName: null,
  domain: "bytauai.pro",
  live,
  deployments: [
    live,
    {
      ...live,
      id: "older123-5678",
      createdAt: new Date(Date.now() - 86_400_000).toISOString(),
      completedAt: new Date(Date.now() - 86_335_000).toISOString(),
      status: "SUPERSEDED",
      isLive: false,
      canRollback: true,
    },
  ],
  inProgress: false,
  unpublishedChanges: 3,
  serverWarning: null,
  suspended: null,
  lastFailure: null,
  publishFee: { credits: 200, due: false },
  backendPublished: true,
  databasePublished: true,
  storagePublished: true,
};
if (scenario === "first")
  status = {
    ...status,
    slug: null,
    url: null,
    primaryUrl: null,
    suggestedName: "atlas",
    live: null,
    deployments: [],
    publishFee: { credits: 200, due: true },
    backendPublished: false,
    databasePublished: false,
    storagePublished: false,
  };
if (
  scenario === "failed" ||
  scenario === "schema" ||
  scenario === "first-failed"
) {
  const error =
    scenario === "schema"
      ? "Database changes need confirmation."
      : "Build failed: missing module";
  status = {
    ...status,
    deployments: [
      { ...live, id: "failed12-5678", status: "FAILED", error, isLive: false, createdAt: now, completedAt: now },
      ...status.deployments,
    ],
    lastFailure: {
      error,
      buildLog: "error TS2307: Cannot find module './missing'.",
      schemaChanges:
        scenario === "schema"
          ? [
              {
                kind: "COLUMN_CHANGED",
                message: "The users.email column changed.",
              },
            ]
          : null,
      changedSince: false,
    },
  };
  if (scenario === "first-failed")
    status = {
      ...status,
      live: null,
      primaryUrl: null,
      deployments: status.deployments.slice(0, 1),
      publishFee: { credits: 200, due: true },
    };
}
if (scenario === "suspended")
  status = {
    ...status,
    suspended: { reason: "This site is suspended for review." },
  };
if (scenario === "static")
  status = {
    ...status,
    backendPublished: false,
    databasePublished: false,
    storagePublished: false,
  };
if (scenario === "offline")
  status = {
    ...status,
    live: null,
    deployments: status.deployments.map((deployment) => ({
      ...deployment,
      status: "SUPERSEDED",
      isLive: false,
      canRollback: true,
    })),
  };
let identity = {
  title: "Atlas",
  description: "A sample app",
  icon: "default",
  projectName: "Atlas",
  plan: "FREE",
  prices: { publishFee: 200, logoUpload: 25, logoGeneration: 20 },
  canGenerate: true,
  generationsLeftToday: 2,
};
let mutations = 0;
let lastBody = "";
const commit = () =>
  queryClient.setQueryData(
    deployKeys.status(projectId),
    structuredClone(status),
  );
api.defaults.adapter = async (config) => {
  const url = config.url ?? "";
  const method = config.method ?? "get";
  let data: unknown;
  if (method !== "get") {
    mutations++;
    lastBody =
      typeof config.data === "string"
        ? config.data
        : JSON.stringify(config.data);
  }
  if (/\/github\/pulls\/\d+$/.test(url)) {
    prDetailReads++;
    if (githubScenario === "pr-detail-error") throw new Error("GitHub could not load this pull request. Try again.");
    const number = Number(url.split("/").at(-1));
    const pr = githubInfo.lastPr?.number === number ? githubInfo.lastPr : githubInfo.openPrs.find((item) => item.number === number) ?? { number, title: "Refine keyboard navigation", state: "open", url: `https://github.com/acme/atlas/pull/${number}`, headBranch: "tau/refine-keyboard-navigation", baseBranch: "main", body: "Improves keyboard navigation across workspace sections.", canUpdate: true };
    const unavailable = githubScenario === "checks-unavailable";
    data = { repo: githubInfo.repo!.fullName, pr, headSha: "a153a40832d80ac81491194d26145119d3d9b201", additions: 184, deletions: 32, files: 6, commits: 3, mergeable: true,
      reviews: { available: true, hasMore: false, items: [{ id: 1, author: "maya", state: "APPROVED", body: "The layout looks good. Please keep the stale comparison message clear.", url: `https://github.com/acme/atlas/pull/${number}#pullrequestreview-1`, submittedAt: "2026-10-13T10:00:00Z", commitSha: "b153a40832d80ac81491194d26145119d3d9b201" }] },
      checks: { available: !unavailable, hasMore: false, ...(unavailable ? { reason: "Unavailable with your current GitHub access." } : {}), items: unavailable ? [] : [{ id: "1", name: "Production build", state: "success", source: "check", url: "https://github.com/acme/atlas/actions/runs/1" }, { id: "2", name: "Unit tests", state: "in_progress", source: "check", url: "https://github.com/acme/atlas/actions/runs/2" }] },
      statuses: { available: true, hasMore: false, items: [{ id: "3", name: "Deploy preview", state: "success", source: "status", url: "https://github.com/acme/atlas/deployments" }] },
    } satisfies GithubPrDetail;
  } else if (url.endsWith("/github/pulls")) {
    if (collaborationError) throw new Error("GitHub's rate limit was reached. Try again later.");
    const page = Number(config.params?.page ?? 1);
    const state = config.params?.state ?? "open";
    const prs = page === 1 ? [githubInfo.lastPr!, ...githubInfo.openPrs.filter((pr) => pr.number !== githubInfo.lastPr?.number)] : [{ number: 34, title: "Refine keyboard navigation", state: "open", url: "https://github.com/acme/atlas/pull/34", canUpdate: true }];
    data = { repo: githubInfo.repo!.fullName, items: githubScenario === "empty" ? [] : prs.filter((pr) => state === "all" || pr.state === state), page, hasNext: page === 1 && state !== "closed" && githubScenario !== "empty" };
  } else if (/\/github\/issues\/\d+$/.test(url)) {
    issueDetailReads++;
    if (githubScenario === "issue-detail-error") throw new Error("GitHub could not load the issue description. Try again.");
    data = { repo: githubInfo.repo!.fullName, issue: fixtureIssues.find((issue) => issue.number === Number(url.split("/").at(-1)))! };
  } else if (url.endsWith("/github/issues")) {
    if (method === "post") {
      if (githubScenario === "issue-create-pending") await new Promise<never>(() => {});
      if (githubScenario === "issue-create-error") throw new Error("Issue creation could not be confirmed. Check GitHub before creating another.");
      const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
      const issue = fixtureIssue(19, body.title, body.description); fixtureIssues = [issue, ...fixtureIssues];
      data = { issueUrl: issue.url, number: 19, summary: "Opened issue #19" };
    } else {
      if (collaborationError) throw new Error("GitHub's rate limit was reached. Try again later.");
      const page = Number(config.params?.page ?? 1); const state = config.params?.state ?? "open";
      data = { repo: githubInfo.repo!.fullName, items: githubScenario === "empty" || page === 1 && githubScenario === "pr-only-page" ? [] : (page === 1 ? fixtureIssues : [fixtureIssue(10, "Improve issue keyboard focus", "Restore focus after closing issue details.")]).filter((issue) => state === "all" || issue.state === state), page, hasNext: page === 1 && state !== "closed" && githubScenario !== "empty", canCreate: !["archived", "issues-disabled"].includes(githubScenario), ...(["archived", "issues-disabled"].includes(githubScenario) ? { disabledReason: githubScenario === "archived" ? "This repository is archived." : "Issues are disabled for this repository." } : {}) };
    }
  } else if (url.endsWith("/message")) {
    if (githubScenario === "fix-pending") await new Promise<never>(() => {});
    if (githubScenario === "fix-error") throw new Error("Couldn't send your message");
    data = { jobId: "fixture-issue-fix-job" };
  } else if (url.endsWith("/github/changes")) {
    if (githubScenario === "changes-loading") await new Promise<never>(() => {});
    if (comparisonError) throw new Error("GitHub's rate limit was reached. Try again later.");
    const deletions: string[] = JSON.parse(config.params?.deletions ?? "[]");
    const files: GithubComparison["files"] = githubScenario === "empty" || (pushedPr === Number(config.params?.prNumber) && config.params?.mode === "update_pr") ? [] : [
      { path: "src/App.tsx", status: "modified", kind: "text", beforeBytes: 130, afterBytes: 168 },
      { path: "src/components/RepositoryHeader.tsx", status: "added", kind: "text", beforeBytes: 0, afterBytes: 120 },
      { path: "public/logo.png", status: "modified", kind: "binary", beforeBytes: 15_000, afterBytes: 18_000 },
      { path: "data/catalog.json", status: "modified", kind: "large", beforeBytes: 500_000, afterBytes: 600_000 },
      ...deletions.map((path): GithubComparison["files"][number] => ({ path, status: "deleted", kind: "text", beforeBytes: 48, afterBytes: 0 })),
    ];
    data = {
      preview: `fixture-preview-${config.params?.mode}-${config.params?.prNumber ?? ""}-${deletions.join(",")}-${useProjectStore.getState().headSequence}`,
      repo: githubInfo.repo?.fullName ?? "acme/atlas", branch: config.params?.mode === "update_pr" ? Number(config.params?.prNumber) === 34 ? "tau/refine-keyboard-navigation" : Number(config.params?.prNumber) === 39 ? "tau/improve-mobile-layout" : "tau/add-workspace-navigation" : "main",
      prNumber: config.params?.mode === "update_pr" ? Number(config.params?.prNumber ?? 42) : undefined, canPush: githubScenario !== "read-only",
      mode: config.params?.mode ?? "new_pr", headSha: "a153a40832d80ac81491194d26145119d3d9b201", localSequence: useProjectStore.getState().headSequence ?? 3,
      files, counts: { added: files.filter((f) => f.status === "added").length, modified: files.filter((f) => f.status === "modified").length, deleted: deletions.length, total: files.length },
      repositoryOnly: [{ path: "docs/README.md", sizeBytes: 48 }, { path: "LICENSE", sizeBytes: 1_040 }], excludedCount: 2,
    } satisfies GithubComparison;
  } else if (url.endsWith("/github/push")) {
    const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    if (githubScenario === "push-pending") await new Promise<never>(() => {});
    if (githubScenario === "push-stale") throw new Error("The GitHub branch changed. Refresh the comparison.");
    if (githubScenario === "push-error") throw new Error("GitHub refused the push. Check write access, branch rules, and workflow permissions.");
    const partial = githubScenario === "push-partial";
    const number = body.mode === "update_pr" ? body.prNumber : 43;
    const branch = body.mode === "direct" ? "main" : body.mode === "update_pr" ? githubInfo.openPrs.find((pr) => pr.number === number)?.headBranch ?? githubInfo.lastPr!.headBranch! : "tau/reviewed-changes-abc123";
    pushedPr = body.mode === "update_pr" ? number : null;
    data = { repoUrl: "https://github.com/acme/atlas", commitUrl: "https://github.com/acme/atlas/commit/c153a40832d80ac81491194d26145119d3d9b201", ...(body.mode !== "direct" && !partial ? { prUrl: `https://github.com/acme/atlas/pull/${number}`, prNumber: number } : {}), branch, mode: body.mode, summary: "Pushed reviewed changes", ...(partial ? { warning: "The commit was pushed. GitHub could not create the pull request. Open the commit on GitHub to finish the pull request; do not repeat the push." } : {}) };
    if (!partial && body.mode !== "direct") {
      const pr = { number, title: body.title, state: "open", url: `https://github.com/acme/atlas/pull/${number}`, body: body.description, draft: body.mode === "new_pr" ? body.draft : githubInfo.lastPr?.draft, headBranch: branch, baseBranch: "main", canUpdate: true };
      githubInfo = { ...githubInfo, lastPr: pr, openPrs: [pr, ...githubInfo.openPrs.filter((item) => item.number !== number)] };
    }
  } else if (url.endsWith("/github/diff")) {
    diffReads++;
    if (diffError) throw new Error(githubScenario === "diff-stale" ? "The GitHub branch changed. Refresh the comparison." : "Couldn't load this diff. Try again.");
    const path = config.params?.path as string;
    const kind = path === "public/logo.png" ? "binary" : path === "data/catalog.json" ? "large" : "text";
    data = {
      path, kind,
      patch: kind !== "text" ? null : path === "docs/README.md" || path === "LICENSE" ? `--- a/${path}\n+++ /dev/null\n@@ -1 +0,0 @@\n-Repository documentation\n` : path === "src/App.tsx" ? "--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1,5 +1,6 @@\n export function App() {\n   return (\n-    <h1>Welcome to Atlas</h1>\n+    <main>\n+      <RepositoryHeader title=\"Atlas workspace\" />\n+    </main>\n   );\n }\n" : `--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,3 @@\n+export function RepositoryHeader({ title }: { title: string }) {\n+  return <h1>{title}</h1>;\n+}\n`,
      additions: kind === "text" ? path === "docs/README.md" ? 0 : 3 : null, deletions: kind === "text" ? 1 : null,
    } satisfies GithubFileDiff;
  } else if (url.endsWith("/github/repository") && method === "post") {
    if (githubScenario === "creation-pending") await new Promise<never>(() => {});
    if (creationError) throw new Error("GitHub couldn't create this repository. The name may already be taken. Choose a different name.");
    const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    githubInfo = { ...githubInfo, repo: { fullName: `alex/${body.name}`, htmlUrl: `https://github.com/alex/${body.name}`, visibility: "private", defaultBranch: "main", canPush: true, canAdmin: true, canChangeVisibility: true }, lastPr: null, openPrs: [], lastPush: null };
    data = githubInfo.repo;
  } else if (url.endsWith("/github/link") && method === "delete") {
    githubInfo = { ...githubInfo, repo: null, lastPr: null, openPrs: [], lastPush: null };
    data = null;
  } else if (url === "/auth/github" && method === "delete") {
    githubInfo = { ...githubInfo, connected: false, repo: null, username: null };
    data = null;
  } else if (url.endsWith("/github")) {
    if (githubScenario === "loading") await new Promise<never>(() => {});
    if (githubError) throw new Error("GitHub unavailable");
    if (method === "patch") {
      const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
      if (body.private !== undefined) {
        if (githubScenario === "visibility-pending") await new Promise<never>(() => {});
        if (githubScenario === "visibility-error") throw new Error("GitHub refused the visibility change. Organization policy may block it.");
        githubInfo = { ...githubInfo, repo: { ...githubInfo.repo!, visibility: body.private ? "private" : "public" } };
      } else githubInfo = { ...githubInfo, pushMode: body.pushMode };
    }
    data = githubInfo;
  } else if (url.endsWith("/deploy") && method === "get") data = status;
  else if (url.endsWith("/deploy") && method === "post") {
    status = {
      ...status,
      inProgress: true,
      lastFailure: null,
      deployments: [
        {
          ...live,
          id: "new12345-6789",
          status: "BUILDING",
          createdAt: new Date().toISOString(),
          completedAt: null,
          isLive: false,
        },
        ...status.deployments,
      ],
    };
    commit();
    data = {
      jobId: "fake-job",
      deploymentId: "new12345-6789",
      slug: "atlas",
      url: status.url,
    };
  } else if (url.endsWith("/deploy") && method === "delete") {
    status = {
      ...status,
      live: null,
      deployments: status.deployments.map((d) =>
        d.isLive
          ? { ...d, status: "SUPERSEDED", isLive: false, canRollback: true }
          : d,
      ),
    };
    data = status;
  } else if (url.endsWith("/rollback")) {
    const target = status.deployments.find((d) => url.includes(d.id))!;
    const restored = {
      ...target,
      status: "READY" as const,
      isLive: true,
      canRollback: false,
    };
    status = {
      ...status,
      live: restored,
      lastFailure: null,
      deployments: status.deployments.map((d) =>
        d.id === target.id
          ? restored
          : { ...d, isLive: false, canRollback: true },
      ),
    };
    data = status;
  } else if (url.endsWith("/name-available"))
    data = {
      name: config.params.name,
      available: config.params.name !== "taken",
      locked: false,
      problem: null,
      message: "This address is taken.",
    };
  else if (url === "/credits/balance")
    data = { plan: "FREE", credits: { available: 500 } };
  else if (url.endsWith("/identity")) {
    if (method === "put") {
      const body = JSON.parse(config.data);
      identity = { ...identity, ...body };
      status = { ...status, unpublishedChanges: status.unpublishedChanges + 1 };
      commit();
    }
    data = identity;
  } else if (url.endsWith("/deploy/logs"))
    data = {
      logs: "[server] Listening on port 3000\n[server] GET /health 200",
    };
  else if (url.endsWith("/database/export"))
    data = new Blob(["fixture"], { type: "application/zip" });
  else if (url.endsWith("/storage/files"))
    data = { files: [], nextCursor: null };
  else if (url.endsWith("/storage"))
    data = {
      enabled: true,
      suspended: false,
      usage: { usedBytes: 0, quotaBytes: 100000000, maxFileBytes: 10000000 },
      environments: [
        { env: "PREVIEW", fileCount: 0, usedBytes: 0 },
        { env: "LIVE", fileCount: 0, usedBytes: 0 },
      ],
    };
  else if (url.endsWith("/domains"))
    data = { cnameTarget: "sites.bytauai.pro", domains: [] };
  else if (url.endsWith("/secrets")) data = { secrets: [] };
  else if (url.endsWith("/refresh-secrets")) data = { ok: true };
  else if (url.endsWith("/auth/me")) data = null;
  else data = {};
  return {
    data: structuredClone(data),
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
};
useProjectStore.getState().initProject(projectId);
useProjectStore.setState({ activeTab: "preview", status: githubScenario === "fix-busy" ? "streaming" : "idle", isChatOpen: false });
commit();

export function Harness() {
  const route = useLocation();
  const navigate = useNavigate();
  const [, tick] = useState(0);
  const chatOpen = useProjectStore((s) => s.isChatOpen);
  const projectStatus = useProjectStore((s) => s.status);
  const messageCount = useProjectStore((s) => s.chatMessages.length);
  return (
    <div className="flex h-screen flex-col">
      <div className={clean ? "hidden" : "flex flex-wrap gap-3 border-b border-silver-200 bg-space-surface p-2 text-xs text-silver-600"}>
        <output aria-label="Fixture route">{route.search}</output>
        <button onClick={() => tick((n) => n + 1)}>Check mutations</button>
        <output aria-label="Mutation count">{mutations}</output>
        <output aria-label="Last mutation body">{lastBody}</output>
        <output aria-label="Diff requests">{diffReads}</output>
        <output aria-label="PR detail requests">{prDetailReads}</output>
        <output aria-label="Issue detail requests">{issueDetailReads}</output>
        <output aria-label="Chat open">{String(chatOpen)}</output>
        <output aria-label="Project status">{projectStatus}</output>
        <output aria-label="Chat message count">{messageCount}</output>
        {scenario === "github" && <>
          <button onClick={() => navigate(-1)}>Back</button>
          <button onClick={() => { githubError = false; creationError = false; comparisonError = false; diffError = false; collaborationError = false; void queryClient.invalidateQueries({ queryKey: projectGithubKeys.info(projectId) }); }}>Recover GitHub</button>
          <button onClick={() => { githubError = true; void queryClient.invalidateQueries({ queryKey: projectGithubKeys.info(projectId) }); }}>Fail GitHub refresh</button>
          <button onClick={() => { useProjectStore.setState((s) => ({ headSequence: (s.headSequence ?? 0) + 1 })); }}>Edit project files</button>
        </>}
        <button
          onClick={() => {
            if (status.inProgress) {
              status.deployments[0].status = "VERIFYING";
              commit();
            }
          }}
        >
          Report verifying
        </button>
        <button
          onClick={() => {
            const latest = {
              ...status.deployments[0],
              status: "READY" as const,
              isLive: true,
              completedAt: new Date().toISOString(),
            };
            status = {
              ...status,
              live: latest,
              slug: "atlas",
              url: "https://atlas.bytauai.pro",
              suggestedName: null,
              inProgress: false,
              unpublishedChanges: 0,
              publishFee: { credits: 200, due: false },
              deployments: [
                latest,
                ...status.deployments.slice(1).map((d) => ({
                  ...d,
                  status: "SUPERSEDED" as const,
                  isLive: false,
                  canRollback: true,
                })),
              ],
            };
            commit();
          }}
        >
          Report ready
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <RightPanel />
      </div>
    </div>
  );
}
const root = createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter
          initialEntries={[
            `/project/${projectId}${scenario === "legacy" ? "?publish=1" : scenario === "github" ? `?tab=tools&tool=github&githubSection=${new URLSearchParams(location.search).get("githubSection") ?? "changes"}${new URLSearchParams(location.search).get("oauth") === "connected" ? "&github=connected" : ""}` : ""}`,
          ]}
        >
          <Harness />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
