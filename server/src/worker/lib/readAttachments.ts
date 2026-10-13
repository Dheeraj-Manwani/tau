/**
 * Reading the files a message was sent with, when its run starts.
 *
 * A send no longer waits for a file to be read (doc/ATTACHMENTS_PLAN.md §3):
 * the message is stored with a block that holds each unread file's place, and
 * this fills those blocks in before the model is shown the message. From then
 * on the stored message is what it always was, the user's words followed by a
 * description of each file, and nothing later in the run knows the difference.
 *
 * What it does, for the request about to run:
 *
 *   - reads every file whose block is still a placeholder, all at once;
 *   - on a HIGH or MAX run, has Kimi read again any picture of code that was
 *     only read quickly (`wantsExactRead`). That happens when a client asked
 *     for the read at upload, before anyone knew the effort;
 *   - tells the chat it is looking at the files, as a step. The step is tau's,
 *     not the model's: it is not stored in the conversation and the model can
 *     neither call it nor skip it;
 *   - charges each model call to the run, like the design read is.
 *
 * It never fails the run. A file that cannot be read gets a block that says
 * so, and the agent can still place it with `use_attachment`, which needs only
 * the stored bytes.
 */
import type { Prisma } from "@/generated/prisma/client";
import {
  AttachmentStatus,
  MessageRole,
  MessageType,
  type AttachmentKind,
  type Effort,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { bus } from "@/lib/bus";
import {
  attachmentBlock,
  attachmentBlockId,
  isUnreadBlock,
  runExtraction,
  wantsExactRead,
} from "@/api/lib/attachments";
import { log } from "./log";
import { meterModelCall, type CallOwner } from "./meterCall";
import { publish } from "./publish";

/** The step's name in the events sent to the chat. */
export const READ_ATTACHMENTS_STEP = "read_attachments";

/**
 * How many of a project's latest messages with files are looked at. One is
 * the request being run. The others cover a message whose run never started
 * (cancelled in the queue, the server restarted), which would otherwise reach
 * the model with its files unread for ever.
 */
const RECENT_MESSAGES = 5;

/** The longest the whole step may take. What is unread by then says so. */
const STEP_LIMIT_MS = 3 * 60_000;

/** How long to let a read that is already under way finish before starting another. */
const IN_FLIGHT_WAIT_MS = 60_000;

type Block = { type?: string; text?: string };

interface AttachmentRow {
  id: string;
  kind: AttachmentKind;
  filename: string;
  status: AttachmentStatus;
  extractedText: string | null;
  extractionError: string | null;
}

const ATTACHMENT_FIELDS = {
  id: true,
  kind: true,
  filename: true,
  status: true,
  extractedText: true,
  extractionError: true,
} as const;

/**
 * Which of a message's files have to be read before the model sees it.
 *
 * @param current the message is the request being run. Only that one has a
 *                quick reading replaced: an earlier message has already been
 *                sent to the model as it stands.
 * @param exact   the run wants the exact text of code (HIGH or MAX).
 */
export function attachmentsToRead(
  blocks: Block[],
  attachments: AttachmentRow[],
  opts: { current: boolean; exact: boolean },
): { unread: string[]; again: string[] } {
  const known = new Map(attachments.map((a) => [a.id, a]));
  const unread: string[] = [];
  const again: string[] = [];
  for (const block of blocks) {
    const text = block.text ?? "";
    const row = known.get(attachmentBlockId(text) ?? "");
    if (!row) continue;
    if (isUnreadBlock(text)) unread.push(row.id);
    else if (
      opts.current &&
      opts.exact &&
      row.status === AttachmentStatus.READY &&
      wantsExactRead(row.extractedText)
    ) {
      again.push(row.id);
    }
  }
  return { unread, again };
}

/** The message's blocks with each of `ids` showing what its file now says. */
export function withReadBlocks(blocks: Block[], rows: AttachmentRow[], ids: string[]): Block[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return blocks.map((block) => {
    const id = attachmentBlockId(block.text ?? "");
    const row = id && ids.includes(id) ? byId.get(id) : undefined;
    return row ? { type: "text", text: attachmentBlock(row) } : block;
  });
}

/**
 * What the user typed, as the hint for a read: "fix this error" wants the
 * text copied, "build this" wants the layout. Block 0 is theirs unless it is
 * one of tau's own tagged blocks, and a message with no words has none.
 */
export function usersWords(blocks: Block[]): string {
  const first = blocks[0]?.text ?? "";
  return /^<(attachment |selected-element |build-error>|runtime-error>)/.test(first) ? "" : first;
}

/** Read one file, after letting a read that is already under way finish. */
async function readOne(owner: CallOwner, id: string, words: string, exact: boolean): Promise<void> {
  const deadline = Date.now() + IN_FLIGHT_WAIT_MS;
  for (;;) {
    const row = await prisma.attachment.findUnique({ where: { id }, select: { status: true } });
    if (row?.status !== AttachmentStatus.EXTRACTING || Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const usage = await runExtraction(id, words || undefined, { exact });
  for (const call of usage) await meterModelCall(owner, call, "attachment read");
}

async function readMessage(
  owner: CallOwner,
  message: { id: string; content: Prisma.JsonValue; attachments: AttachmentRow[] },
  opts: { current: boolean; exact: boolean },
): Promise<void> {
  if (!Array.isArray(message.content)) return;
  const blocks = message.content as Block[];
  const { unread, again } = attachmentsToRead(blocks, message.attachments, opts);
  const ids = [...unread, ...again];
  if (ids.length === 0) return;

  const { jobId, projectId } = owner;
  // Announced only when there is a file nobody has read: a second reading of
  // one that already has a description is not something to show.
  const announce = unread.length > 0;
  const stepId = `attachments_${message.id}`;
  const started = Date.now();
  if (announce) {
    const files = message.attachments.filter((a) => unread.includes(a.id)).map((a) => a.filename);
    await publish(jobId, {
      type: "tool_req",
      toolName: READ_ATTACHMENTS_STEP,
      toolCallId: stepId,
      input: { files },
    });
    bus.setPhase(jobId, `tool:${READ_ATTACHMENTS_STEP}`);
  }

  const words = usersWords(blocks);
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled(ids.map((id) => readOne(owner, id, words, opts.exact))),
    new Promise((resolve) => {
      timer = setTimeout(resolve, STEP_LIMIT_MS);
    }),
  ]);
  clearTimeout(timer);

  const rows = await prisma.attachment.findMany({
    where: { id: { in: ids } },
    select: ATTACHMENT_FIELDS,
  });
  await prisma.message.update({
    where: { id: message.id },
    data: { content: withReadBlocks(blocks, rows, ids) as Prisma.InputJsonValue },
  });

  const failed = rows.filter((r) => unread.includes(r.id) && r.status !== AttachmentStatus.READY).length;
  if (announce) {
    await publish(jobId, {
      type: "tool_res",
      toolCallId: stepId,
      output: { read: unread.length - failed, failed },
    });
  }
  log.info("attachments.read", {
    jobId,
    projectId,
    files: unread.length,
    failed,
    again: again.length,
    exact: opts.exact,
    ms: Date.now() - started,
  });
}

/**
 * Read whatever this request's files still need, before its first model turn.
 * Call it ahead of `loadHistory`, which then sees the finished message.
 */
export async function readAttachmentsForRun(owner: CallOwner, effort: Effort): Promise<void> {
  const { jobId, projectId } = owner;
  try {
    const where = { projectId, role: MessageRole.USER, type: MessageType.USER };
    const messages = await prisma.message.findMany({
      where: { ...where, attachments: { some: {} } },
      orderBy: { sequence: "desc" },
      take: RECENT_MESSAGES,
      select: { id: true, content: true, attachments: { select: ATTACHMENT_FIELDS } },
    });
    if (messages.length === 0) return;

    const latest = await prisma.message.findFirst({
      where,
      orderBy: { sequence: "desc" },
      select: { id: true },
    });
    for (const message of messages.reverse()) {
      if (bus.isCancelled(jobId)) return;
      await readMessage(owner, message, {
        current: message.id === latest?.id,
        exact: effort !== "LOW",
      });
    }
  } catch (err) {
    log.warn("attachments.read_failed", { jobId, projectId, error: String(err).slice(0, 300) });
  }
}
