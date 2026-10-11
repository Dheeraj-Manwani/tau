import { beforeEach, expect, mock, test } from "bun:test";

// The hourly retry for custom hostnames Cloudflare could not be told to drop
// when their domain was removed. The table and Cloudflare are stand-ins.

type Row = Record<string, any>;
let resources: Row[] = [];
let domains: Row[] = [];
const removed: string[] = [];
let cloudflareDown = false;

mock.module("@/lib/prisma", () => ({
  prisma: {
    projectResource: {
      findMany: async ({ where }: { where: Row }) =>
        resources.filter((r) => (where.kind?.in ? where.kind.in.includes(r.kind) : r.kind === where.kind) && r.deletedAt === null),
      updateMany: async () => ({ count: 0 }),
      update: async ({ where, data }: { where: Row; data: Row }) => Object.assign(resources.find((r) => r.id === where.id)!, data),
    },
    domain: {
      count: async ({ where }: { where: Row }) => domains.filter((d) => d.cloudflareHostnameId === where.cloudflareHostnameId).length,
    },
  },
}));

const realHostnames = await import("@/lib/cloudflareHostnames");
mock.module("@/lib/cloudflareHostnames", () => ({
  ...realHostnames,
  hostnamesConfig: () => ({ zoneId: "z", token: "t", cnameTarget: "cname.bytauai.pro" }),
  cloudflareHostnames: () => ({
    remove: async (id: string) => {
      if (cloudflareDown) throw new Error("Cloudflare is down");
      removed.push(id);
    },
  }),
}));

const { reconcileResources } = await import("@/lib/reconcileResources");

beforeEach(() => {
  resources = [{ id: "r1", kind: "CUSTOM_HOSTNAME", providerId: "cf-1", projectId: null, deletedAt: null, createdAt: new Date() }];
  domains = [];
  removed.length = 0;
  cloudflareDown = false;
});

test("a hostname left behind is removed and its row closed", async () => {
  const result = await reconcileResources();
  expect(removed).toEqual(["cf-1"]);
  expect(result.hostnamesRemoved).toBe(1);
  expect(resources[0]!.deletedAt).toBeInstanceOf(Date);
});

test("while Cloudflare is still down the row stays for the next pass", async () => {
  cloudflareDown = true;
  const result = await reconcileResources();
  expect(result.hostnamesRemoved).toBe(0);
  expect(result.errors).toHaveLength(1);
  expect(resources[0]!.deletedAt).toBeNull();
});

test("a hostname a domain has taken over since is kept, and not asked about again", async () => {
  domains.push({ cloudflareHostnameId: "cf-1" });
  const result = await reconcileResources();
  expect(removed).toEqual([]);
  expect(result.hostnamesRemoved).toBe(0);
  expect(resources[0]!.deletedAt).toBeInstanceOf(Date);
});
