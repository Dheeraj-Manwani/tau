import type {
  DeploymentStatus,
  DeploymentSummary,
  DeployStatus,
} from "./deploy";

export type PublishTone = "live" | "warning" | "busy" | "error" | "neutral";
const active: DeploymentStatus[] = [
  "QUEUED",
  "VALIDATING",
  "BUILDING",
  "UPLOADING",
  "PROVISIONING",
  "VERIFYING",
];
export function activeDeployment(status: DeployStatus) {
  return status.deployments.find((deployment) =>
    active.includes(deployment.status),
  );
}

/** Show a group only when it has publishing details or an action to offer. */
export function publishSectionAvailability(
  status: DeployStatus,
  requestingPublish = false,
) {
  return {
    overview: true,
    activity: !!(
      status.deployments.length ||
      status.live ||
      status.inProgress ||
      requestingPublish ||
      status.lastFailure?.buildLog
    ),
    identity: !!(status.primaryUrl || status.url),
    production:
      status.backendPublished ||
      status.databasePublished ||
      status.storagePublished,
    history: status.deployments.length > 0,
    manage: !!(status.live || status.suspended),
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

export function publishPresentation(status: DeployStatus) {
  if (status.suspended)
    return {
      label: "Suspended",
      tone: "error" as PublishTone,
      detail:
        status.suspended.reason ??
        "Visitors see a suspension notice. Publishing is unavailable.",
    };
  if (status.inProgress) {
    const attempt = activeDeployment(status);
    return {
      label: "Publishing…",
      tone: "busy" as PublishTone,
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
        : "live") as PublishTone,
      detail: review
        ? "Database changes need your review. Your previous version is live."
        : status.lastFailure
          ? "The last update failed. Your previous version is still live."
          : status.live.error
            ? status.live.error
            : n > 0
              ? `${n} file${n === 1 ? "" : "s"} changed since last publish.`
              : "Your app is up to date.",
    };
  }
  if (review)
    return {
      label: "Needs review",
      tone: "warning" as PublishTone,
      detail:
        "Review the database changes before publishing. No version is live.",
    };
  const offline = status.deployments.some((d) => d.status === "SUPERSEDED");
  if (offline)
    return {
      label: "Offline",
      tone: "neutral" as PublishTone,
      detail: "Your site is offline. The public address stays reserved.",
    };
  if (status.lastFailure)
    return {
      label: "Publish failed",
      tone: "error" as PublishTone,
      detail: "Publishing failed. No version is live yet.",
    };
  return {
    label: "Publish",
    tone: "neutral" as PublishTone,
    detail: "Give your app a public address anyone can open.",
  };
}

export const publishToneClass: Record<PublishTone, string> = {
  live: "bg-emerald-400",
  warning: "bg-amber-400",
  busy: "bg-blue-400",
  error: "bg-red-400",
  neutral: "bg-silver-400",
};

export interface PublishStep {
  id: string;
  label: string;
  detail: string;
  state: "done" | "active" | "pending" | "failed" | "review";
}

/** Only states recorded by the server are shown as completed. Failed rows lose their stage. */
export function deploymentSteps(
  deployment: DeploymentSummary,
  needsReview = false,
): PublishStep[] {
  if (deployment.status === "FAILED")
    return [
      {
        id: "stopped",
        label: needsReview ? "Review database changes" : "Publishing stopped",
        detail: deployment.error ?? "This attempt did not go live.",
        state: needsReview ? "review" : "failed",
      },
    ];
  const fullstack =
    deployment.target === "FULLSTACK" ||
    ["VALIDATING", "PROVISIONING", "VERIFYING"].includes(deployment.status);
  const steps: { id: DeploymentStatus; label: string; detail: string }[] = [
    {
      id: "QUEUED",
      label: "Waiting to start",
      detail: "Your publish request is queued for the publisher.",
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
          : "Copying the production files to your published app.",
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
  const index = steps.findIndex((step) => step.id === deployment.status);
  return steps.map((step, i) => ({
    ...step,
    state:
      complete || (index >= 0 && i < index)
        ? "done"
        : i === index
          ? "active"
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
