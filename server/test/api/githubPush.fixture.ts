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
let permissions = true;
let refs = new Map<string, string>();
let trees = new Map<string, typeof remoteFiles>();
let commits = new Map<string, { message: string; parents: { sha: string }[]; tree: { sha: string } }>();
let writes: { path: string; body: any }[] = [];
let duringWrite: ((path: string) => void) | null = null;
let rejectRef = false;
let transportAfterRef = false;
let prFailure = false;
let createdPr: any = null;
let savedSequence = -1;
let duringRead: (() => void) | null = null;

mock.module("@/lib/prisma", () => ({ prisma: {
  project: {
    findUnique: async ({ where }: { where: { id: string } }) => where.id === PID || where.id === OTHER ? { ...project, id: where.id } : null,
    update: async () => ({ ...project }),
    updateMany: async ({ where, data }: any) => {
      if (where.githubRepo !== project.githubRepo || project.lastPushedSequence > data.lastPushedSequence) return { count: 0 };
      savedSequence = data.lastPushedSequence;
      project = { ...project, ...data };
      return { count: 1 };
    },
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
  const method = init?.method ?? "GET";
  requests.push({ path, method });
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  if (upstreamStatus && (!failurePath || path.includes(failurePath))) return Response.json({ message: "Unavailable" }, { status: upstreamStatus });
  if (method !== "GET") {
    writes.push({ path, body });
    duringWrite?.(path);
    if (path.endsWith("/git/blobs")) {
      const bytes = Buffer.from(body.content, "base64");
      const sha = gitSha(bytes); remoteBlobs.set(sha, bytes); return Response.json({ sha });
    }
    if (path.endsWith("/git/trees")) {
      const base = new Map((trees.get(body.base_tree) ?? []).map((entry) => [entry.path, { ...entry }]));
      for (const entry of body.tree) {
        if (entry.sha === null) base.delete(entry.path);
        else base.set(entry.path, { ...entry, size: remoteBlobs.get(entry.sha)?.length ?? 0 });
      }
      const sha = createHash("sha1").update(JSON.stringify([...base.values()])).digest("hex");
      trees.set(sha, [...base.values()]); return Response.json({ sha });
    }
    if (path.endsWith("/git/commits")) {
      const sha = createHash("sha1").update(JSON.stringify(body)).digest("hex");
      commits.set(sha, { message: body.message, parents: body.parents.map((sha: string) => ({ sha })), tree: { sha: body.tree } });
      return Response.json({ sha });
    }
    if (path === "/graphql") {
      const updates = body.variables.input.refUpdates;
      if (rejectRef) return Response.json({ errors: [{ type: "FORBIDDEN", message: "Protected branch rule" }] });
      if (updates.some((u: any) => (refs.get(u.name.slice(11)) ?? "0".repeat(40)) !== u.beforeOid)) return Response.json({ errors: [{ type: "UNPROCESSABLE", message: "beforeOid does not match" }] });
      for (const u of updates) refs.set(u.name.slice(11), u.afterOid);
      if (transportAfterRef) throw new Error("Lost response");
      return Response.json({ data: { updateRefs: { clientMutationId: body.variables.input.clientMutationId } } });
    }
    if (/\/pulls(?:\/\d+)?$/.test(path)) {
      if (prFailure) return Response.json({ message: "PR unavailable" }, { status: 503 });
      const number = method === "PATCH" ? Number(path.split("/").at(-1)) : 43;
      const branch = body.head ?? (number === 39 ? "feature/mobile" : "tau/update");
      createdPr = { number, title: body.title, body: body.body, draft: body.draft, html_url: `https://github.com/acme/atlas/pull/${number}`, state: "open", head: { ref: branch, repo: { full_name: "acme/atlas" } }, base: { ref: body.base ?? "main" } };
      return Response.json(createdPr);
    }
    throw new Error(`Unexpected write ${method} ${path}`);
  }
  if (path === "/user") return Response.json({ id: 1, login: "alex" });
  if (path.includes("/git/ref/")) {
    const branch = decodeURIComponent(path.split("/git/ref/heads/")[1]!);
    const sha = refs.get(branch);
    return sha ? Response.json({ object: { sha } }) : Response.json({}, { status: 404 });
  }
  if (path.includes("/git/commits/")) return Response.json(commits.get(path.split("/").at(-1)!) ?? { tree: { sha: "b".repeat(40) } });
  if (path.includes("/git/trees/")) return Response.json({ tree: trees.get(path.split("/git/trees/")[1]!.split("?")[0]!) ?? remoteFiles, truncated });
  if (path.includes("/git/blobs/")) {
    const bytes = remoteBlobs.get(path.split("/").at(-1)!);
    return bytes ? Response.json({ content: Buffer.from(bytes).toString("base64"), encoding: "base64", size: bytes.length }) : Response.json({}, { status: 404 });
  }
  if (path.includes("/pulls/")) {
    const number = Number(path.split("/").at(-1));
    return Response.json({ number, title: "Update atlas", state: prState, html_url: `https://github.com/acme/atlas/pull/${number}`, head: { ref: number === 39 ? "feature/mobile" : "tau/update", repo: prRepo ? { full_name: prRepo } : null }, base: { ref: "main", repo: { full_name: "acme/atlas" } }, draft: true, body: "Details" });
  }
  if (path.includes("/pulls?")) return Response.json(createdPr ? [createdPr] : []);
  return Response.json({ permissions: { push: permissions }, node_id: "R_fixture", default_branch: "main", full_name: "acme/atlas", name: "atlas", owner: { login: "acme" }, html_url: "https://github.com/acme/atlas", private: true });
}) as typeof fetch;

const controller = await import("@/api/controllers/githubProject.controller");
const { requireAuth } = await import("@/api/middleware/auth.middleware");
const { issueAccessToken } = await import("@/api/lib/tokens");
const { AppError } = await import("@/api/lib/errors");
const { env } = await import("@/lib/env");
const app = express();
app.use(express.json());
app.use(requireAuth);
app.post("/project/:projectId/github/push", controller.push);
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
  localFiles = []; remoteFiles = []; localBlobs = new Map(); remoteBlobs = new Map(); requests = []; writes = [];
  connected = true; revoked = 0; truncated = false; upstreamStatus = 0; failurePath = ""; prState = "open"; prRepo = "acme/atlas";
  duringRead = null; duringWrite = null; permissions = true; rejectRef = false; transportAfterRef = false; prFailure = false; createdPr = null; savedSequence = -1;
  project = { ...project, userId: "owner", githubRepo: "acme/atlas", headSequence: 30, githubPushMode: "new_pr", lastPrNumber: 42, lastPushedBranch: "tau/update", lastPushedSequence: 1 };
  refs = new Map([["main", "a".repeat(40)], ["tau/update", "a".repeat(40)], ["feature/mobile", "a".repeat(40)]]);
  commits = new Map(); trees = new Map();
  local("src/App.tsx", "new\n"); remote("src/App.tsx", "old\n", "100755");
  local("new.ts", "added\n"); remote("docs/README.md", "Keep me\n");
  local(".gitignore", "dist/\n"); remote(".gitignore", "dist/\n");
  local("dist/build.js", "ignored"); local(".env", "secret"); remote(".env", "remote secret");
  remoteFiles.push({ path: "vendor/link", type: "blob", mode: "120000", sha: "d".repeat(40), size: 10 });
  remoteFiles.push({ path: "vendor/module", type: "commit", mode: "160000", sha: "e".repeat(40), size: 0 });
  trees.set("b".repeat(40), remoteFiles);
});
afterAll(() => { server.close(); globalThis.fetch = realFetch; });
async function push(review: import("@/api/lib/githubComparison").GithubComparison, overrides: Record<string, unknown> = {}, user = "owner") {
  const token = user === "owner" ? apiToken : user ? issueAccessToken({ id: user, email: "test@example.test" }) : null;
  return fetch(`http://127.0.0.1:${address.port}/project/${PID}/github/push`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ preview: review.preview, mode: review.mode, prNumber: review.prNumber, title: "Reviewed change", description: "Context for reviewers", ...overrides }) });
}
function publishedTree(branch: string) { return trees.get(commits.get(refs.get(branch)!)!.tree.sha)!; }

