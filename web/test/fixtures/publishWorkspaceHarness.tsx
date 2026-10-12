import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { RightPanel } from "../../src/features/project/RightPanel";
import { api } from "../../src/lib/api-client";
import { queryClient } from "../../src/lib/query-client";
import { useProjectStore } from "../../src/stores/useProjectStore";
import {
  deployKeys,
  type DeploymentSummary,
  type DeployStatus,
} from "../../src/features/project/deploy";
import "../../src/index.css";

// Browser-only fixture: the actual project shell and controls, with no real network requests.
const projectId = "publish-ui-fixture";
const scenario = new URLSearchParams(location.search).get("scenario") ?? "live";
const now = new Date().toISOString();
const live: DeploymentSummary = {
  id: "live1234-5678",
  status: "READY",
  target: "FULLSTACK",
  fileCount: 24,
  sizeBytes: 340000,
  error: null,
  createdAt: now,
  completedAt: now,
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
      { ...live, id: "failed12-5678", status: "FAILED", error, isLive: false },
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
  if (url.endsWith("/deploy") && method === "get") data = status;
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
  else if (url.endsWith("/identity"))
    data = {
      title: "Atlas",
      description: "A sample app",
      icon: "default",
      projectName: "Atlas",
      plan: "FREE",
      prices: { publishFee: 200, logoUpload: 25, logoGeneration: 20 },
      canGenerate: true,
      generationsLeftToday: 2,
    };
  else if (url.endsWith("/deploy/logs"))
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
  else if (url.endsWith("/github"))
    data = { connected: false, repo: null, unpushedChanges: 0 };
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
  const [, tick] = useState(0);
  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-wrap gap-3 border-b border-silver-200 bg-space-surface p-2 text-xs text-silver-600">
        <output aria-label="Fixture route">{route.search}</output>
        <button onClick={() => tick((n) => n + 1)}>Check mutations</button>
        <output aria-label="Mutation count">{mutations}</output>
        <output aria-label="Last mutation body">{lastBody}</output>
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
            `/project/${projectId}${scenario === "legacy" ? "?publish=1" : ""}`,
          ]}
        >
          <Harness />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
