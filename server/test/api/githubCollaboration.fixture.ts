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
let archived = false;
let hasIssues = true;
let canPush = true;
let issueIsPr = false;
let hasNext = false;
let changeHeadDuringDetails = false;
let duringFetch: ((path: string) => void) | null = null;
let writes: { path: string; body: any }[] = [];
let detailReads = 0;
let issueList: any[] = [];
let pullList: any[] = [];
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
function pr(number = 42) {
  return { number, title: `PR ${number}`, state: prState, merged_at: null, html_url: `https://github.com/acme/atlas/pull/${number}`, head: { ref: "tau/update", sha: head, repo: prRepo ? { full_name: prRepo } : null }, base: { ref: "main", repo: { full_name: "acme/atlas" } }, draft: true, user: { login: "alex" }, body: "PR description", updated_at: "2026-10-13T12:00:00Z", additions: 8, deletions: 2, changed_files: 3, commits: 2, mergeable: null };
}
function issue(number = 12, asPr = false) {
  return { number, title: `Issue ${number}`, state: "open", html_url: `https://github.com/acme/atlas/issues/${number}`, body: "Steps to reproduce the problem", user: { login: "alex" }, updated_at: "2026-10-13T12:00:00Z", created_at: "2026-10-12T12:00:00Z", comments: 2, labels: [{ name: "bug", color: "ff0000" }], assignees: [{ login: "dheer" }], ...(asPr ? { pull_request: {} } : {}) };
}
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.startsWith("https://api.github.com")) return realFetch(input, init);
  const path = url.slice("https://api.github.com".length);
  requests.push({ path, method: init?.method ?? "GET" });
  duringFetch?.(path);
  if (upstreamStatus && (!failurePath || path.includes(failurePath))) return Response.json({ message: upstreamStatus === 429 ? "rate limit exceeded" : "Unavailable" }, { status: upstreamStatus });
  if (init?.method === "POST") {
    const body = JSON.parse(String(init.body)); writes.push({ path, body });
    if (!path.endsWith("/issues")) throw new Error("Unexpected write");
    return Response.json({ ...issue(25), title: body.title, body: body.body });
  }
  if (path.includes("/reviews?")) {
    detailReads++;
    return Response.json([{ id: 1, user: { login: "reviewer" }, state: "APPROVED", body: "Looks good", html_url: "https://github.com/acme/atlas/pull/42#review1", submitted_at: "2026-10-12T12:00:00Z", commit_id: "c".repeat(40) }], { headers: hasNext ? { Link: '<https://api.github.com/next>; rel="next"' } : {} });
  }
  if (path.includes("/check-runs?")) {
    detailReads++;
    return Response.json({ total_count: 3, check_runs: [{ id: 1, name: "Build", status: "completed", conclusion: "success", html_url: "https://github.com/acme/atlas/actions/runs/1", head_sha: head }, { id: 2, name: "Tests", status: "in_progress", conclusion: null, html_url: null, head_sha: head }, { id: 3, name: "Old build", status: "completed", conclusion: "failure", html_url: null, head_sha: "d".repeat(40) }] });
  }
  if (path.includes("/status?")) {
    detailReads++;
    if (changeHeadDuringDetails) head = "e".repeat(40);
    return Response.json({ total_count: 1, statuses: [{ id: 5, context: "Deploy preview", state: "failure", target_url: "https://example.test/deploy" }] });
  }
  if (/\/pulls\/\d+$/.test(path)) return Response.json(pr(Number(path.split("/").at(-1))));
  if (path.includes("/pulls?")) return Response.json(pullList, { headers: hasNext ? { Link: '<https://api.github.com/next>; rel="next"' } : {} });
  if (/\/issues\/\d+$/.test(path)) return Response.json(issue(Number(path.split("/").at(-1)), issueIsPr));
  if (path.includes("/issues?")) return Response.json(issueList, { headers: hasNext ? { Link: '<https://api.github.com/next>; rel="next"' } : {} });
  if (path === "/user") return Response.json({ id: 1, login: "alex" });
  return Response.json({ permissions: { push: canPush, pull: true }, archived, has_issues: hasIssues, node_id: "R_fixture", default_branch: "main", full_name: "acme/atlas", name: "atlas", owner: { login: "acme" }, html_url: "https://github.com/acme/atlas", private: true });
}) as typeof fetch;

