import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { createHash } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";

const PID = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const gitSha = (bytes: Uint8Array) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
let project = { id: PID, userId: "owner", githubRepo: "acme/atlas", githubPushMode: "new_pr", headSequence: 30, lastPrNumber: 42, lastPushedBranch: "tau/update", githubDefaultBranch: "main", githubVisibility: "private", lastPushedSequence: 1 };
let localFiles: { path: string; contentHash: string; sizeBytes: number }[] = [];
let remoteFiles: { path: string; type: string; mode: string; sha: string; size: number }[] = [];
let localBlobs = new Map<string, Uint8Array>();
let remoteBlobs = new Map<string, Uint8Array>();
let connected = true;
let revoked = 0;
let requests: { path: string; method: string }[] = [];
let head = "a".repeat(40);
let truncated = false;
let upstreamStatus = 0;
let failurePath = "";
let prState = "open";
let prRepo: string | null = "acme/atlas";
let duringRead: (() => void) | null = null;

mock.module("@/lib/prisma", () => ({ prisma: {
  project: {
    findUnique: async ({ where }: { where: { id: string } }) => where.id === PID || where.id === OTHER ? { ...project, id: where.id } : null,
    update: async () => ({ ...project }),
  },
  projectFile: { findMany: async () => structuredClone(localFiles) },
  oAuthAccount: {
    findFirst: async () => connected ? { accessToken: "fixture-github-token" } : null,
    deleteMany: async () => { revoked++; connected = false; return { count: 1 }; },
  },
  $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
} }));
mock.module("@/lib/s3", () => ({
  getBlob: async (_u: string, _p: string, hash: string) => {
    const bytes = localBlobs.get(hash);
    if (!bytes) throw new Error("missing blob");
    if (duringRead) { const run = duringRead; duringRead = null; run(); }
    return bytes;
  },
  getBlobText: async (_u: string, _p: string, hash: string) => {
    const bytes = localBlobs.get(hash); if (!bytes) throw new Error("missing blob"); return new TextDecoder().decode(bytes);
  },
  putBlob: async () => { throw new Error("Comparison must never write blobs"); },
}));

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.startsWith("https://api.github.com")) return realFetch(input, init);
  const path = url.slice("https://api.github.com".length);
  requests.push({ path, method: init?.method ?? "GET" });
  if (init?.method && init.method !== "GET") throw new Error("Comparison must not mutate GitHub");
  if (upstreamStatus && (!failurePath || path.includes(failurePath))) return Response.json({ message: upstreamStatus === 403 && failurePath === "rate" ? "rate limit exceeded" : "Unavailable" }, { status: upstreamStatus });
  if (path === "/user") return Response.json({ id: 1, login: "alex" });
  if (path.includes("/git/ref/")) return Response.json({ object: { sha: head } });
  if (path.includes("/git/commits/")) return Response.json({ tree: { sha: "b".repeat(40) } });
  if (path.includes("/git/trees/")) return Response.json({ tree: remoteFiles, truncated });
  if (path.includes("/git/blobs/")) {
    const bytes = remoteBlobs.get(path.split("/").at(-1)!);
    if (!bytes) return Response.json({}, { status: 404 });
    return Response.json({ content: Buffer.from(bytes).toString("base64"), encoding: "base64", size: bytes.length });
  }
  if (path.includes("/pulls/")) return Response.json({ number: 42, title: "Update atlas", state: prState, html_url: "https://github.com/acme/atlas/pull/42", head: { ref: "tau/update", repo: prRepo ? { full_name: prRepo } : null }, base: { ref: "main" }, draft: true, user: { login: "alex" }, body: "Details", updated_at: "2026-10-13T12:00:00Z" });
  if (path.includes("/pulls?")) return Response.json([]);
  return Response.json({ default_branch: "main", full_name: "acme/atlas", name: "atlas", owner: { login: "acme" }, html_url: "https://github.com/acme/atlas", private: true });
}) as typeof fetch;

