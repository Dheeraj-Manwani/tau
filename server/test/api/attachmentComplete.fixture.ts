import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import express, { type Request, type Response, type NextFunction } from "express";
import { AppError, Errors } from "@/api/lib/errors";

// `POST /attachments/:id/complete`, and what the upload limit counts
// (doc/ATTACHMENTS_PLAN.md A2 and A3.1). The database, the bucket and the
// reader are faked. Runs in a child (attachmentComplete.test.ts).

const id = "550e8400-e29b-41d4-a716-446655440000";
const base = { id, userId: "owner", status: "PENDING", sizeBytes: 4, contentHash: "h", blobKey: "tau/attachments/owner/h", mimeType: "image/png", messageId: null, feedbackId: null, kind: "IMAGE", filename: "a.png", extractionError: null, extractedText: null, preview: null };
let row: Record<string, unknown> = { ...base };
let stored = true;
let reads: { id: string; hint: string | undefined }[] = [];
let counted: string[] = [];

mock.module("@/lib/env", () => ({ env: { ATTACHMENTS_ENABLED: true, ATTACHMENT_MAX_BYTES: 16, ATTACHMENT_MAX_IMAGE_BYTES: 8 } }));
mock.module("@/lib/prisma", () => ({
  prisma: {
    attachment: {
      findUnique: async () => row,
      create: async () => ({ id }),
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(row, data),
      // The claim in `completeUpload`: one statement, so it is one step here.
      updateMany: async ({ where, data }: { where: { status: { in: string[] } }; data: Record<string, unknown> }) => {
        if (!where.status.in.includes(row.status as string)) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
  },
}));
mock.module("@/lib/s3", () => ({
  attachmentKey: (user: string, hash: string) => `tau/attachments/${user}/${hash}`,
  putAttachmentBytes: async () => {}, deleteObject: async () => {}, objectExists: async () => stored, presignGet: async () => "", presignPut: async () => "https://r2.example/put",
}));
mock.module("@/api/lib/attachments", () => ({
  maxBytesForMime: () => 8, isAllowedUpload: () => true, kindForMime: () => "IMAGE", truncate: (text: string) => text, PREVIEW_CHARS: 240,
  runExtraction: async (attachmentId: string, hint?: string) => { reads.push({ id: attachmentId, hint }); return []; },
}));
mock.module("@/api/middleware/auth.middleware", () => ({ requireUserId: (req: Request) => {
  if (!req.user) throw Errors.unauthorized();
  return req.user.id;
} }));
mock.module("@/api/middleware/rateLimit.middleware", () => ({
  attachmentRateLimiter: (req: Request, _res: Response, next: NextFunction) => { counted.push(`${req.method} ${req.path}`); next(); },
}));
const { default: routes } = await import("@/api/routes/attachment.routes");
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { id: "owner", email: "test@example.com" };
  next();
});
app.use("/attachments", routes);
app.use((error: AppError & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  res.status(error.statusCode ?? error.status ?? 500).json({ error: error.message });
});
const server = app.listen(0);
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/attachments`;
const post = (path: string, body: unknown = {}) =>
  fetch(`${origin}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const complete = (body: unknown = {}) => post(`/${id}/complete`, body);

beforeEach(() => { row = { ...base }; stored = true; reads = []; counted = []; });
afterAll(() => server.close());

test("without defer the read starts now, with the user's words as the hint", async () => {
  const res = await complete({ userMessage: "fix this" });
  expect(res.status).toBe(202);
  expect(await res.json()).toEqual({ status: "EXTRACTING" });
  expect(reads).toEqual([{ id, hint: "fix this" }]);
  expect(row.status).toBe("EXTRACTING");
});

test("with defer the file is confirmed as stored and nothing reads it", async () => {
  const res = await complete({ defer: true, userMessage: "fix this" });
  expect(res.status).toBe(202);
  expect(await res.json()).toEqual({ status: "PENDING" });
  expect(reads).toHaveLength(0);
  expect(row.status).toBe("PENDING");
});

test("a file that never arrived is refused either way, and marked", async () => {
  for (const body of [{}, { defer: true }]) {
    row = { ...base };
    stored = false;
    expect((await complete(body)).status).toBe(400);
    expect(row.status).toBe("FAILED");
    expect(reads).toHaveLength(0);
  }
});

test("calling it again, or twice at once, starts one read", async () => {
  await complete();
  await complete();
  expect(reads).toHaveLength(1);

  row = { ...base };
  reads = [];
  const both = await Promise.all([complete(), complete()]);
  expect(both.map((r) => r.status)).toEqual([202, 202]);
  expect(reads).toHaveLength(1);
});

test("a file already read is not read again, and a failed one can be tried again", async () => {
  row = { ...base, status: "READY" };
  expect(await (await complete()).json()).toEqual({ status: "READY" });
  expect(reads).toHaveLength(0);

  row = { ...base, status: "FAILED", extractionError: "429" };
  await complete();
  expect(reads).toHaveLength(1);
  expect(row.extractionError).toBeNull();
});

test("the upload limit counts a file once: at sign, and at paste", async () => {
  await post("/sign", { filename: "a.png", mimeType: "image/png", sizeBytes: 4, contentHash: "a".repeat(64) });
  await fetch(`${origin}/${id}/upload`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: Buffer.from([1, 2, 3, 4]) });
  await complete({ defer: true });
  await complete();
  expect(counted).toEqual(["POST /sign"]);
});
