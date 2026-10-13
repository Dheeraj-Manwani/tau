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
let hasNext = true;
let failure = 0;
let failureMethod: "all" | "PATCH" = "all";
let duringRead: (() => void) | null = null;
let requests: { path: string; method: string; body: any }[] = [];
const repo = (name = "acme/atlas") => ({ full_name: name, name: name.split("/")[1], owner: { login: name.split("/")[0] }, html_url: `https://github.com/${name}`, default_branch: "main", private: visibility === "private", visibility, permissions: { push: true, admin }, archived, fork });
mock.module("@/lib/prisma", () => ({ prisma: {
  project: {
    findUnique: async ({ where }: any) => where.id === PID ? { ...project } : null,
    update: async ({ data }: any) => { project = { ...project, ...data }; return project; },
    updateMany: async ({ where, data }: any) => {
      if (where.id !== PID || (where.userId && where.userId !== project.userId) || ("githubRepo" in where && where.githubRepo !== project.githubRepo)) return { count: 0 };
      project = { ...project, ...data }; return { count: 1 };
    },
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
  if (path.startsWith("/user/repos?")) return Response.json([repo("acme/shared"), { ...repo("alex/owned"), archived: true }], { headers: hasNext ? { Link: '<https://api.github.com/next>; rel="next"' } : {} });
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
app.get("/project/:projectId/github/repos", controller.repos);
app.get("/project/:projectId/github", controller.getInfo);
app.patch("/project/:projectId/github", controller.patch);
app.post("/project/:projectId/github/link", controller.link);
app.delete("/project/:projectId/github/link", controller.unlink);
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(err instanceof AppError ? err.statusCode : 500).json({ error: err instanceof Error ? err.message : String(err) }));
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address() as { port: number };
async function request(endpoint = "", method = "GET", body?: unknown, user = "owner") {
  const token = user ? issueAccessToken({ id: user, email: "test@example.test" }) : null;
  return fetch(`http://127.0.0.1:${address.port}/project/${PID}/github${endpoint}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
beforeEach(() => { project = initial(); connected = true; admin = true; archived = false; fork = false; visibility = "private"; hasNext = true; failure = 0; failureMethod = "all"; requests = []; duringRead = null; });
afterAll(() => { server.close(); globalThis.fetch = realFetch; });

test("discovery includes collaborator/organization affiliation and Link pagination", async () => {
  const response = await request("/repos?page=2"); const data = await response.json();
  expect(response.status).toBe(200); expect(data.page).toBe(2); expect(data.hasNext).toBe(true);
  expect(data.repos[0].canAdmin).toBe(true); expect(data.repos[1].canPush).toBe(false);
  expect(requests[0]!.path).toContain("affiliation=owner,collaborator,organization_member&page=2");
  hasNext = false; expect((await (await request("/repos?affiliation=organization_member&page=3")).json()).hasNext).toBe(false);
  expect(requests.at(-1)?.path).toContain("affiliation=organization_member&page=3");
});
test("invalid pagination, affiliation, repository paths and mixed settings are rejected", async () => {
  for (const query of ["page=0", "page=1001", "page=x", "affiliation=other"]) expect((await request(`/repos?${query}`)).status).toBe(400);
  for (const name of ["../..", "acme/.", "acme/repo?x=1", "acme/repo/extra"]) expect((await request("/link", "POST", { repo: name })).status).toBe(400);
  expect((await request("", "PATCH", { private: false, pushMode: "direct" })).status).toBe(400); expect(requests).toEqual([]);
});
test("session and project ownership are checked before GitHub discovery or settings", async () => {
  for (const [user, status] of [["", 401], ["intruder", 403]] as const) {
    expect((await request("/repos", "GET", undefined, user)).status).toBe(status);
    expect((await request("", "PATCH", { private: false }, user)).status).toBe(status);
    expect((await request("/link", "POST", { repo: "acme/other" }, user)).status).toBe(status);
  }
  expect(requests).toEqual([]);
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
  failure = 0; connected = false; expect((await request("/repos")).status).toBe(409);
});
test("metadata returns a real saved time, commit and branch and never invents earlier pushes", async () => {
  const data = await (await request()).json(); expect(data.lastPush.at).toBe("2026-10-12T12:00:00.000Z"); expect(data.lastPush.commitSha).toBe("a".repeat(40)); expect(data.lastPush.commitUrl).toBe(`https://github.com/acme/atlas/commit/${"a".repeat(40)}`);
  project.lastPushedAt = null; expect((await (await request()).json()).lastPush).toBeNull();
});
test("same-repository links preserve metadata; replacements and unlink clear it", async () => {
  expect((await request("/link", "POST", { repo: "acme/atlas" })).status).toBe(200); expect(project.lastPushedAt).not.toBeNull();
  expect((await request("/link", "POST", { repo: "acme/other" })).status).toBe(200); expect(project.lastPushedAt).toBeNull(); expect(project.lastPushedCommitSha).toBeNull(); expect(project.lastPrNumber).toBeNull();
  project = initial(); expect((await request("/link", "DELETE")).status).toBe(204); expect(project.githubRepo).toBeNull(); expect(project.lastPushedAt).toBeNull();
});
test("relink while loading a replacement prevents overwriting the newer association", async () => {
  duringRead = () => project.githubRepo = "acme/newer";
  expect((await request("/link", "POST", { repo: "acme/other" })).status).toBe(409); expect(project.githubRepo).toBe("acme/newer");
});
test("metadata cache refresh cannot restore an old repository association", async () => {
  project.githubDefaultBranch = "old"; duringRead = () => project.githubRepo = "acme/newer";
  expect((await request()).status).toBe(409); expect(project.githubRepo).toBe("acme/newer");
});
test("push preference is independent of GitHub admin access and preserves metadata", async () => {
  admin = false; expect((await request("", "PATCH", { pushMode: "direct" })).status).toBe(200); expect(project.githubPushMode).toBe("direct"); expect(project.lastPushedAt).not.toBeNull(); expect(requests).toEqual([]);
});
