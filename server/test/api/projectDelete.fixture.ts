import { beforeEach, describe, expect, mock, test } from "bun:test";

// Deleting a project: what it stops first, the order it takes things apart in,
// and what it leaves alone when a step fails. The database, the bucket, AWS,
// Cloudflare and E2B are stand-ins that write down what they were asked; the
// bus, the service and the two reference counts are the real ones.

type Row = Record<string, any>;
const events: string[] = [];
const projects: Row[] = [];
const jobs: Row[] = [];
/** One row per attachment: the file it points at and the project its message is in. */
const attachments: Row[] = [];
const deletedObjects: string[] = [];
const terminated: Row[] = [];
let failBackend = false;

mock.module("@/lib/prisma", () => ({
  prisma: {
    job: {
      findMany: async ({ where }: { where: Row }) =>
        jobs.filter((j) => j.projectId === where.projectId && where.status.in.includes(j.status)),
    },
    project: {
      findUnique: async ({ where }: { where: Row }) => projects.find((p) => p.id === where.id) ?? null,
      count: async ({ where }: { where: Row }) =>
        projects.filter((p) => p.userId === where.userId && p.designConfig?.reference?.hash === where.designConfig.equals).length,
    },
    attachment: {
      findMany: async ({ where }: { where: Row }) => attachments.filter((a) => a.projectId === where.message.projectId && a.blobKey),
      count: async ({ where }: { where: Row }) => attachments.filter((a) => a.blobKey === where.blobKey).length,
    },
  },
}));

const realRepo = await import("@/api/repositories/project.repository");
mock.module("@/api/repositories/project.repository", () => ({
  ...realRepo,
  findProjectById: async (id: string) => projects.find((p) => p.id === id) ?? null,
  deleteProject: async (id: string) => {
    events.push("rows");
    // What the cascade does.
    projects.splice(projects.findIndex((p) => p.id === id), 1);
    for (let i = attachments.length - 1; i >= 0; i--) if (attachments[i]!.projectId === id) attachments.splice(i, 1);
  },
}));

const realS3 = await import("@/lib/s3");
mock.module("@/lib/s3", () => ({
  ...realS3,
  deleteProjectBlobs: async (userId: string, projectId: string) => void events.push(`files:${userId}/${projectId}`),
  deleteSitePrefix: async (prefix: string) => (events.push(`sites:${prefix}`), 0),
  deleteObject: async (key: string) => void deletedObjects.push(key),
}));

const realBucket = await import("@/lib/storageBucket");
mock.module("@/lib/storageBucket", () => ({
  ...realBucket,
  storageConfigured: () => true,
  deleteStoragePrefix: async (prefix: string) => (events.push(`storage:${prefix}`), 0),
}));
const realKeys = await import("@/lib/storageKeys");
mock.module("@/lib/storageKeys", () => ({ ...realKeys, revokeStorageKeys: async () => (events.push("storage-keys"), 0) }));

const realLambda = await import("@/lib/lambdaApps");
mock.module("@/lib/lambdaApps", () => ({
  ...realLambda,
  removeBackend: async () => {
    if (failBackend) throw new Error("AWS is down");
    events.push("backend");
  },
}));
const realNeon = await import("@/lib/neonApps");
mock.module("@/lib/neonApps", () => ({ ...realNeon, scheduleDatabaseRemoval: async () => void events.push("database-scheduled") }));
const realEdge = await import("@/lib/edgeRegistry");
mock.module("@/lib/edgeRegistry", () => ({ ...realEdge, removeSite: async (slug: string) => void events.push(`edge:${slug}`) }));
const realDomains = await import("@/api/services/domain.service");
mock.module("@/api/services/domain.service", () => ({ ...realDomains, releaseProjectDomains: async () => void events.push("domains") }));
const realJobs = await import("@/api/lib/jobs");
mock.module("@/api/lib/jobs", () => ({
  ...realJobs,
  terminateStrandedJob: async (jobId: string, opts: Row) => {
    terminated.push({ jobId, status: opts.status });
    jobs.find((j) => j.id === jobId)!.status = opts.status;
    return true;
  },
}));

const { Sandbox } = await import("e2b");
(Sandbox as any).kill = async (id: string) => (events.push(`sandbox:${id}`), true);

const { bus } = await import("@/lib/bus");
const { deleteProject, stopProjectJobs } = await import("@/api/services/project.service");
const { processJob } = await import("@/worker/index");

const HASH = "a".repeat(64);

function project(over: Row = {}) {
  const p = { id: "p1", userId: "u1", slug: "my-app", sandboxId: "sbx-1", designConfig: null, ...over };
  projects.push(p);
  return p;
}

async function failure(run: () => Promise<unknown>): Promise<{ statusCode?: number; message: string }> {
  try {
    await run();
  } catch (err) {
    return err as { statusCode?: number; message: string };
  }
  throw new Error("expected it to be refused");
}

