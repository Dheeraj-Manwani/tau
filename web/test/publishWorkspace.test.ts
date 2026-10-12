import { describe, expect, test } from "bun:test";
import type {
  DeploymentSummary,
  DeployStatus,
} from "../src/features/project/deploy";
import {
  deploymentDuration,
  deploymentSteps,
  publishPresentation,
  publishSectionAvailability,
} from "../src/features/project/publishPresentation";
import {
  projectToolParams,
  selectedProjectTool,
  selectedPublishSection,
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

describe("publish section availability", () => {
  const unpublished: DeployStatus = {
    ...status,
    slug: null,
    url: null,
    live: null,
    deployments: [],
    suggestedName: "sample",
  };

  test("a first publish shows only the overview", () => {
    expect(publishSectionAvailability(unpublished)).toEqual({
      overview: true,
      activity: false,
      identity: false,
      production: false,
      history: false,
      manage: false,
    });
  });

  test("activity appears as soon as a request starts, before a row arrives", () => {
    expect(publishSectionAvailability(unpublished, true).activity).toBe(true);
    expect(
      publishSectionAvailability({ ...unpublished, inProgress: true }).activity,
    ).toBe(true);
    expect(publishSectionAvailability(unpublished, true).history).toBe(false);
  });

  test("a static live site keeps its details but has no resources group", () => {
    expect(publishSectionAvailability(status)).toEqual({
      overview: true,
      activity: true,
      identity: true,
      production: false,
      history: true,
      manage: true,
    });
    for (const resource of [
      "backendPublished",
      "databasePublished",
      "storagePublished",
    ] as const) {
      expect(
        publishSectionAvailability({ ...status, [resource]: true }).production,
      ).toBe(true);
    }
  });

  test("offline sites retain their address and attempts without empty management", () => {
    const available = publishSectionAvailability({
      ...status,
      live: null,
      deployments: [{ ...deployment, status: "SUPERSEDED", isLive: false }],
    });
    expect(available.identity).toBe(true);
    expect(available.activity).toBe(true);
    expect(available.history).toBe(true);
    expect(available.manage).toBe(false);
  });

  test("failure output remains available even before history refreshes", () => {
    const available = publishSectionAvailability({
      ...unpublished,
      lastFailure: { ...failure, buildLog: "Build output" },
    });
    expect(available.activity).toBe(true);
    expect(available.history).toBe(false);
  });
});

describe("publishing status summary", () => {
  test("an update failure preserves the live status with a warning", () => {
    const view = publishPresentation({ ...status, lastFailure: failure });
    expect(view.label).toBe("Deployed");
    expect(view.tone).toBe("warning");
    expect(view.detail).toContain("previous version is still live");
  });
  test("a reserved URL and a failed first publish are never live", () => {
    expect(
      publishPresentation({ ...status, live: null, deployments: [] }).label,
    ).toBe("Publish");
    expect(
      publishPresentation({
        ...status,
        live: null,
        deployments: [],
        lastFailure: failure,
      }).label,
    ).toBe("Publish failed");
  });
  test("suspension overrides activity, and offline retains its identity", () => {
    expect(
      publishPresentation({
        ...status,
        inProgress: true,
        suspended: { reason: "Suspended" },
      }).label,
    ).toBe("Suspended");
    expect(
      publishPresentation({
        ...status,
        live: null,
        deployments: [{ ...deployment, status: "SUPERSEDED", isLive: false }],
        lastFailure: failure,
      }).label,
    ).toBe("Offline");
  });
  test("schema decisions are amber and do not imply a first publish is live", () => {
    expect(
      publishPresentation({
        ...status,
        live: null,
        lastFailure: {
          ...failure,
          schemaChanges: [{ kind: "drop", message: "Column changes" }],
        },
      }).label,
    ).toBe("Needs review");
    expect(
      publishPresentation({ ...status, unpublishedChanges: 2 }).detail,
    ).toContain("2 files changed");
  });
});

describe("reported deployment progress", () => {
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
        label: "Publishing stopped",
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
    const routed = projectToolParams(original, "publish", "history");
    expect(routed.get("tab")).toBe("tools");
    expect(routed.get("tool")).toBe("publish");
    expect(routed.get("publishSection")).toBe("history");
    expect(routed.get("job")).toBe("abc");
    expect(routed.has("publish")).toBe(false);
    expect(routed.has("storageEnv")).toBe(false);
    expect(original.get("publish")).toBe("1");
  });
  test("legacy deep links and unknown values resolve safely", () => {
    expect(
      selectedProjectTool(new URLSearchParams("publish=1&tool=storage")),
    ).toBe("publish");
    expect(selectedProjectTool(new URLSearchParams("tool=unknown"))).toBe(
      "secrets",
    );
    expect(
      selectedPublishSection(new URLSearchParams("publishSection=unknown")),
    ).toBe("overview");
    expect(
      projectToolParams(
        new URLSearchParams("publishSection=history"),
        "secrets",
      ).has("publishSection"),
    ).toBe(false);
  });
});
