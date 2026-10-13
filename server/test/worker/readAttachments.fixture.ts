import { beforeEach, describe, expect, mock, test } from "bun:test";

// Reading a message's files when its run starts (doc/ATTACHMENTS_PLAN.md A3),
// against an in-memory message and attachment table and a fake reader. Module
// mocks are process-global in Bun, so this runs in a child
// (readAttachments.test.ts).

interface Att {
  id: string;
  messageId: string;
  kind: "IMAGE" | "FILE" | "PASTED";
  filename: string;
  status: "PENDING" | "EXTRACTING" | "READY" | "FAILED";
  extractedText: string | null;
  extractionError: string | null;
}
interface Msg {
  id: string;
  sequence: number;
  content: unknown;
}

let messages: Msg[];
let attachments: Att[];
let events: Record<string, any>[];
let billed: { model: string; what: string }[];
let reads: { id: string; words: string | undefined; exact: boolean }[];
let cancelled: boolean;
/** What the fake reader does to a file: the text it finds, or an error. */
let reading: Record<string, string | Error>;

const realAttachments = await import("@/api/lib/attachments");
const { QUICK_CODE_NOTE, unreadAttachmentBlock, attachmentBlock } = realAttachments;

mock.module("@/api/lib/attachments", () => ({
  ...realAttachments,
  runExtraction: async (id: string, words?: string, opts: { exact?: boolean } = {}) => {
    const row = attachments.find((a) => a.id === id)!;
    // As the real one: a file that is read is left alone, unless it is a quick
    // reading of code and the exact one is wanted.
    if (row.status === "READY" && !(opts.exact && row.extractedText?.startsWith(QUICK_CODE_NOTE))) return [];
    reads.push({ id, words, exact: opts.exact === true });
    const result = reading[id] ?? `Description of ${row.filename}.`;
    if (result instanceof Error) {
      // A second reading that fails leaves the first one where it was.
      if (row.status !== "READY") Object.assign(row, { status: "FAILED", extractionError: result.message });
      return [];
    }
    Object.assign(row, { status: "READY", extractedText: result, extractionError: null });
    return row.kind === "IMAGE" ? [{ model: "flash", inputTokens: 700, outputTokens: 50 }] : [];
  },
}));
mock.module("@/lib/prisma", () => ({
  prisma: {
    message: {
      findMany: async ({ take }: { take: number }) =>
        messages
          .filter((m) => attachments.some((a) => a.messageId === m.id))
          .sort((a, b) => b.sequence - a.sequence)
          .slice(0, take)
          .map((m) => ({ ...m, attachments: attachments.filter((a) => a.messageId === m.id).map((a) => ({ ...a })) })),
      findFirst: async () => [...messages].sort((a, b) => b.sequence - a.sequence)[0] ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { content: unknown } }) => {
        messages.find((m) => m.id === where.id)!.content = data.content;
      },
    },
    attachment: {
      findUnique: async ({ where }: { where: { id: string } }) => attachments.find((a) => a.id === where.id) ?? null,
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => attachments.filter((a) => where.id.in.includes(a.id)),
    },
  },
}));
mock.module("@/worker/lib/publish", () => ({
  publish: async (_job: string, event: Record<string, any>) => {
    events.push(event);
  },
}));
mock.module("@/worker/lib/meterCall", () => ({
  meterModelCall: async (_owner: unknown, usage: { model: string }, what: string) => {
    billed.push({ model: usage.model, what });
  },
}));
const realBus = await import("@/lib/bus");
mock.module("@/lib/bus", () => ({ ...realBus, bus: { isCancelled: () => cancelled, setPhase: () => {} } }));

const { readAttachmentsForRun, attachmentsToRead, usersWords } = await import("@/worker/lib/readAttachments");

const owner = { userId: "u", projectId: "p", jobId: "job", indexer: () => 0 };
const file = (id: string, over: Partial<Att> = {}): Att => ({
  id,
  messageId: "m1",
  kind: "IMAGE",
  filename: `${id}.png`,
  status: "PENDING",
  extractedText: null,
  extractionError: null,
  ...over,
});
const text = (t: string) => ({ type: "text", text: t });
const WORDLESS = "The user sent the attached content without a message. Respond to it.";
const blocksOf = (id: string) => (messages.find((m) => m.id === id)!.content as { text: string }[]).map((b) => b.text);

