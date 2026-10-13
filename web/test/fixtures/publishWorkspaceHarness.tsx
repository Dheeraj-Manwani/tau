import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { RightPanel } from "../../src/features/project/RightPanel";
import { api } from "../../src/lib/api-client";
import { queryClient } from "../../src/lib/query-client";
import { useProjectStore } from "../../src/stores/useProjectStore";
import { projectGithubKeys, type GithubProjectInfo } from "../../src/features/project/github";
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
let repoError = githubScenario === "repos-error";
let githubInfo: GithubProjectInfo = {
  connected: scenario === "github" && githubScenario !== "disconnected",
  username: "alex",
  repo: scenario === "github" && !["unlinked", "disconnected", "repos-error"].includes(githubScenario)
    ? { fullName: "acme/atlas", htmlUrl: "https://github.com/acme/atlas", visibility: "private", defaultBranch: "main" }
    : null,
  lastPr: { number: 42, title: "Add workspace navigation", state: "open", url: "https://github.com/acme/atlas/pull/42" },
  openPrs: [
    { number: 42, title: "Add workspace navigation", state: "open", url: "https://github.com/acme/atlas/pull/42" },
    { number: 39, title: "Improve mobile layout", state: "open", url: "https://github.com/acme/atlas/pull/39" },
  ],
  unpushedChanges: 3,
  pushMode: "new_pr",
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
  if (url.endsWith("/github/repos")) {
    if (repoError) throw new Error("Repository lookup unavailable");
    data = { repos: [
      { fullName: "acme/atlas", private: true, htmlUrl: "https://github.com/acme/atlas" },
      { fullName: "acme/atlas-next", private: false, htmlUrl: "https://github.com/acme/atlas-next" },
    ] };
  } else if (url.endsWith("/github/link")) {
    const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    githubInfo = { ...githubInfo, repo: method === "delete" ? null : { fullName: body.repo, htmlUrl: `https://github.com/${body.repo}`, visibility: "private", defaultBranch: "main" }, lastPr: null, unpushedChanges: 0 };
    data = githubInfo.repo;
  } else if (url === "/auth/github" && method === "delete") {
    githubInfo = { ...githubInfo, connected: false, repo: null, username: null };
    data = null;
  } else if (url.endsWith("/github")) {
    if (githubScenario === "loading") await new Promise<never>(() => {});
    if (githubError) throw new Error("GitHub unavailable");
    if (method === "patch") {
      const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
      githubInfo = { ...githubInfo, pushMode: body.pushMode };
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
useProjectStore.setState({ activeTab: "preview", status: "idle" });
commit();

export function Harness() {
  const route = useLocation();
  const navigate = useNavigate();
  const [, tick] = useState(0);
  return (
    <div className="flex h-screen flex-col">
      <div className={clean ? "hidden" : "flex flex-wrap gap-3 border-b border-silver-200 bg-space-surface p-2 text-xs text-silver-600"}>
        <output aria-label="Fixture route">{route.search}</output>
        <button onClick={() => tick((n) => n + 1)}>Check mutations</button>
        <output aria-label="Mutation count">{mutations}</output>
        <output aria-label="Last mutation body">{lastBody}</output>
        {scenario === "github" && <>
          <button onClick={() => navigate(-1)}>Back</button>
          <button onClick={() => { githubError = false; repoError = false; void queryClient.invalidateQueries({ queryKey: projectGithubKeys.info(projectId) }); }}>Recover GitHub</button>
          <button onClick={() => { githubError = true; void queryClient.invalidateQueries({ queryKey: projectGithubKeys.info(projectId) }); }}>Fail GitHub refresh</button>
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