test("direct push overlays the base tree, preserves remote-only files, symlinks, submodules and executable modes", async () => {
  local("raw.unknown", new Uint8Array([0, 255, 128, 13, 10])); local("bom.txt", "\ufeffhello\n");
  const review = await comparison({ mode: "direct" });
  const res = await push(review); const result = await res.json(); expect(res.status, JSON.stringify(result)).toBe(200);
  const treeWrite = writes.find((w) => w.path.endsWith("/git/trees"))!;
  expect(treeWrite.body.base_tree).toBe("b".repeat(40));
  expect(treeWrite.body.tree.map((e: any) => e.path).sort()).toEqual(["bom.txt", "new.ts", "raw.unknown", "src/App.tsx"]);
  const final = publishedTree("main");
  expect(final.find((e) => e.path === "src/App.tsx")?.mode).toBe("100755");
  for (const path of ["docs/README.md", ".env", "vendor/link", "vendor/module"]) expect(final.find((e) => e.path === path)).toEqual(remoteFiles.find((e) => e.path === path));
  expect(final.find((e) => e.path === "raw.unknown")?.sha).toBe(gitSha(new Uint8Array([0,255,128,13,10])));
  expect(final.find((e) => e.path === "bom.txt")?.sha).toBe(gitSha(new TextEncoder().encode("\ufeffhello\n")));
  expect(writes.filter((w) => w.path.endsWith("/git/blobs")).every((w) => w.body.encoding === "base64")).toBe(true);
  expect(commits.get(refs.get("main")!)?.message).toContain("Context for reviewers");
  expect(savedSequence).toBe(30); expect(result.commitUrl).toContain(refs.get("main")); expect(result.prUrl).toBeUndefined();
});