const controller = await import("@/api/controllers/githubProject.controller");
const { requireAuth } = await import("@/api/middleware/auth.middleware");
const { issueAccessToken } = await import("@/api/lib/tokens");
const { AppError } = await import("@/api/lib/errors");
const { env } = await import("@/lib/env");
const app = express();
app.use(express.json());
app.use(requireAuth);
app.get("/project/:projectId/github/pulls", controller.pulls);
app.get("/project/:projectId/github/pulls/:number", controller.pull);
app.get("/project/:projectId/github/issues", controller.issues);
app.get("/project/:projectId/github/issues/:number", controller.issue);
app.post("/project/:projectId/github/issues", controller.createIssue);
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
  connected = true; revoked = 0; requests = []; writes = []; head = "a".repeat(40); upstreamStatus = 0; failurePath = "";
  archived = false; hasIssues = true; canPush = true; issueIsPr = false; hasNext = false; changeHeadDuringDetails = false; duringFetch = null; detailReads = 0;
  prState = "open"; prRepo = "acme/atlas";
  project = { ...project, userId: "owner", githubRepo: "acme/atlas" };
  issueList = [issue(12), issue(13, true), issue(14)]; pullList = [pr(42), pr(39)];
});
afterAll(() => { server.close(); globalThis.fetch = realFetch; });
async function get(endpoint: string, params: Record<string, string> = {}, user = "owner") { return request(endpoint, { repo: "acme/atlas", ...params }, user); }
async function create(body: Record<string, unknown> = {}, user = "owner") {
  const token = user === "owner" ? apiToken : user ? issueAccessToken({ id: user, email: "test@example.test" }) : null;
  return fetch(`http://127.0.0.1:${address.port}/project/${PID}/github/issues`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ repo: "acme/atlas", title: "New bug", description: "How to reproduce it", ...body }) });
}

test("PR list pagination follows Link headers, forwards filters and uses updated order", async () => {
  hasNext = true; const res = await get("/pulls", { state: "closed", page: "2" }); const body = await res.json();
  expect(res.status).toBe(200); expect(body.page).toBe(2); expect(body.hasNext).toBe(true); expect(body.items.map((p: any) => p.number)).toEqual([42,39]);
  expect(requests.some((r) => r.path.includes("state=closed&sort=updated&direction=desc&per_page=20&page=2"))).toBe(true);
  expect(detailReads).toBe(0); expect(writes).toEqual([]);
  hasNext = false; expect((await (await get("/pulls", { page: "3" })).json()).hasNext).toBe(false);
});

test("issues omit PRs without dropping the next page, including a PR-only page", async () => {
  hasNext = true;
  let res = await get("/issues"); let body = await res.json(); expect(res.status).toBe(200); expect(body.items.map((i: any) => i.number)).toEqual([12,14]); expect(body.hasNext).toBe(true);
  issueList = Array.from({ length: 20 }, (_, index) => issue(index + 1, true));
  body = await (await get("/issues")).json(); expect(body.items).toEqual([]); expect(body.hasNext).toBe(true);
  issueList = [issue(25)]; hasNext = false;
  body = await (await get("/issues", { page: "2" })).json(); expect(body.items[0].number).toBe(25); expect(body.hasNext).toBe(false);
});

test("PR detail includes SHA-bound checks, old review history, statuses and statistics", async () => {
  const res = await get("/pulls/42"); const body = await res.json(); expect(res.status).toBe(200);
  expect(body.headSha).toBe("a".repeat(40)); expect(body.files).toBe(3); expect(body.additions).toBe(8); expect(body.mergeable).toBeNull();
  expect(body.pr.canUpdate).toBe(true); expect(body.reviews.available).toBe(true); expect(body.reviews.items[0]).toMatchObject({ author: "reviewer", state: "APPROVED", commitSha: "c".repeat(40) });
  expect(body.checks.items.map((c: any) => c.state)).toEqual(["success","in_progress"]); expect(body.statuses.items[0].state).toBe("failure");
  expect(requests.filter((r) => /\/pulls\/42$/.test(r.path))).toHaveLength(2);
});

test("unavailable checks/reviews are distinct from pending and do not hide other results", async () => {
  upstreamStatus = 403; failurePath = "/check-runs";
  let body = await (await get("/pulls/42")).json(); expect(body.checks.available).toBe(false); expect(body.checks.items).toEqual([]); expect(body.checks.reason).toContain("access"); expect(body.reviews.available).toBe(true); expect(body.statuses.available).toBe(true);
  upstreamStatus = 429; failurePath = "/reviews?";
  body = await (await get("/pulls/42")).json(); expect(body.reviews.reason).toContain("rate limit"); expect(body.checks.available).toBe(true);
});

test("revoked credentials during lazy details disconnect instead of masquerading as pending", async () => {
  upstreamStatus = 401; failurePath = "/check-runs"; const res = await get("/pulls/42");
  expect(res.status).toBe(409); expect(revoked).toBe(1); expect(connected).toBe(false);
});

test("PR head changing while details load returns a refresh error", async () => {
  changeHeadDuringDetails = true; const res = await get("/pulls/42"); expect(res.status).toBe(409); expect((await res.json()).error).toContain("changed");
});