beforeEach(() => {
  for (const e of bus.registrySnapshot()) bus.clearResident(e.jobId);
  events.length = 0;
  projects.length = 0;
  jobs.length = 0;
  attachments.length = 0;
  deletedObjects.length = 0;
  terminated.length = 0;
  failBackend = false;
  project();
});

describe("the order a project is taken apart in", () => {
  test("what can be retried goes first, the files after it, the rows last", async () => {
    await deleteProject("p1", "u1");

    expect(events).toEqual([
      "sandbox:sbx-1",
      "backend",
      "files:u1/p1",
      "sites:tau/sites/u1/p1",
      "storage-keys",
      "storage:apps/p1/",
      "domains",
      "database-scheduled",
      "rows",
      "edge:my-app",
    ]);
  });

  test("a failure at AWS leaves the project whole", async () => {
    failBackend = true;
    expect((await failure(() => deleteProject("p1", "u1"))).message).toBe("AWS is down");

    expect(events.filter((e) => /^(files|sites|storage|rows|database)/.test(e))).toEqual([]);
    expect(projects).toHaveLength(1);
  });

  test("somebody else's project is refused before anything is touched", async () => {
    expect((await failure(() => deleteProject("p1", "u2"))).statusCode).toBe(403);
    expect(events).toEqual([]);
  });

  test("a project that never had a sandbox asks nothing of E2B", async () => {
    projects[0]!.sandboxId = null;
    await deleteProject("p1", "u1");
    expect(events.some((e) => e.startsWith("sandbox:"))).toBe(false);
  });
});

describe("what is running when a project is deleted", () => {
  test("a publish in progress refuses the delete, and is not stopped", async () => {
    jobs.push({ id: "j-deploy", projectId: "p1", status: "RUNNING", type: "DEPLOY" });
    bus.markResident("j-deploy", { projectId: "p1" });

    const refused = await failure(() => deleteProject("p1", "u1"));
    expect(refused.statusCode).toBe(409);
    expect(refused.message).toContain("being published");
    expect(bus.isCancelled("j-deploy")).toBe(false);
    expect(events).toEqual([]);
  });

  test("a run is told to stop, and nothing is deleted until it has", async () => {
    jobs.push({ id: "j-run", projectId: "p1", status: "RUNNING", type: "GENERATION" });
    bus.markResident("j-run", { projectId: "p1" });
    // The runner, leaving at its next turn.
    bus.onCancel("j-run", () => {
      setTimeout(() => {
        events.push("run-stopped");
        bus.clearResident("j-run");
      }, 300);
    });

    await deleteProject("p1", "u1");
    expect(events[0]).toBe("run-stopped");
    expect(events).toContain("rows");
  });

  test("a run that does not stop in time refuses the delete, having been told to", async () => {
    jobs.push({ id: "j-slow", projectId: "p1", status: "RUNNING", type: "GENERATION" });
    bus.markResident("j-slow", { projectId: "p1" });

    const refused = await failure(() => stopProjectJobs("p1", 300));
    expect(refused.statusCode).toBe(409);
    expect(refused.message).toContain("still stopping");
    expect(bus.isCancelled("j-slow")).toBe(true);
  });

  test("a run in another project is left alone", async () => {
    bus.markResident("j-other", { projectId: "p2" });
    await deleteProject("p1", "u1");
    expect(bus.isCancelled("j-other")).toBe(false);
    expect(events).toContain("rows");
  });

  test("a job still waiting its turn is ended, and the runner does not start it afterwards", async () => {
    jobs.push({ id: "j-queued", projectId: "p1", status: "QUEUED", type: "GENERATION" });

    await deleteProject("p1", "u1");
    expect(terminated).toEqual([{ jobId: "j-queued", status: "CANCELLED" }]);

    // The stand-in database has no way to start a job: reaching it would throw.
    await processJob({ jobId: "j-queued", projectId: "p1", userId: "u1", prompt: "", effort: "LOW" } as never);
    expect(bus.isResident("j-queued")).toBe(false);
  });
});

describe("files shared with the user's other projects", () => {
  test("an attachment file goes only when nothing else points at it", async () => {
    project({ id: "p2", slug: null, sandboxId: null });
    attachments.push(
      { blobKey: "tau/attachments/u1/only-here", projectId: "p1" },
      { blobKey: "tau/attachments/u1/shared", projectId: "p1" },
      { blobKey: "tau/attachments/u1/shared", projectId: "p2" },
    );

    await deleteProject("p1", "u1");
    expect(deletedObjects).toEqual(["tau/attachments/u1/only-here"]);
  });

  test("a design's reference picture goes with the last project made from it", async () => {
    projects[0]!.designConfig = { designMd: "# Design", reference: { hash: HASH, mimeType: "image/png" } };
    project({ id: "p2", slug: null, sandboxId: null, designConfig: { designMd: "# Design", reference: { hash: HASH, mimeType: "image/png" } } });

    await deleteProject("p1", "u1");
    expect(deletedObjects).toEqual([]);

    await deleteProject("p2", "u1");
    expect(deletedObjects).toEqual([`tau/design-references/u1/${HASH}`]);
  });
});