test("only the signed explicit deletion is removed", async () => {
  const review = await comparison({ mode: "direct", deletions: JSON.stringify(["docs/README.md"]) });
  expect((await push(review)).status).toBe(200);
  expect(publishedTree("main").some((e) => e.path === "docs/README.md")).toBe(false);
  expect(publishedTree("main").some((e) => e.path === ".env")).toBe(true);
  expect(writes.find((w) => w.path.endsWith("/git/trees"))!.body.tree.filter((e: any) => e.sha === null)).toEqual([{ path: "docs/README.md", mode: "100644", type: "blob", sha: null }]);
});

test("new PR forwards title, description and draft, guarding the base and new ref atomically", async () => {
  const review = await comparison(); const res = await push(review, { draft: true }); const result = await res.json();
  expect(res.status).toBe(200); expect(result.prNumber).toBe(43); expect(result.warning).toBeUndefined();
  expect(createdPr).toMatchObject({ title: "Reviewed change", body: "Context for reviewers", draft: true, base: { ref: "main" } });
  expect(refs.get("main")).toBe("a".repeat(40)); expect(result.branch.startsWith("tau/")).toBe(true);
  const updates = writes.find((w) => w.path === "/graphql")!.body.variables.input;
  expect(updates.repositoryId).toBe("R_fixture");
  expect(updates.refUpdates[0]).toEqual({ name: "refs/heads/main", beforeOid: "a".repeat(40), afterOid: "a".repeat(40), force: false });
  expect(updates.refUpdates[1].beforeOid).toBe("0".repeat(40)); expect(updates.refUpdates[1].force).toBe(false);
});

test("explicit selected PR is updated instead of the remembered PR, including title and body", async () => {
  const review = await comparison({ mode: "update_pr", prNumber: "39" });
  expect(review.prNumber).toBe(39); expect(review.branch).toBe("feature/mobile");
  const res = await push(review); const result = await res.json(); expect(res.status).toBe(200); expect(result.prNumber).toBe(39);
  expect(writes.find((w) => w.path.endsWith("/pulls/39"))?.body).toEqual({ title: "Reviewed change", body: "Context for reviewers" });
  expect(refs.get("tau/update")).toBe("a".repeat(40)); expect(refs.get("main")).toBe("a".repeat(40)); expect(savedSequence).toBe(30);
});

test("owner and session checks run before any GitHub request", async () => {
  const review = await comparison(); requests = [];
  expect((await push(review, {}, "intruder")).status).toBe(403); expect((await push(review, {}, "")).status).toBe(401);
  expect(requests).toEqual([]); expect(writes).toEqual([]);
});

test("tampered, expired and mismatched mode/PR previews cannot write", async () => {
  const review = await comparison();
  const decoded = jwt.decode(review.preview) as Record<string, unknown>; delete decoded.iat; delete decoded.exp;
  const expired = jwt.sign(decoded, env.ACCESS_TOKEN_SECRET, { expiresIn: -1 });
  for (const override of [{ preview: "invalid" }, { preview: expired }, { mode: "direct" }, { prNumber: 39 }]) expect((await push(review, override)).status).toBe(409);
  expect(writes).toEqual([]);
});

test("local sequence, manifest, association and remote SHA changes reject before uploads", async () => {
  for (const change of [() => project.headSequence++, () => local("new.ts", "different"), () => project.githubRepo = "acme/other", () => refs.set("main", "c".repeat(40))]) {
    const review = await comparison(); const original = { ...project }; const files = structuredClone(localFiles); const heads = new Map(refs);
    change(); expect((await push(review)).status).toBe(409); expect(writes).toEqual([]);
    project = original; localFiles = files; refs = heads;
  }
});

test("read-only permissions are visible in comparison and enforced at publication", async () => {
  permissions = false; const review = await comparison(); expect(review.canPush).toBe(false);
  expect((await push(review)).status).toBe(403); expect(writes).toEqual([]);
  permissions = true; const allowed = await comparison(); permissions = false;
  expect((await push(allowed)).status).toBe(403); expect(writes).toEqual([]);
});

