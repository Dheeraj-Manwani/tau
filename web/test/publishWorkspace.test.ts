import { describe, expect, test } from "bun:test";
import type {
  DeploymentSummary,
  DeployStatus,
} from "../src/features/project/deploy";
import {
  deploymentDuration,
  deploymentSteps,
  deployPresentation,
  deploySectionAvailability,
  newestDeployments,
} from "../src/features/project/deployPresentation";
import {
  projectToolParams,
  selectedProjectTool,
  selectedDeploySection,
} from "../src/features/project/toolNavigation";

const deployment: DeploymentSummary = {
  id: "live-123",
  status: "READY",
  target: "STATIC",
  fileCount: 12,
  sizeBytes: 123456,
  error: null,
  createdAt: "2026-10-12T10:00:00Z",
  completedAt: "2026-10-12T10:01:05Z",
  isLive: true,
  canRollback: false,
};
const status: DeployStatus = {
  slug: "sample",
  url: "https://sample.bytauai.pro",
  primaryUrl: null,
  domain: "bytauai.pro",
  suggestedName: null,
  live: deployment,
  deployments: [deployment],
  inProgress: false,
  unpublishedChanges: 0,
  serverWarning: null,
  suspended: null,
  lastFailure: null,
  publishFee: { credits: 200, due: false },
  backendPublished: false,
  databasePublished: false,
  storagePublished: false,
};
const failure = {
  error: "Build failed",
  buildLog: null,
  schemaChanges: null,
  changedSince: false,
};

describe("deployment tab availability", () => {
  const first: DeployStatus = {
    ...status,
    slug: null,
    url: null,
    live: null,
    deployments: [],
    suggestedName: "sample",
  };
  test("first deployment offers overview and identity before any URL exists", () => {
    expect(deploySectionAvailability(first)).toEqual({
      overview: true,
      identity: true,
      deployments: false,
      resources: false,
    });
  });
  test("deployment activity appears while a request waits for its first row", () => {
    expect(deploySectionAvailability(first, true).deployments).toBe(true);
    expect(
      deploySectionAvailability({ ...first, inProgress: true }).deployments,
    ).toBe(true);
  });
  test("static sites have deployments without an empty resources tab", () => {
    expect(deploySectionAvailability(status)).toEqual({
      overview: true,
      identity: true,
      deployments: true,
      resources: false,
    });
    for (const resource of [
      "backendPublished",
      "databasePublished",
      "storagePublished",
    ] as const)
      expect(
        deploySectionAvailability({ ...status, [resource]: true }).resources,
      ).toBe(true);
  });
  test("offline sites retain their identity and deployment history", () => {
    expect(
      deploySectionAvailability({
        ...status,
        live: null,
        deployments: [{ ...deployment, status: "SUPERSEDED", isLive: false }],
      }).deployments,
    ).toBe(true);
  });
  test("a failure or schema review remains accessible before history refreshes", () => {
    expect(
      deploySectionAvailability({ ...first, lastFailure: failure }).deployments,
    ).toBe(true);
    expect(
      deploySectionAvailability({
        ...first,
        lastFailure: {
          ...failure,
          schemaChanges: [{ kind: "add", message: "Review" }],
        },
      }).deployments,
    ).toBe(true);
  });
});

describe("publishing status summary", () => {
  test("an update failure preserves the live status with a warning", () => {
    const view = deployPresentation({ ...status, lastFailure: failure });
    expect(view.label).toBe("Deployed");
    expect(view.tone).toBe("warning");
    expect(view.detail).toContain("previous version is still live");
  });
  test("a reserved URL and a failed first publish are never live", () => {
    expect(
      deployPresentation({ ...status, live: null, deployments: [] }).label,
    ).toBe("Deploy");
    expect(
      deployPresentation({
        ...status,
        live: null,
        deployments: [],
        lastFailure: failure,
      }).label,
    ).toBe("Deploy failed");
  });
  test("suspension overrides activity, and offline retains its identity", () => {
    expect(
      deployPresentation({
        ...status,
        inProgress: true,
        suspended: { reason: "Suspended" },
      }).label,
    ).toBe("Suspended");
    expect(
      deployPresentation({
        ...status,
        live: null,
        deployments: [{ ...deployment, status: "SUPERSEDED", isLive: false }],
        lastFailure: failure,
      }).label,
    ).toBe("Offline");
  });
  test("schema decisions are amber and do not imply a first publish is live", () => {
    expect(
      deployPresentation({
        ...status,
        live: null,
        lastFailure: {
          ...failure,
          schemaChanges: [{ kind: "drop", message: "Column changes" }],
        },
      }).label,
    ).toBe("Needs review");
    expect(
      deployPresentation({ ...status, unpublishedChanges: 2 }).detail,
    ).toContain("2 files changed");
  });
});

