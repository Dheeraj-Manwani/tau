import type {
  DeploymentStatus,
  DeploymentSummary,
  DeployStatus,
} from "./deploy";

export type DeployTone = "live" | "warning" | "busy" | "error" | "neutral";
const active: DeploymentStatus[] = [
  "QUEUED",
  "VALIDATING",
  "BUILDING",
  "UPLOADING",
  "PROVISIONING",
  "VERIFYING",
];
export function activeDeployment(status: DeployStatus) {
  return status.deployments.find(deploymentIsActive);
}

export function deploymentIsActive(deployment: DeploymentSummary) {
  return active.includes(deployment.status);
}

/** Include the live version once, even when it falls outside the history window. */
export function newestDeployments(status: DeployStatus): DeploymentSummary[] {
  const deployments = new Map(status.deployments.map((deployment) => [deployment.id, deployment]));
  if (status.live && !deployments.has(status.live.id)) deployments.set(status.live.id, status.live);
  const requestedAt = (deployment: DeploymentSummary) => {
    const time = Date.parse(deployment.createdAt);
    return Number.isFinite(time) ? time : 0;
  };
  return [...deployments.values()].sort((a, b) => requestedAt(b) - requestedAt(a));
}

/** Identity is editable before first deployment; empty data tabs stay hidden. */
export function deploySectionAvailability(
  status: DeployStatus,
  requestingDeploy = false,
) {
  return {
    overview: true,
    deployments: !!(
      status.deployments.length ||
      status.live ||
      status.inProgress ||
      requestingDeploy ||
      status.lastFailure
    ),
    identity: true,
    resources:
      status.backendPublished ||
      status.databasePublished ||
      status.storagePublished,
  };
}

export const stageLabels: Partial<Record<DeploymentStatus, string>> = {
  QUEUED: "Waiting to start",
  VALIDATING: "Check server & database",
  BUILDING: "Build app",
  UPLOADING: "Upload files",
  PROVISIONING: "Set up server",
  VERIFYING: "Verify server",
};

export function deployPresentation(status: DeployStatus) {
  if (status.suspended)
    return {
      label: "Suspended",
      tone: "error" as DeployTone,
      detail:
        status.suspended.reason ??
        "Visitors see a suspension notice. Deployment is unavailable.",
    };
  if (status.inProgress) {
    const attempt = activeDeployment(status);
    return {
      label: "Deploying…",
      tone: "busy" as DeployTone,
      detail: `${attempt ? stageLabels[attempt.status] : "Waiting to start"}…`,
    };
  }
  const review =
    status.lastFailure?.schemaChanges?.length &&
    !status.lastFailure.changedSince;
  if (status.live) {
    const n = status.unpublishedChanges;
    return {
      label: "Deployed",
      tone: (status.lastFailure || status.live.error || n > 0
        ? "warning"
        : "live") as DeployTone,
      detail: review
        ? "Database changes need your review. Your previous version is live."
        : status.lastFailure
          ? "The last update failed. Your previous version is still live."
          : status.live.error
            ? status.live.error
            : n > 0
              ? `${n} file${n === 1 ? "" : "s"} changed since last deployment.`
              : "Your app is up to date.",
    };
  }
  if (review)
    return {
      label: "Needs review",
      tone: "warning" as DeployTone,
      detail:
        "Review the database changes before deploying. No version is live.",
    };
  const offline = status.deployments.some((d) => d.status === "SUPERSEDED");
  if (offline)
    return {
      label: "Offline",
      tone: "neutral" as DeployTone,
      detail: "Your site is offline. The public address stays reserved.",
    };
  if (status.lastFailure)
    return {
      label: "Deploy failed",
      tone: "error" as DeployTone,
      detail: "Deploying failed. No version is live yet.",
    };
  return {
    label: "Deploy",
    tone: "neutral" as DeployTone,
    detail: "Give your app a public address anyone can open.",
  };
}

/** One meaning per colour (boards/Controls.dc.html status dots): green live,
 *  orange waiting or unpublished, blue working, red failed, grey offline. */
export const deployToneClass: Record<DeployTone, string> = {
  live: "bg-green-400",
  warning: "bg-orange-400",
  busy: "bg-blue-500",
  error: "bg-red-400",
  neutral: "bg-line-hover",
};

