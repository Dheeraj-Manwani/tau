import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Sandbox } from "e2b";

// `use_attachment` against a fake sandbox, an in-memory attachment table and a
// fake bucket. Module mocks are process-global in Bun, so this runs in a child
// (useAttachment.test.ts), like the other fixtures.

const APP = "/home/user/app";

/** The 24 bytes a PNG's size is read from, then filler. */
function png(width: number, height: number): Uint8Array {
  const buf = Buffer.alloc(64);
  buf.writeUInt32BE(0x89504e47, 0);
  buf.writeUInt32BE(0x0d0a1a0a, 4);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return new Uint8Array(buf);
}

interface Row {
  id: string;
  userId: string;
  projectId: string;
  filename: string;
  mimeType: string;
  blobKey: string | null;
}

let rows: Row[];
let blobs: Record<string, Uint8Array>;
let saved: { path: string; bytes: Uint8Array }[];

type Where = { id?: string; userId: string; message: { projectId: string }; blobKey?: unknown };
const mine = (r: Row, where: Where) => r.userId === where.userId && r.projectId === where.message.projectId;

mock.module("@/lib/prisma", () => ({
  prisma: {
    attachment: {
      findFirst: async ({ where }: { where: Where }) => rows.find((r) => r.id === where.id && mine(r, where)) ?? null,
      findMany: async ({ where }: { where: Where }) => rows.filter((r) => mine(r, where) && r.blobKey !== null),
    },
  },
}));
const realS3 = await import("@/lib/s3");
mock.module("@/lib/s3", () => ({
  ...realS3,
  getObjectBytes: async (key: string) => {
    const bytes = blobs[key];
    if (!bytes) throw new Error("NoSuchKey");
    return bytes;
  },
}));
mock.module("@/worker/lib/publish", () => ({ publish: async () => {} }));
mock.module("@/worker/lib/projectWorkspace", () => ({ markProjectWorkspaceStarted: async () => {} }));
const realUtils = await import("@/worker/agent/tools/functions/utils");
mock.module("@/worker/agent/tools/functions/utils", () => ({
  ...realUtils,
  persistBinaryFile: async (_j: string, _p: string, _u: string, path: string, bytes: Uint8Array) => {
    saved.push({ path, bytes });
    return { persisted: true };
  },
}));

const { useAttachment, attachmentExtension } = await import("@/worker/agent/tools/functions/use-attachment");
const { BASE_APP_TOOLS, TOOL_DEFINITIONS } = await import("@/worker/agent/tools/tools");

function fakeSandbox() {
  const files: Record<string, ArrayBuffer> = {};
  const sandbox = {
    files: {
      write: async (path: string, content: ArrayBuffer) => {
        files[path] = content;
      },
    },
  } as unknown as Sandbox;
  return { sandbox, files };
}

const run = (sandbox: Sandbox, attachment_id: string, path: string) =>
  useAttachment({ attachment_id, path }, sandbox, "job", "proj", "user", () => 0) as Promise<Record<string, any>>;

beforeEach(() => {
  rows = [
    { id: "att-photo", userId: "user", projectId: "proj", filename: "me.PNG", mimeType: "image/png", blobKey: "k/photo" },
    { id: "att-cv", userId: "user", projectId: "proj", filename: "cv.pdf", mimeType: "application/pdf", blobKey: "k/cv" },
    { id: "att-doc", userId: "user", projectId: "proj", filename: "notes.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", blobKey: "k/doc" },
    { id: "att-paste", userId: "user", projectId: "proj", filename: "Pasted content", mimeType: "text/plain", blobKey: null },
    { id: "att-elsewhere", userId: "user", projectId: "other-project", filename: "logo.png", mimeType: "image/png", blobKey: "k/logo" },
    { id: "att-theirs", userId: "someone-else", projectId: "proj", filename: "theirs.png", mimeType: "image/png", blobKey: "k/theirs" },
  ];
  blobs = {
    "k/photo": png(1200, 1600),
    "k/cv": new TextEncoder().encode("%PDF-1.7 a document"),
    "k/doc": new Uint8Array([80, 75, 3, 4]),
    "k/logo": png(64, 64),
    "k/theirs": png(64, 64),
  };
  saved = [];
});