describe("reported deployment progress", () => {
  test("history is newest first without changing the server response", () => {
    const older = { ...deployment, id: "older", createdAt: "2026-10-11T10:00:00Z" };
    const newer = { ...deployment, id: "newer", createdAt: "2026-10-13T10:00:00Z", status: "BUILDING" as const };
    const deployments = [older, newer, deployment];
    expect(newestDeployments({ ...status, deployments }).map((row) => row.id)).toEqual(["newer", "live-123", "older"]);
    expect(deployments.map((row) => row.id)).toEqual(["older", "newer", "live-123"]);
  });
  test("history includes a missing live version once and tolerates invalid dates", () => {
    const older = { ...deployment, id: "older", createdAt: "2026-10-11T10:00:00Z" };
    const invalid = { ...deployment, id: "invalid", createdAt: "invalid" };
    expect(newestDeployments({ ...status, deployments: [invalid, older] }).map((row) => row.id)).toEqual(["live-123", "older", "invalid"]);
    expect(newestDeployments({ ...status, deployments: [deployment] })).toHaveLength(1);
  });
  test("static and fullstack order follows the actual publisher", () => {
    expect(
      deploymentSteps({ ...deployment, status: "UPLOADING" }).map((s) => s.id),
    ).toEqual(["QUEUED", "BUILDING", "UPLOADING", "READY"]);
    const steps = deploymentSteps({
      ...deployment,
      target: "FULLSTACK",
      status: "PROVISIONING",
    });
    expect(steps.map((s) => s.id)).toEqual([
      "QUEUED",
      "VALIDATING",
      "BUILDING",
      "UPLOADING",
      "PROVISIONING",
      "VERIFYING",
      "READY",
    ]);
    expect(steps.map((s) => s.state)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "active",
      "pending",
      "pending",
    ]);
  });
  test("a failed row never invents the missing failure stage", () => {
    expect(
      deploymentSteps({ ...deployment, status: "FAILED", error: "Stopped" }),
    ).toEqual([
      {
        id: "stopped",
        label: "Deployment stopped",
        detail: "Stopped",
        state: "failed",
      },
    ]);
    expect(
      deploymentSteps({ ...deployment, status: "FAILED" }, true)[0].state,
    ).toBe("review");
  });
  test("timing is total requested-to-completed time, not build time", () => {
    expect(deploymentDuration(deployment)).toBe("1m 5s");
    expect(
      deploymentDuration({ ...deployment, createdAt: "invalid" }),
    ).toBeNull();
  });
});

describe("publishing navigation", () => {
  test("shortcuts preserve unrelated project params and remove legacy flags", () => {
    const original = new URLSearchParams("publish=1&job=abc&storageEnv=LIVE");
    const routed = projectToolParams(original, "deploy", "deployments");
    expect(routed.get("tab")).toBe("tools");
    expect(routed.get("tool")).toBe("deploy");
    expect(routed.get("deploySection")).toBe("deployments");
    expect(routed.get("job")).toBe("abc");
    expect(routed.has("publish")).toBe(false);
    expect(routed.has("storageEnv")).toBe(false);
    expect(original.get("publish")).toBe("1");
  });
  test("old accordion links map into the combined workspace", () => {
    expect(selectedProjectTool(new URLSearchParams("tool=publish"))).toBe(
      "deploy",
    );
    for (const [old, section] of [
      ["activity", "deployments"],
      ["history", "deployments"],
      ["identity", "identity"],
      ["production", "resources"],
      ["manage", "overview"],
    ])
      expect(
        selectedDeploySection(new URLSearchParams(`publishSection=${old}`)),
      ).toBe(section);
    expect(
      selectedDeploySection(
        new URLSearchParams("deploySection=resources&publishSection=history"),
      ),
    ).toBe("resources");
    expect(
      projectToolParams(
        new URLSearchParams("tool=publish&publishSection=identity"),
        "deploy",
        "identity",
      ).toString(),
    ).toBe("tool=deploy&tab=tools&deploySection=identity");
  });
  test("legacy deep links and unknown values resolve safely", () => {
    expect(
      selectedProjectTool(new URLSearchParams("publish=1&tool=storage")),
    ).toBe("deploy");
    expect(selectedProjectTool(new URLSearchParams("tool=unknown"))).toBe(
      "secrets",
    );
    expect(
      selectedDeploySection(new URLSearchParams("publishSection=unknown")),
    ).toBe("overview");
    expect(
      projectToolParams(
        new URLSearchParams("publishSection=history"),
        "secrets",
      ).has("publishSection"),
    ).toBe(false);
  });
});