export interface DeployStep {
  id: string;
  label: string;
  detail: string;
  state: "done" | "active" | "pending" | "failed" | "review";
}

/** The DeployPipeline's node names (boards/Workspace-Deployments.dc.html). */
export const pipelineLabels: Record<string, string> = {
  QUEUED: "Queue",
  VALIDATING: "Check",
  BUILDING: "Build",
  UPLOADING: "Upload",
  PROVISIONING: "Server",
  VERIFYING: "Verify",
  READY: "Live",
};

/** The pipeline console's line for the stage running now. */
export function pipelineLine(deployment: DeploymentSummary): string {
  switch (deployment.status) {
    case "QUEUED":
      return "queued · waiting for a worker";
    case "VALIDATING":
      return "checking server and database";
    case "BUILDING":
      return "building app";
    case "UPLOADING":
      return deployment.fileCount > 0
        ? `uploading ${deployment.fileCount} files`
        : "uploading files";
    case "PROVISIONING":
      return "setting up the server";
    case "VERIFYING":
      return "verifying server health";
    default:
      return "switching traffic to the new version";
  }
}

/**
 * Only states recorded by the server are shown as completed. A failed row has
 * lost its stage, so it is a single "stopped" step unless this browser watched
 * the attempt and saw where it stopped (`failedAt`).
 */
export function deploymentSteps(
  deployment: DeploymentSummary,
  needsReview = false,
  failedAt: DeploymentStatus | null = null,
): DeployStep[] {
  const stoppedAt =
    deployment.status === "FAILED" && failedAt && failedAt !== "FAILED" && failedAt !== "SUPERSEDED"
      ? failedAt
      : null;
  if (deployment.status === "FAILED" && !stoppedAt)
    return [
      {
        id: "stopped",
        label: needsReview ? "Review database changes" : "Deployment stopped",
        detail: deployment.error ?? "This attempt did not go live.",
        state: needsReview ? "review" : "failed",
      },
    ];
  const at = stoppedAt ?? deployment.status;
  const fullstack =
    deployment.target === "FULLSTACK" ||
    ["VALIDATING", "PROVISIONING", "VERIFYING"].includes(at);
  const steps: { id: DeploymentStatus; label: string; detail: string }[] = [
    {
      id: "QUEUED",
      label: "Waiting to start",
      detail: "Your deploy request is queued for the deployment worker.",
    },
    ...(fullstack
      ? [
          {
            id: "VALIDATING" as const,
            label: "Check server & database",
            detail:
              "Checking the server configuration, required secrets and any database changes.",
          },
        ]
      : []),
    {
      id: "BUILDING",
      label: "Build app",
      detail: fullstack
        ? "Preparing the build environment and bundling your server and frontend."
        : "Preparing the build environment and creating production files.",
    },
    {
      id: "UPLOADING",
      label: "Upload files",
      detail:
        deployment.fileCount > 0
          ? `Uploading ${deployment.fileCount} production files.`
          : "Copying the production files to your deployed app.",
    },
    ...(fullstack
      ? [
          {
            id: "PROVISIONING" as const,
            label: "Set up server",
            detail:
              "Applying the production configuration and secrets to the hosted server.",
          },
          {
            id: "VERIFYING" as const,
            label: "Verify server",
            detail:
              "Checking that the new server responds before switching versions.",
          },
        ]
      : []),
    {
      id: "READY",
      label: "Make update live",
      detail: "Switching the public address to the new version.",
    },
  ];
  const complete =
    deployment.status === "READY" || deployment.status === "SUPERSEDED";
  const index = steps.findIndex((step) => step.id === at);
  return steps.map((step, i) => ({
    ...step,
    ...(stoppedAt && i === index
      ? { detail: deployment.error ?? "This attempt did not go live." }
      : {}),
    state:
      complete || (index >= 0 && i < index)
        ? "done"
        : i === index
          ? stoppedAt
            ? needsReview
              ? "review"
              : "failed"
            : "active"
          : "pending",
  }));
}

export function deploymentDuration(
  deployment: DeploymentSummary,
  now = Date.now(),
) {
  const seconds = Math.max(
    0,
    Math.floor(
      ((deployment.completedAt ? Date.parse(deployment.completedAt) : now) -
        Date.parse(deployment.createdAt)) /
        1000,
    ),
  );
  if (!Number.isFinite(seconds)) return null;
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