test("permissions, merged/closed state, fork and archived metadata control PR update availability", async () => {
  for (const change of [() => canPush = false, () => prState = "closed", () => prRepo = "someone/fork", () => archived = true]) {
    change(); const body = await (await get("/pulls/42")).json(); expect(body.pr.canUpdate).toBe(false);
    canPush = true; prState = "open"; prRepo = "acme/atlas"; archived = false;
  }
});

test("issue detail carries real body/labels/assignees and refuses PR numbers", async () => {
  const res = await get("/issues/12"); const body = await res.json(); expect(res.status).toBe(200);
  expect(body.issue).toMatchObject({ body: "Steps to reproduce the problem", labels: ["bug"], assignees: ["dheer"], comments: 2 });
  issueIsPr = true; expect((await get("/issues/13")).status).toBe(400);
});

test("read-access collaborators can create issues, with title and description forwarded", async () => {
  canPush = false; const page = await (await get("/issues")).json(); expect(page.canCreate).toBe(true);
  const res = await create(); const body = await res.json(); expect(res.status).toBe(201); expect(body.number).toBe(25); expect(body.issueUrl).toContain("/issues/25");
  expect(writes).toEqual([{ path: "/repos/acme/atlas/issues", body: { title: "New bug", body: "How to reproduce it" } }]);
});

test("disabled issues and archived repos prevent creation while exposing the reason", async () => {
  hasIssues = false; const body = await (await get("/issues")).json(); expect(body.canCreate).toBe(false); expect(body.disabledReason).toContain("disabled"); expect(body.items).toEqual([]); expect((await create()).status).toBe(403);
  hasIssues = true; archived = true; expect((await create()).status).toBe(403); expect((await (await get("/issues")).json()).canCreate).toBe(false); expect(writes).toEqual([]);
});

test("owner/session checks protect every new route before contacting GitHub", async () => {
  for (const endpoint of ["/pulls", "/pulls/42", "/issues", "/issues/12"]) { expect((await get(endpoint, {}, "intruder")).status).toBe(403); expect((await get(endpoint, {}, "")).status).toBe(401); }
  expect((await create({}, "intruder")).status).toBe(403); expect((await create({}, "")).status).toBe(401); expect(requests).toEqual([]);
});

test("repository binding rejects stale read/create actions before requests and after in-flight reads", async () => {
  project.githubRepo = "acme/other"; expect((await get("/issues")).status).toBe(409); expect((await create()).status).toBe(409); expect(requests).toEqual([]);
  project.githubRepo = "acme/atlas"; duringFetch = (path) => { if (path.includes("/issues?")) project.githubRepo = "acme/other"; };
  expect((await get("/issues")).status).toBe(409);
  project.githubRepo = "acme/atlas"; duringFetch = () => project.githubRepo = "acme/other";
  expect((await create()).status).toBe(409); expect(writes).toEqual([]);
});

test("list/detail query and issue compose validation reject unsafe or oversized requests", async () => {
  for (const params of ([{ page: "0" }, { page: "1.5" }, { page: "1001" }, { state: "bad" }, { repo: "../../elsewhere" }] as Record<string, string>[])) expect((await get("/issues", params)).status).toBe(400);
  expect((await get("/issues/0")).status).toBe(400); expect((await get("/pulls/not-a-number")).status).toBe(400);
  for (const body of [{ title: "" }, { title: "x".repeat(201) }, { description: "x".repeat(5001) }]) expect((await create(body)).status).toBe(400);
  expect(requests).toEqual([]);
});

test("upstream list errors retain meaningful permission, rate-limit and outage status", async () => {
  for (const [status, expected] of [[403,403],[429,429],[404,404],[503,503]]) { upstreamStatus = status!; expect((await get("/issues")).status).toBe(expected!); }
  upstreamStatus = 401; expect((await get("/issues")).status).toBe(409); expect(revoked).toBe(1);
});

test("issue write failures are actionable and uncertain outcomes discourage duplicate creation", async () => {
  failurePath = "/issues"; upstreamStatus = 403; const denied = await create(); expect(denied.status).toBe(403); expect((await denied.json()).error).toContain("interaction limits");
  upstreamStatus = 503; const uncertain = await create(); expect(uncertain.status).toBe(503); expect((await uncertain.json()).error).toContain("before creating another");
});

test("worker issue creation reuses validated repository and permissions behavior", async () => {
  const { createGithubIssue } = await import("@/api/lib/github"); canPush = false;
  expect(await createGithubIssue(PID, "owner", { title: "Worker bug", body: "Worker context" })).toMatchObject({ number: 25 });
  expect(writes[0]!.body).toEqual({ title: "Worker bug", body: "Worker context" });
});