const controller = await import("@/api/controllers/githubProject.controller");
const { requireAuth } = await import("@/api/middleware/auth.middleware");
const { issueAccessToken } = await import("@/api/lib/tokens");
const { AppError } = await import("@/api/lib/errors");
const { env } = await import("@/lib/env");
const app = express();
app.use(requireAuth);
app.get("/project/:projectId/github/changes", controller.changes);
app.get("/project/:projectId/github/diff", controller.diff);
app.get("/project/:projectId/github", controller.getInfo);
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err instanceof AppError ? err.statusCode : 500).json({ error: err instanceof Error ? err.message : String(err) });
});
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address() as { port: number };
const apiToken = issueAccessToken({ id: "owner", email: "owner@example.test" });
async function request(endpoint: string, params: Record<string, string> = {}, user = "owner", projectId = PID) {
  const token = user === "owner" ? apiToken : user ? issueAccessToken({ id: user, email: "test@example.test" }) : null;
  return fetch(`http://127.0.0.1:${address.port}/project/${projectId}/github${endpoint}?${new URLSearchParams(params)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}
function local(path: string, content: string | Uint8Array) {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  const hash = sha256(bytes); localBlobs.set(hash, bytes);
  localFiles = localFiles.filter((f) => f.path !== path);
  localFiles.push({ path, contentHash: hash, sizeBytes: bytes.length }); localFiles.sort((a, b) => a.path.localeCompare(b.path));
}
function remote(path: string, content: string | Uint8Array, mode = "100644") {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  const sha = gitSha(bytes); remoteBlobs.set(sha, bytes);
  remoteFiles.push({ path, type: "blob", mode, sha, size: bytes.length });
}
async function comparison(params: Record<string, string> = {}) {
  const res = await request("/changes", params);
  const body = await res.json();
  expect(res.status, JSON.stringify(body)).toBe(200);
  return body as import("@/api/lib/githubComparison").GithubComparison;
}

beforeEach(() => {
  localFiles = []; remoteFiles = []; localBlobs = new Map(); remoteBlobs = new Map(); requests = [];
  connected = true; revoked = 0; head = "a".repeat(40); truncated = false; upstreamStatus = 0; failurePath = ""; prState = "open"; prRepo = "acme/atlas"; duringRead = null;
  project = { ...project, userId: "owner", githubRepo: "acme/atlas", headSequence: 30, githubPushMode: "new_pr", lastPrNumber: 42, lastPushedBranch: "tau/update" };
  local("src/App.tsx", "export const title = 'New';\n"); remote("src/App.tsx", "export const title = 'Old';\n");
  local("unchanged.ts", "same\n"); remote("unchanged.ts", "same\n", "100755");
  local("new.ts", "added\n"); remote("docs/README.md", "Keep this repository file\n");
  local(".gitignore", "dist/\n"); remote(".gitignore", "dist/\n");
  local("dist/build.js", "ignored"); local(".env", "secret"); remote(".env", "remote secret");
});
afterAll(() => { server.close(); globalThis.fetch = realFetch; });

test("counts exact content differences, preserves remote-only files and excludes credentials/ignored paths", async () => {
  const result = await comparison();
  expect(result.counts).toEqual({ added: 1, modified: 1, deleted: 0, total: 2 });
  expect(result.files.map((f) => f.path)).toEqual(["new.ts", "src/App.tsx"]);
  expect(result.repositoryOnly.map((f) => f.path)).toEqual(["docs/README.md"]);
  expect(result.excludedCount).toBe(2);
  expect(requests.some((r) => r.path.includes("/git/blobs/"))).toBe(false);
  expect(requests.every((r) => r.method === "GET")).toBe(true);
  local("src/App.tsx", "export const title = 'Old';\n"); project.headSequence = 99;
  expect((await comparison()).counts).toEqual({ added: 1, modified: 0, deleted: 0, total: 1 });
});
test("loads exact text diffs lazily and recognizes content-based binaries", async () => {
  local("data.unknown", new Uint8Array([0, 4, 255]));
  const result = await comparison();
  expect(result.files.find((f) => f.path === "data.unknown")?.kind).toBe("binary");
  const res = await request("/diff", { path: "src/App.tsx", preview: result.preview });
  const diff = await res.json(); expect(res.status).toBe(200);
  expect(diff.additions).toBe(1); expect(diff.deletions).toBe(1);
  expect(diff.patch).toContain("-export const title = 'Old';"); expect(diff.patch).toContain("+export const title = 'New';");
});
test("byte-order mark changes remain visible in the diff instead of disappearing during decoding", async () => {
  local("bom.txt", "\ufeffsame\n"); remote("bom.txt", "same\n");
  const result = await comparison();
  const res = await request("/diff", { path: "bom.txt", preview: result.preview });
  const diff = await res.json();
  expect(diff.additions).toBe(1); expect(diff.deletions).toBe(1); expect(diff.patch).toContain("+\ufeffsame");
});
test("explicit deletion review produces a deletion patch; unsafe selections are rejected", async () => {
  const result = await comparison({ deletions: JSON.stringify(["docs/README.md"]) });
  expect(result.counts.deleted).toBe(1);
  const diff = await (await request("/diff", { path: "docs/README.md", preview: result.preview })).json();
  expect(diff.patch).toContain("+++ /dev/null"); expect(diff.deletions).toBe(1);
  for (const path of [".env", "../secret", "src/App.tsx", "missing"]) {
    expect((await request("/changes", { deletions: JSON.stringify([path]) })).status).toBe(400);
  }
  expect((await request("/changes", { deletions: "not-json" })).status).toBe(400);
  expect((await request("/changes", { deletions: JSON.stringify(Array(101).fill("docs/README.md")) })).status).toBe(400);
});
test("large/binary changes have summaries without fetching their remote blobs", async () => {
  local("large.txt", "x".repeat(200_001)); remote("large.txt", "old");
  local("image.png", new Uint8Array([1, 2, 3])); remote("image.png", new Uint8Array([4, 5]));
  const result = await comparison();
  for (const [path, kind] of [["large.txt", "large"], ["image.png", "binary"]]) {
    const diff = await (await request("/diff", { path: path!, preview: result.preview })).json();
    expect(diff.kind).toBe(kind); expect(diff.patch).toBeNull(); expect(diff.additions).toBeNull();
  }
  expect(requests.some((r) => r.path.includes("/git/blobs/"))).toBe(false);
});
test("both routes require authentication and ownership before accessing GitHub", async () => {
  expect((await request("/changes", {}, "")).status).toBe(401);
  expect((await request("/changes", {}, "other")).status).toBe(403);
  expect((await request("/diff", { path: "src/App.tsx", preview: "anything" }, "other")).status).toBe(403);
  expect((await request("/changes", {}, "owner", "00000000-0000-4000-8000-000000000099")).status).toBe(404);
  expect((await request("/changes", {}, "owner", "invalid-id")).status).toBe(400);
  expect(requests).toEqual([]);
});
test("previews are bound to owner/project, expire, and do not authorize excluded paths", async () => {
  const result = await comparison();
  expect((await request("/diff", { path: ".env", preview: result.preview })).status).toBe(404);
  expect((await request("/diff", { path: "dist/build.js", preview: result.preview })).status).toBe(404);
  expect((await request("/diff", { path: "unchanged.ts", preview: result.preview })).status).toBe(404);
  expect((await request("/diff", { path: "src/App.tsx", preview: result.preview }, "owner", OTHER)).status).toBe(409);
  expect((await request("/diff", { path: "src/App.tsx", preview: `${result.preview}tampered` })).status).toBe(409);
  const payload = jwt.decode(result.preview) as Record<string, unknown>;
  delete payload.exp; delete payload.iat;
  const expired = jwt.sign(payload, env.ACCESS_TOKEN_SECRET, { expiresIn: -1 });
  expect((await request("/diff", { path: "src/App.tsx", preview: expired })).status).toBe(409);
});
test("a binary summary also refuses a project edited while its blob loads", async () => {
  local("image.png", new Uint8Array([1, 2, 3]));
  const result = await comparison();
  duringRead = () => { project.headSequence++; };
  expect((await request("/diff", { path: "image.png", preview: result.preview })).status).toBe(409);
});
test("invalid paths and over-limit manifests/trees never produce partial counts", async () => {
  local("../invalid.ts", "x");
  expect((await request("/changes")).status).toBe(400);
  localFiles = Array.from({ length: 5_001 }, (_, index) => ({ path: `file-${index}`, contentHash: "hash", sizeBytes: 1 }));
  expect((await request("/changes")).status).toBe(400);
  localFiles = [];
  remoteFiles = Array.from({ length: 5_001 }, (_, index) => ({ path: `file-${index}`, sha: "sha", type: "blob", mode: "100644", size: 1 }));
  expect((await request("/changes")).status).toBe(400);
});
test("local version, manifest, repo and remote head changes reject stale previews", async () => {
  for (const change of [() => { project.headSequence++; }, () => local("new.ts", "different"), () => { project.githubRepo = "acme/other"; }, () => { head = "c".repeat(40); }]) {
    const result = await comparison(); change();
    const res = await request("/diff", { path: "src/App.tsx", preview: result.preview });
    expect(res.status).toBe(409);
    project.githubRepo = "acme/atlas";
  }
});
test("a project edited during comparison is rejected instead of returning mixed versions", async () => {
  duringRead = () => { project.headSequence++; };
  expect((await request("/changes")).status).toBe(409);
});
test("missing or corrupted local blobs produce a project-file error, not a misleading GitHub failure", async () => {
  localBlobs.delete(localFiles.find((f) => f.path === "new.ts")!.contentHash);
  const res = await request("/changes");
  expect(res.status).toBe(503); expect((await res.json()).error).toContain("Project file content is unavailable");
});
test("new/direct modes compare main; updating uses only a valid open same-repo Tau PR", async () => {
  expect((await comparison()).branch).toBe("main");
  expect((await comparison({ mode: "direct" })).branch).toBe("main");
  expect((await comparison({ mode: "update_pr" })).branch).toBe("tau/update");
  expect(requests.some((r) => r.path.endsWith("/heads/tau%2Fupdate"))).toBe(true);
  prState = "closed"; expect((await request("/changes", { mode: "update_pr" })).status).toBe(409);
  prState = "open"; prRepo = "fork/atlas"; expect((await request("/changes", { mode: "update_pr" })).status).toBe(409);
  prRepo = null; expect((await request("/changes", { mode: "update_pr" })).status).toBe(409);
  expect((await request("/changes", { mode: "invalid" })).status).toBe(400);
});
test("incomplete trees and symlink/submodule/directory path conflicts fail clearly", async () => {
  truncated = true; expect((await request("/changes")).status).toBe(400); truncated = false;
  for (const mode of ["120000", "160000", "040000"]) {
    remoteFiles.find((f) => f.path === "src/App.tsx")!.mode = mode;
    expect((await request("/changes")).status).toBe(409);
  }
  remoteFiles.find((f) => f.path === "src/App.tsx")!.mode = "100644";
  remote("src", "blocking file"); expect((await request("/changes")).status).toBe(409);
});
test("missing connection, permissions, rate limits and temporary failures remain distinct", async () => {
  connected = false; expect((await request("/changes")).status).toBe(409); connected = true;
  for (const [status, expected] of [[403, 403], [404, 404], [429, 429], [500, 503], [401, 409]] as const) {
    connected = true; upstreamStatus = status!;
    expect((await request("/changes")).status).toBe(expected);
  }
  expect(revoked).toBe(1);
});
test("metadata includes PR description and branches and never collapses upstream errors to unlinked", async () => {
  const info = await (await request("")).json();
  expect(info.lastPr).toMatchObject({ author: "alex", body: "Details", draft: true, headBranch: "tau/update", baseBranch: "main" });
  upstreamStatus = 500; failurePath = "/pulls?";
  const res = await request(""); expect(res.status).toBe(503);
  upstreamStatus = 500; failurePath = "/user";
  expect((await request("")).status).toBe(503); expect(revoked).toBe(0);
});