test("a local edit during blob upload aborts before creating a commit or changing refs", async () => {
  const review = await comparison({ mode: "direct" });
  duringWrite = (path) => { if (path.endsWith("/git/blobs")) { project.headSequence++; duringWrite = null; } };
  expect((await push(review)).status).toBe(409); expect(writes.some((w) => w.path.endsWith("/git/commits") || w.path === "/graphql")).toBe(false);
  expect(refs.get("main")).toBe("a".repeat(40));
});

test("a local edit during commit staging aborts before ref publication", async () => {
  const review = await comparison({ mode: "direct" });
  duringWrite = (path) => { if (path.endsWith("/git/commits")) { project.headSequence++; duringWrite = null; } };
  expect((await push(review)).status).toBe(409); expect(writes.some((w) => w.path === "/graphql")).toBe(false); expect(savedSequence).toBe(-1);
});

test("GitHub CAS rejects a branch race at publication, including a rollback to an ancestor", async () => {
  for (const mode of ["direct", "new_pr"] as const) {
    const review = await comparison({ mode });
    duringWrite = (path) => { if (path === "/graphql") { refs.set("main", "9".repeat(40)); duringWrite = null; } };
    expect((await push(review)).status).toBe(409); expect(refs.get("main")).toBe("9".repeat(40)); expect([...refs.keys()].length).toBe(3);
    expect(savedSequence).toBe(-1); refs.set("main", "a".repeat(40));
  }
});

test("branch rules reject cleanly without PR creation or bookkeeping", async () => {
  const review = await comparison({ mode: "direct" }); rejectRef = true;
  const res = await push(review); expect(res.status).toBe(403); expect((await res.json()).error).toContain("branch rules"); expect(refs.get("main")).toBe("a".repeat(40)); expect(savedSequence).toBe(-1);
});

test("closed and forked selected PRs cannot be pushed", async () => {
  const review = await comparison({ mode: "update_pr", prNumber: "39" });
  prState = "closed"; expect((await push(review)).status).toBe(409);
  prState = "open"; prRepo = "someone/fork"; expect((await push(review)).status).toBe(409); expect(writes).toEqual([]);
});

test("PR failure reports committed partial success and replay never adds a commit or duplicate PR", async () => {
  const review = await comparison(); prFailure = true;
  const res = await push(review); const result = await res.json(); expect(res.status).toBe(200); expect(result.warning).toContain("commit was pushed"); expect(result.commitUrl).toContain(refs.get(result.branch)); expect(savedSequence).toBe(30);
  const count = writes.length;
  const replay = await push(review); const repeated = await replay.json(); expect(replay.status).toBe(200); expect(repeated.commitUrl).toBe(result.commitUrl); expect(writes.length).toBe(count);
});

test("successful new-PR replay returns the existing PR without writes", async () => {
  const review = await comparison(); const result = await (await push(review)).json(); const count = writes.length;
  const again = await (await push(review, { title: "Edited during a retry" })).json(); expect(again.prUrl).toBe(result.prUrl); expect(again.commitUrl).toBe(result.commitUrl); expect(writes.length).toBe(count);
});

test("direct replay is stale and never creates a duplicate commit", async () => {
  const review = await comparison({ mode: "direct" }); expect((await push(review)).status).toBe(200); const count = writes.length;
  expect((await push(review)).status).toBe(409); expect(writes.length).toBe(count);
});

test("a lost ref response is confirmed and reported as success", async () => {
  const review = await comparison({ mode: "direct" }); transportAfterRef = true;
  const res = await push(review); const result = await res.json(); expect(res.status).toBe(200); expect(result.warning).toBeUndefined(); expect(result.commitUrl).toContain(refs.get("main")); expect(savedSequence).toBe(30);
});

test("edits after publication are left unpushed and bookkeeping records only the reviewed sequence", async () => {
  const review = await comparison();
  duringWrite = (path) => { if (path.endsWith("/pulls")) { project.headSequence = 31; duringWrite = null; } };
  expect((await push(review)).status).toBe(200); expect(savedSequence).toBe(30); expect(project.headSequence).toBe(31);
});

test("draft is rejected for direct/update modes and invalid compose fields cannot write", async () => {
  const review = await comparison({ mode: "direct" });
  for (const override of [{ draft: true }, { title: "" }, { title: "x".repeat(201) }, { description: "x".repeat(5001) }, { prNumber: -1 }]) expect((await push(review, override)).status).toBe(400);
  expect(writes).toEqual([]);
});

test("worker compatibility uses the reviewed overlay engine", async () => {
  const { pushProjectToGithub } = await import("@/api/lib/github");
  const result = await pushProjectToGithub(PID, "owner", { title: "Agent change", body: "Agent description", mode: "direct" });
  expect(result).not.toHaveProperty("error"); expect(publishedTree("main").some((e) => e.path === "docs/README.md")).toBe(true);
  expect(writes.find((w) => w.path.endsWith("/git/trees"))?.body.base_tree).toBe("b".repeat(40));
});