beforeEach(() => {
  attachments = [file("a"), file("b")];
  messages = [{ id: "m1", sequence: 1, content: [text("make it like this"), text(unreadAttachmentBlock(attachments[0]!)), text(unreadAttachmentBlock(attachments[1]!))] }];
  events = [];
  billed = [];
  reads = [];
  reading = {};
  cancelled = false;
});

describe("reading a request's files when its run starts", () => {
  test("unread files are read at once, with the user's words, and written into the message in order", async () => {
    await readAttachmentsForRun(owner, "LOW");

    expect(reads).toEqual([
      { id: "a", words: "make it like this", exact: false },
      { id: "b", words: "make it like this", exact: false },
    ]);
    expect(blocksOf("m1")).toEqual([
      "make it like this",
      '<attachment id="a" name="a.png" kind="image">\nDescription of a.png.\n</attachment>',
      '<attachment id="b" name="b.png" kind="image">\nDescription of b.png.\n</attachment>',
    ]);
  });

  test("the chat is told once, as a step with the file names, and each model call is charged to the run", async () => {
    await readAttachmentsForRun(owner, "LOW");
    expect(events).toEqual([
      { type: "tool_req", toolName: "read_attachments", toolCallId: "attachments_m1", input: { files: ["a.png", "b.png"] } },
      { type: "tool_res", toolCallId: "attachments_m1", output: { read: 2, failed: 0 } },
    ]);
    expect(billed).toEqual([
      { model: "flash", what: "attachment read" },
      { model: "flash", what: "attachment read" },
    ]);
  });

  test("a HIGH or MAX run asks for the exact text; a LOW one does not", async () => {
    await readAttachmentsForRun(owner, "HIGH");
    expect(reads.every((r) => r.exact)).toBe(true);
    attachments = [file("a"), file("b")];
    reads = [];
    messages[0]!.content = [text("x"), text(unreadAttachmentBlock(attachments[0]!)), text(unreadAttachmentBlock(attachments[1]!))];
    await readAttachmentsForRun(owner, "MAX");
    expect(reads.every((r) => r.exact)).toBe(true);
  });

  test("a message with no words keeps its closing line last, and the reader gets no hint", async () => {
    messages[0]!.content = [text(unreadAttachmentBlock(attachments[0]!)), text(unreadAttachmentBlock(attachments[1]!)), text(WORDLESS)];
    await readAttachmentsForRun(owner, "LOW");
    expect(reads.map((r) => r.words)).toEqual([undefined, undefined]);
    const blocks = blocksOf("m1");
    expect(blocks[0]).toStartWith('<attachment id="a"'); // still tau's, so the transcript shows no bubble text
    expect(blocks[0]).toContain("Description of a.png.");
    expect(blocks[2]).toBe(WORDLESS);
  });

  test("one file that cannot be read does not stop the other, and says so in its block", async () => {
    reading = { a: new Error("both readers failed") };
    await readAttachmentsForRun(owner, "LOW");
    const blocks = blocksOf("m1");
    expect(blocks[1]).toContain("(could not be read: both readers failed)");
    expect(blocks[2]).toContain("Description of b.png.");
    expect(events.at(-1)).toEqual({ type: "tool_res", toolCallId: "attachments_m1", output: { read: 1, failed: 1 } });
    expect(billed).toHaveLength(1);
  });

  test("files already read when the message was sent are left alone: no read, no step, no write", async () => {
    attachments = [file("a", { status: "READY", extractedText: "A page." }), file("c", { kind: "PASTED", status: "READY", extractedText: "pasted rows" })];
    const before = [text("hi"), text(attachmentBlock(attachments[0] as never)), text(attachmentBlock(attachments[1] as never))];
    messages[0]!.content = before;
    await readAttachmentsForRun(owner, "MAX");
    expect(reads).toHaveLength(0);
    expect(events).toHaveLength(0);
    expect(messages[0]!.content).toBe(before);
  });

  test("code read quickly at upload is read again for a HIGH run, without a step, and not for a LOW one", async () => {
    const quick = `${QUICK_CODE_NOTE}\n\nTypeError: x`;
    const arrange = () => {
      attachments = [file("a", { status: "READY", extractedText: quick })];
      messages[0]!.content = [text("fix this"), text(attachmentBlock(attachments[0] as never))];
      reads = [];
      events = [];
    };

    arrange();
    await readAttachmentsForRun(owner, "LOW");
    expect(reads).toHaveLength(0);

    arrange();
    reading = { a: "TypeError: x is not a functoin" };
    await readAttachmentsForRun(owner, "HIGH");
    expect(reads).toEqual([{ id: "a", words: "fix this", exact: true }]);
    expect(blocksOf("m1")[1]).toContain("TypeError: x is not a functoin");
    expect(blocksOf("m1")[1]).not.toContain(QUICK_CODE_NOTE);
    expect(events).toHaveLength(0);

    // The exact reader failing leaves the quick reading in place.
    arrange();
    reading = { a: new Error("429") };
    await readAttachmentsForRun(owner, "HIGH");
    expect(blocksOf("m1")[1]).toContain(quick);
  });

  test("an earlier message is never rewritten for exactness: the model has already seen it", async () => {
    attachments = [file("a", { status: "READY", extractedText: `${QUICK_CODE_NOTE}\n\nold` })];
    messages = [
      { id: "m1", sequence: 1, content: [text("fix this"), text(attachmentBlock(attachments[0] as never))] },
      { id: "m2", sequence: 5, content: [text("now make it blue")] },
    ];
    await readAttachmentsForRun(owner, "MAX");
    expect(reads).toHaveLength(0);
  });

  test("an earlier message whose run never started has its files read too", async () => {
    attachments = [file("a"), file("z", { messageId: "m2" })];
    messages = [
      { id: "m1", sequence: 1, content: [text("first try"), text(unreadAttachmentBlock(attachments[0]!))] },
      { id: "m2", sequence: 2, content: [text("second try"), text(unreadAttachmentBlock(attachments[1]!))] },
    ];
    await readAttachmentsForRun(owner, "LOW");
    expect(reads.map((r) => [r.id, r.words])).toEqual([["a", "first try"], ["z", "second try"]]);
    expect(blocksOf("m1")[1]).toContain("Description of a.png.");
    expect(blocksOf("m2")[1]).toContain("Description of z.png.");
  });

  test("a second call finds nothing to do", async () => {
    await readAttachmentsForRun(owner, "LOW");
    reads = [];
    events = [];
    await readAttachmentsForRun(owner, "LOW");
    expect(reads).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  test("a read already under way is waited for, not started twice over", async () => {
    attachments = [file("a", { status: "EXTRACTING" })];
    messages[0]!.content = [text("x"), text(unreadAttachmentBlock(attachments[0]!))];
    setTimeout(() => Object.assign(attachments[0]!, { status: "READY", extractedText: "Read by the upload." }), 150);
    reading = { a: "Read by the run." };
    await readAttachmentsForRun(owner, "LOW");
    expect(reads).toHaveLength(0);
    expect(blocksOf("m1")[1]).toContain("Read by the upload.");
  });

  test("a cancelled run reads nothing, and a database error does not fail the run", async () => {
    cancelled = true;
    await readAttachmentsForRun(owner, "LOW");
    expect(reads).toHaveLength(0);

    cancelled = false;
    messages[0]!.content = "not blocks";
    await readAttachmentsForRun(owner, "LOW"); // no throw
    expect(reads).toHaveLength(0);
  });
});

describe("the planning behind it", () => {
  test("only blocks still holding a place count as unread", () => {
    const a = file("a");
    const b = file("b", { status: "READY", extractedText: "A page." });
    const blocks = [text("hello"), text(unreadAttachmentBlock(a)), text(attachmentBlock(b as never))];
    expect(attachmentsToRead(blocks, [a, b], { current: true, exact: true })).toEqual({ unread: ["a"], again: [] });
  });

  test("a block for a file that is not this message's is ignored", () => {
    const blocks = [text(unreadAttachmentBlock(file("stranger")))];
    expect(attachmentsToRead(blocks, [file("a")], { current: true, exact: true })).toEqual({ unread: [], again: [] });
  });

  test("the user's words are block 0, unless block 0 is one of tau's", () => {
    expect(usersWords([text("fix this"), text('<attachment id="a" name="a" kind="image">\nx\n</attachment>')])).toBe("fix this");
    expect(usersWords([text('<attachment id="a" name="a" kind="image">\nx\n</attachment>')])).toBe("");
    expect(usersWords([text('<selected-element file="a" line="1" tag="div">\nx\n</selected-element>')])).toBe("");
    expect(usersWords([text("<build-error>\nx\n</build-error>")])).toBe("");
    expect(usersWords([])).toBe("");
  });
});
