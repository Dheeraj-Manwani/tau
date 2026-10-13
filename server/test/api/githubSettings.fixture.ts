import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import express from "express";

const PID = "00000000-0000-4000-8000-000000000001";
const initial = () => ({ id: PID, userId: "owner", githubRepo: "acme/atlas" as string | null, githubDefaultBranch: "main", githubVisibility: "private", githubPushMode: "new_pr", headSequence: 10, lastPrNumber: 42, lastPrUrl: "https://github.com/acme/atlas/pull/42", lastPushedSequence: 10, lastPushedBranch: "tau/update", lastPushedAt: new Date("2026-10-12T12:00:00Z") as Date | null, lastPushedCommitSha: "a".repeat(40) as string | null });
let project = initial();
let connected = true;
let admin = true;
let archived = false;
let fork = false;
let visibility = "private";
let failSave = false;
let transactionTail: Promise<unknown> = Promise.resolve();
let failure = 0;
let failureMethod: "all" | "PATCH" = "all";
let duringRead: (() => void) | null = null;
let requests: { path: string; method: string; body: any }[] = [];
const repo = (name = "acme/atlas") => ({ full_name: name, name: name.split("/")[1], owner: { login: name.split("/")[0] }, html_url: `https://github.com/${name}`, default_branch: "main", private: visibility === "private", visibility, permissions: { push: true, admin }, archived, fork });
const projectDb = {
  findUnique: async ({ where }: any) => where.id === PID ? { ...project } : null,
  update: async ({ data }: any) => { if (failSave) throw new Error("Fixture save failure"); project = { ...project, ...data }; return project; },
  updateMany: async ({ where, data }: any) => {
    if (where.id !== PID || (where.userId && where.userId !== project.userId) || ("githubRepo" in where && where.githubRepo !== project.githubRepo)) return { count: 0 };
    project = { ...project, ...data }; return { count: 1 };
  },
};
mock.module("@/lib/prisma", () => ({ prisma: {
  project: projectDb,
  $transaction: (run: (tx: any) => Promise<unknown>) => {
    const pending = transactionTail.then(() => run({ project: projectDb, $queryRaw: async () => [] }));
    transactionTail = pending.catch(() => {});
    return pending;
  },
  oAuthAccount: { findFirst: async () => connected ? { accessToken: "fixture-token" } : null, deleteMany: async () => { connected = false; return { count: 1 }; } },
} }));
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.startsWith("https://api.github.com")) return realFetch(input, init);
  const path = url.slice("https://api.github.com".length);
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  requests.push({ path, method, body });
  if (failure && (failureMethod === "all" || failureMethod === method)) return Response.json({ message: "Fixture failure" }, { status: failure, headers: failure === 429 ? { "retry-after": "30" } : {} });
  if (path === "/user") return Response.json({ id: 1, login: "alex" });
  if (path === "/user/repos" && method === "POST") return Response.json(repo(`alex/${body.name}`), { status: 201 });
  if (path.includes("/pulls?")) return Response.json([]);
  if (path.includes("/pulls/")) return Response.json({ number: 42, state: "open", title: "Update", html_url: "https://github.com/acme/atlas/pull/42", head: { ref: "tau/update", repo: { full_name: "acme/atlas" } }, base: { ref: "main", repo: { full_name: "acme/atlas" } } });
  if (method === "PATCH") { visibility = body.private ? "private" : "public"; return Response.json(repo()); }
  const result = repo(path.slice("/repos/".length));
  if (duringRead) { const run = duringRead; duringRead = null; run(); }
  return Response.json(result);
}) as typeof fetch;
const controller = await import("@/api/controllers/githubProject.controller");
const { requireAuth } = await import("@/api/middleware/auth.middleware");
const { issueAccessToken } = await import("@/api/lib/tokens");
const { AppError } = await import("@/api/lib/errors");
const app = express();
app.use(express.json()); app.use(requireAuth);
app.get("/project/:projectId/github", controller.getInfo);
app.patch("/project/:projectId/github", controller.patch);
app.post("/project/:projectId/github/repository", controller.createRepository);
app.delete("/project/:projectId/github/link", controller.unlink);
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(err instanceof AppError ? err.statusCode : 500).json({ error: err instanceof Error ? err.message : String(err) }));
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address() as { port: number };
async function request(endpoint = "", method = "GET", body?: unknown, user = "owner") {
  const token = user ? issueAccessToken({ id: user, email: "test@example.test" }) : null;
  return fetch(`http://127.0.0.1:${address.port}/project/${PID}/github${endpoint}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
beforeEach(() => { project = initial(); connected = true; admin = true; archived = false; fork = false; visibility = "private"; failSave = false; transactionTail = Promise.resolve(); failure = 0; failureMethod = "all"; requests = []; duringRead = null; });
afterAll(() => { server.close(); globalThis.fetch = realFetch; });

test("creates and binds a new private initialized repository before any push", async () => {
  project.githubRepo = null;
  const response = await request("/repository", "POST", { name: "my-project", description: " Project description " });
  expect(response.status).toBe(201); expect((await response.json()).fullName).toBe("alex/my-project");
  expect(project.githubRepo as string | null).toBe("alex/my-project"); expect(project.lastPrNumber).toBeNull(); expect(project.lastPushedAt).toBeNull();
  expect(requests).toEqual([{ path: "/user/repos", method: "POST", body: { name: "my-project", description: "Project description", private: true, auto_init: true } }]);
});

test("invalid names and attempts to specify an existing repo or visibility are rejected", async () => {
  for (const name of ["", ".", "..", ".git", "owner/repo", "bad?name", "a".repeat(101)]) expect((await request("/repository", "POST", { name })).status).toBe(400);
  for (const body of [{ name: "valid", repo: "acme/existing" }, { name: "valid", private: false }, { name: "valid", description: "x".repeat(351) }]) expect((await request("/repository", "POST", body)).status).toBe(400);
  expect((await request("", "PATCH", { private: false, pushMode: "direct" })).status).toBe(400); expect(requests).toEqual([]);
});

test("the repository discovery and existing-link endpoints are unavailable", async () => {
  expect((await request("/repos")).status).toBe(404);
  expect((await request("/link", "POST", { repo: "acme/existing" })).status).toBe(404);
  expect(requests).toEqual([]); expect(project.githubRepo).toBe("acme/atlas");
});

test("session and project ownership are checked before creation or settings", async () => {
  project.githubRepo = null;
  for (const [user, status] of [["", 401], ["intruder", 403]] as const) {
    expect((await request("/repository", "POST", { name: "new-repo" }, user)).status).toBe(status);
    expect((await request("", "PATCH", { private: false }, user)).status).toBe(status);
  }
  expect(requests).toEqual([]);
});

test("collisions, denied creation, expired credentials, limits and outages never adopt a repository", async () => {
  project.githubRepo = null;
  for (const [status, expected] of [[422,409], [403,403], [401,409], [429,429], [500,503]] as const) {
    connected = true; failure = status;
    expect((await request("/repository", "POST", { name: "existing" })).status).toBe(expected); expect(project.githubRepo).toBeNull();
  }
  expect(requests.every((r) => r.method === "POST" && r.path === "/user/repos")).toBe(true);
});

test("simultaneous creation requests bind exactly one newly created repository", async () => {
  project.githubRepo = null;
  const results = await Promise.all([request("/repository", "POST", { name: "first" }), request("/repository", "POST", { name: "second" })]);
  expect(results.map((r) => r.status).sort()).toEqual([201,409]);
  expect(requests).toHaveLength(1); expect(project.githubRepo).toMatch(/^alex\/(first|second)$/);
});

test("a save failure reports the created repository without pretending it is bound", async () => {
  project.githubRepo = null; failSave = true;
  const response = await request("/repository", "POST", { name: "save-failed" });
  expect(response.status).toBe(503); expect((await response.json()).error).toContain("Created alex/save-failed on GitHub");
  expect(project.githubRepo).toBeNull(); expect(requests).toHaveLength(1);
});

test("visibility requires fresh admin access and disallows archive, forks and internal repos", async () => {
  for (const configure of [() => admin = false, () => archived = true, () => fork = true, () => visibility = "internal"]) {
    admin = true; archived = false; fork = false; visibility = "private"; configure();
    const data = await (await request()).json(); expect(data.repo.canChangeVisibility).toBe(false);
    expect((await request("", "PATCH", { private: false, repo: "acme/atlas" })).status).toBe(403);
  }
  expect(requests.some((r) => r.method === "PATCH")).toBe(false);
});

test("visibility saves only after GitHub succeeds and rejects a different linked repository", async () => {
  expect((await request("", "PATCH", { private: false, repo: "acme/old" })).status).toBe(409); expect(requests).toEqual([]);
  const response = await request("", "PATCH", { private: false, repo: "acme/atlas" });
  expect(response.status).toBe(200); expect((await response.json()).visibility).toBe("public"); expect(project.githubVisibility).toBe("public");
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({ private: false });
});

test("repository relink during a permission read prevents visibility writes", async () => {
  duringRead = () => project.githubRepo = "acme/other";
  expect((await request("", "PATCH", { private: false })).status).toBe(409);
  expect(requests.some((r) => r.method === "PATCH")).toBe(false);
});

test("denied policy, expired token, rate limits and outages do not alter saved visibility", async () => {
  for (const [status, expected] of [[403,403], [422,409], [401,409], [429,429], [500,503]] as const) {
    connected = true; failure = status; failureMethod = "PATCH";
    expect((await request("", "PATCH", { private: false })).status).toBe(expected); expect(project.githubVisibility).toBe("private");
  }
  failure = 0; connected = false; project.githubRepo = null; expect((await request("/repository", "POST", { name: "new-repo" })).status).toBe(409);
});

test("metadata returns a real saved time, commit and branch and never invents earlier pushes", async () => {
  const data = await (await request()).json(); expect(data.lastPush.at).toBe("2026-10-12T12:00:00.000Z"); expect(data.lastPush.commitSha).toBe("a".repeat(40)); expect(data.lastPush.commitUrl).toBe(`https://github.com/acme/atlas/commit/${"a".repeat(40)}`);
  project.lastPushedAt = null; expect((await (await request()).json()).lastPush).toBeNull();
});

test("creation cannot replace an associated repository; unlink clears its tracking", async () => {
  expect((await request("/repository", "POST", { name: "replacement" })).status).toBe(409);
  expect(project.githubRepo).toBe("acme/atlas"); expect(project.lastPushedAt).not.toBeNull(); expect(requests).toEqual([]);
  expect((await request("/link", "DELETE")).status).toBe(204); expect(project.githubRepo).toBeNull(); expect(project.lastPushedAt).toBeNull();
  expect((await request("/repository", "POST", { name: "fresh" })).status).toBe(201); expect(project.githubRepo).toBe("alex/fresh");
});

test("metadata cache refresh cannot restore an old repository association", async () => {
  project.githubDefaultBranch = "old"; duringRead = () => project.githubRepo = "acme/newer";
  expect((await request()).status).toBe(409); expect(project.githubRepo).toBe("acme/newer");
});

test("push preference is independent of GitHub admin access and preserves metadata", async () => {
  admin = false; expect((await request("", "PATCH", { pushMode: "direct" })).status).toBe(200); expect(project.githubPushMode).toBe("direct"); expect(project.lastPushedAt).not.toBeNull(); expect(requests).toEqual([]);
});