describe("use_attachment", () => {
  test("saves the user's picture into the project and says where it is and how big", async () => {
    const { sandbox, files } = fakeSandbox();
    const result = await run(sandbox, "att-photo", "public/portrait.jpg");

    expect(result).toEqual({
      success: true,
      path: "/portrait.png", // the extension follows the file, not the request
      file: "public/portrait.png",
      name: "me.PNG",
      bytes: 64,
      width: 1200,
      height: 1600,
    });
    expect([...new Uint8Array(files[`${APP}/public/portrait.png`]!)]).toEqual([...blobs["k/photo"]!]);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.path).toBe("public/portrait.png");
    expect([...saved[0]!.bytes]).toEqual([...blobs["k/photo"]!]);
  });

  test("a path outside public/ is put under it", async () => {
    const { sandbox } = fakeSandbox();
    expect((await run(sandbox, "att-photo", "src/assets/me")).file).toBe("public/me.png");
  });

  test("a PDF is saved too, with no size", async () => {
    const { sandbox, files } = fakeSandbox();
    const result = await run(sandbox, "att-cv", "public/cv.pdf");
    expect(result.success).toBe(true);
    expect(result.path).toBe("/cv.pdf");
    expect(result.width).toBeUndefined();
    expect(files[`${APP}/public/cv.pdf`]).toBeDefined();
  });

  test("an id from another project or another account finds nothing, and is told what was sent here", async () => {
    for (const id of ["att-elsewhere", "att-theirs", "no-such-id"]) {
      const { sandbox, files } = fakeSandbox();
      const result = await run(sandbox, id, "public/x.png");
      expect(result.error).toContain("No attachment with that id");
      expect(result.error).toContain("att-photo (me.PNG)");
      expect(result.error).toContain("att-cv (cv.pdf)");
      // Neither what cannot be placed nor what belongs elsewhere is offered.
      expect(result.error).not.toContain("att-doc");
      expect(result.error).not.toContain("att-elsewhere");
      expect(result.error).not.toContain("att-theirs");
      expect(Object.keys(files)).toHaveLength(0);
      expect(saved).toHaveLength(0);
    }
  });

  test("with nothing usable sent, it says to ask for the file", async () => {
    rows = rows.filter((r) => r.id === "att-doc" || r.id === "att-paste");
    const { sandbox } = fakeSandbox();
    expect((await run(sandbox, "nope", "public/x.png")).error).toContain("Ask them to attach it");
  });

  test("a document that is not a picture or a PDF, and pasted text, are refused and nothing is written", async () => {
    for (const id of ["att-doc", "att-paste"]) {
      const { sandbox, files } = fakeSandbox();
      const result = await run(sandbox, id, "public/x.png");
      expect(result.error).toContain("only a picture or a PDF");
      expect(Object.keys(files)).toHaveLength(0);
      expect(saved).toHaveLength(0);
    }
  });

  test("a file that is gone from storage is reported, not saved empty", async () => {
    delete blobs["k/photo"];
    const { sandbox, files } = fakeSandbox();
    const result = await run(sandbox, "att-photo", "public/portrait.png");
    expect(result.error).toContain("attach it again");
    expect(Object.keys(files)).toHaveLength(0);

    blobs["k/photo"] = new Uint8Array(0);
    expect((await run(sandbox, "att-photo", "public/portrait.png")).error).toContain("attach it again");
    expect(saved).toHaveLength(0);
  });

  test("the extension comes from what the file is", () => {
    expect(attachmentExtension("photo.jpeg", "image/jpeg")).toBe("jpg");
    expect(attachmentExtension("photo", "IMAGE/JPG")).toBe("jpg");
    expect(attachmentExtension("anim.gif", "image/gif")).toBe("gif");
    expect(attachmentExtension("cv.pdf", "application/octet-stream")).toBe("pdf");
    expect(attachmentExtension("notes.docx", "application/octet-stream")).toBeNull();
    expect(attachmentExtension("data.csv", "text/csv")).toBeNull();
    expect(attachmentExtension("logo.svg", "image/svg+xml")).toBeNull();
  });

  test("is a base-app tool that asks for the attachment and a path", () => {
    const tool = BASE_APP_TOOLS.find((t) => t.function.name === "use_attachment")!;
    expect(tool.function.parameters.required as readonly string[]).toEqual(["attachment_id", "path"]);
    expect((TOOL_DEFINITIONS.map((t) => t.function.name) as string[])).not.toContain("use_attachment");
  });
});
