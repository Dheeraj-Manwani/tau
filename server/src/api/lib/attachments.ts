import type OpenAI from "openai";
import { kimi } from "@/lib/kimi";
import { deepseek } from "@/lib/deepseek";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getObjectBytes } from "@/lib/s3";
import {
  isLocallyParsable,
  parseDocumentLocally,
  MIN_USEFUL_CHARS,
} from "./documentParsers";
import { AttachmentKind, AttachmentStatus } from "@/generated/prisma/enums";

/** Cap on what any single attachment may contribute to a prompt. */
export const MAX_ATTACHMENT_CHARS = 8_000;

/** Denormalised chip preview — keeps the transcript off the full body. */
export const PREVIEW_CHARS = 240;

const EXTRACT_MAX_TOKENS = 1_500;

const IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

/** Read directly as UTF-8 — no model call. */
const PLAIN_TEXT_MIME = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
  "application/x-yaml",
  "application/sql",
]);

/**
 * Extensions we treat as text no matter what the browser claims. Browsers are
 * bad at this: `.log` and `.env` come through as `application/octet-stream`,
 * and `.ts` is reported as `video/mp2t` (MPEG transport stream) — so a MIME-only
 * allowlist turns away exactly the files a coding tool most wants.
 */
const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "log", "csv", "tsv", "json", "jsonl", "xml", "yaml",
  "yml", "toml", "ini", "conf", "cfg", "env", "sql", "sh", "bash", "zsh",
  "ps1", "bat", "js", "jsx", "mjs", "cjs", "ts", "tsx", "py", "rb", "go",
  "rs", "java", "kt", "swift", "c", "h", "cpp", "hpp", "cc", "cs", "php",
  "css", "scss", "less", "html", "htm", "svg", "vue", "svelte", "graphql",
  "gql", "prisma", "lock", "diff", "patch",
  // Matched via textToken(): dotfiles and extensionless names.
  "dockerfile", "makefile", "gitignore", "dockerignore", "npmrc", "nvmrc",
  "editorconfig", "prettierrc", "eslintrc", "babelrc", "readme", "license",
]);

/** Formats Kimi's file-extract can read that we don't parse ourselves. */
const KIMI_DOCUMENT_EXTENSIONS = new Set([
  "xls", "xlsx", "ppt", "pptx", "doc", "epub", "rtf", "odt", "ods", "odp",
]);

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

/**
 * The token to match against {@link TEXT_EXTENSIONS}. Not the same thing as an
 * extension: `.env` and `.gitignore` are dotfiles whose *name* is the type, and
 * `Dockerfile` / `Makefile` have no dot at all. Matching on extension alone
 * turns all of those away.
 */
function textToken(filename: string): string {
  const base = filename.slice(filename.lastIndexOf("/") + 1);
  const ext = fileExtension(base);
  if (ext) return ext;
  return base.replace(/^\./, "").toLowerCase();
}

export function isImageMime(mime: string): boolean {
  return IMAGE_MIME.has(mime.toLowerCase());
}

/** MIME-only check — use {@link isTextLike} when a filename is available. */
export function isPlainTextMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return m.startsWith("text/") || PLAIN_TEXT_MIME.has(m);
}

/** Text by MIME *or* by filename, so a badly-typed `.log` still gets through. */
export function isTextLike(filename: string, mime: string): boolean {
  return isPlainTextMime(mime) || TEXT_EXTENSIONS.has(textToken(filename));
}

export function isAllowedUpload(filename: string, mime: string): boolean {
  const ext = fileExtension(filename);
  return (
    isImageMime(mime) ||
    isTextLike(filename, mime) ||
    isLocallyParsable(mime) ||
    ext === "pdf" ||
    ext === "docx" ||
    KIMI_DOCUMENT_EXTENSIONS.has(ext)
  );
}

export function kindForMime(mime: string): AttachmentKind {
  return isImageMime(mime) ? AttachmentKind.IMAGE : AttachmentKind.FILE;
}

export function maxBytesForMime(mime: string): number {
  return isImageMime(mime)
    ? env.ATTACHMENT_MAX_IMAGE_BYTES
    : env.ATTACHMENT_MAX_BYTES;
}

export function truncate(text: string, max = MAX_ATTACHMENT_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated, ${text.length - max} more characters]`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// The consumer is a coding agent building a web app, not a human reader —
// generic OCR output is close to useless here.
const IMAGE_SYSTEM_PROMPT = `You are converting an attachment into text for a coding agent that builds web apps. Describe everything a developer would need to reproduce or act on this image: layout and structure, component hierarchy, exact visible text (verbatim), colors, spacing, states, and any data shown. Transcribe all text exactly. If it is a screenshot of an error, a terminal, or code, transcribe it verbatim and do not summarize. If it is a photo or a non-UI image, describe the subject plainly. Output plain text or markdown. No preamble.`;

const DOCUMENT_SYSTEM_PROMPT = `You are converting a document into text for a coding agent that builds web apps. Extract the content faithfully and preserve its structure (headings, lists, tables). Transcribe text exactly rather than summarizing. Output plain text or markdown. No preamble.`;

/**
 * The typed message says what the attachment is for: "fix this error" wants
 * verbatim transcription, "build this" wants layout.
 *
 * Each file is read on its own, and the message is often about several ("like
 * the first picture, with the second as my portrait"). Given the bare request,
 * the reader answered it: it opened with a note that it could see only one
 * picture, and described a photo as "the portrait for the portfolio page". So
 * the request is fenced off as something written to someone else, about files
 * of which this is one. Of three wordings tried on real pictures (2026-10-13)
 * this is the one that stopped both remarks; change it only with the same test.
 */
function intentHint(userMessage?: string): string {
  const trimmed = userMessage?.trim();
  if (!trimmed) return "";
  // The request is the user's text inside our tags: it must not be able to close them.
  const request = truncate(trimmed, 500).replace(/<\/?(request|context)>/gi, "");
  return `\n\n<context>\nThe sender wrote the text in <request> to someone else, about one or more files. You are shown one of those files. Use the request only to decide which details of this file to describe most carefully. Never mention the request, any other file, or what this file is for or will be used as.\n<request>${request}</request>\n</context>`;
}

/**
 * What only the first reader is told. It answers two questions the reply would
 * otherwise leave open: whether the picture is one where single characters
 * matter, and whether it saw a picture at all. The second exists because a
 * model that cannot take images does not always say so with an error:
 * `deepseek-v4-pro` answers 200 and writes about a picture it never received
 * (measured 2026-10-12, doc/ATTACHMENTS_PLAN.md §0.4).
 */
const FIRST_READER_RULES = `\n\nBegin your reply with one line that is exactly \`KIND: code\` when the picture is mainly source code, a terminal, a stack trace or an error message, and exactly \`KIND: other\` for anything else. The description follows that line directly, with no remark about this instruction. If no image is visible to you in this message, reply with exactly NO_IMAGE and nothing else.`;

/**
 * Put above a description of code or an error that the fast reader wrote. It
 * reads a picture at about a thousand tokens whatever its size, which is
 * enough for a page and not for one bracket: in fifteen tries it never copied
 * a broken line as it stood, and several times wrote the corrected line
 * instead (§0.4). So the agent is told, and a run that wants the exact text
 * knows this description is not it ({@link wantsExactRead}).
 */
export const QUICK_CODE_NOTE =
  "[Read quickly: single characters in the code or error text below may differ from the picture. The line numbers and file names are reliable; for the exact text, read the file.]";

/** How long the fast reader gets with one picture before Kimi is tried. */
const FAST_READ_TIMEOUT_MS = 45_000;
/** Kimi's limit: a dense page takes it 40 seconds, and it may wait its turn first (lib/kimi.ts). */
const KIMI_READ_TIMEOUT_MS = 120_000;

/** One model call made to read an attachment, for whoever pays for it. */
export interface ReadUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ExtractionResult {
  text: string;
  model: string | null;
  tokens: number;
  /** Every model call this read made. Empty for a file read without a model. */
  usage: ReadUsage[];
}

/**
 * Whether a reader's reply is a description at all. False for nothing, for the
 * `NO_IMAGE` it was told to give when it sees no picture, and for a short
 * apology that it cannot view one. Only a short reply is tested for the
 * apology: a long one is a transcription, and a screenshot of a chat can
 * contain those very words.
 */
export function readableReply(text: string | null | undefined): boolean {
  const reply = text?.trim() ?? "";
  if (!reply) return false;
  if (/^NO_IMAGE\b/.test(reply)) return false;
  if (reply.length > 400) return true;
  return !/(unable|not able) to (view|see|access|open|process)\b[^.]{0,40}\b(image|picture|attachment)|can(?:not|'t|’t) (view|see|access|open|process)\b[^.]{0,40}\b(image|picture|attachment)|(image|picture) (is|was|seems) (not |un)supported|no (image|picture) (is |was )?(visible|attached|provided|included)/i.test(
    reply,
  );
}

/** A first reader's reply without its `KIND:` line, and what the line said. */
export function splitKind(reply: string): { kind: "code" | "other"; text: string } {
  const match = /^\s*KIND:\s*(code|other)\b[^\n]*\n?/i.exec(reply);
  if (!match) return { kind: "other", text: reply.trim() };
  return {
    kind: match[1]!.toLowerCase() === "code" ? "code" : "other",
    text: reply.slice(match[0].length).trim(),
  };
}

/** A description the fast reader wrote of a picture where characters matter. */
export function wantsExactRead(extractedText: string | null | undefined): boolean {
  return extractedText?.startsWith(QUICK_CODE_NOTE) ?? false;
}

/** `image/jpg` isn't a real MIME type and a data URI carrying it is rejected. */
function normalizeImageMime(mime: string): string {
  const m = mime.toLowerCase();
  return m === "image/jpg" ? "image/jpeg" : m;
}

/**
 * Kimi-specific request fields the OpenAI-typed params don't model.
 *
 * K2.6 thinks by default, and left on it spends the WHOLE `max_tokens` budget
 * on reasoning — `finish_reason: "length"` with empty content and
 * `reasoning_tokens: 1499/1500`. Extraction is transcription, not reasoning, so
 * the thinking pass buys nothing and costs the entire output.
 */
const NO_THINKING = { thinking: { type: "disabled" } };

type CompletionParams =
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
type UserContent = OpenAI.Chat.Completions.ChatCompletionUserMessageParam["content"];

/** One reading of a picture by one model. Throws when the reply is not a description. */
async function readWith(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userContent: UserContent,
  timeoutMs: number,
  maxRetries: number,
): Promise<{ reply: string; usage: ReadUsage }> {
  const completion = await client.chat.completions.create(
    {
      model,
      max_tokens: EXTRACT_MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      ...NO_THINKING,
    } as CompletionParams,
    { timeout: timeoutMs, maxRetries },
  );

  const choice = completion.choices[0];
  const reply = choice?.message.content?.trim() ?? "";
  if (!reply) {
    throw new Error(
      `Extraction returned no text (finish_reason: ${choice?.finish_reason ?? "unknown"})`,
    );
  }
  if (!readableReply(reply)) {
    throw new Error(`${model} did not see the image`);
  }
  return {
    reply,
    usage: {
      model,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}

const tokensOf = (usage: ReadUsage[]) =>
  usage.reduce((n, u) => n + u.inputTokens + u.outputTokens, 0);

function logRead(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}

/** Kimi's reading of a picture: the fallback, and the exact reader for code. */
async function readImageWithKimi(
  systemPrompt: string,
  userContent: UserContent,
  before: ReadUsage[] = [],
): Promise<ExtractionResult> {
  if (!kimi) throw new Error("Attachment extraction is not configured");
  const started = Date.now();
  // No retries of its own: the Kimi client waits out its rate limit itself (lib/kimi.ts).
  const { reply, usage } = await readWith(kimi, env.KIMI_EXTRACT_MODEL, systemPrompt, userContent, KIMI_READ_TIMEOUT_MS, 0);
  logRead("attachment.read", { reader: usage.model, ms: Date.now() - started });
  const all = [...before, usage];
  return { text: reply, model: usage.model, tokens: tokensOf(all), usage: all };
}

/**
 * Read a picture: the fast reader first, Kimi behind it.
 *
 *   - `deepseek-v4-flash` reads every picture, in a few seconds.
 *   - Kimi reads instead when flash cannot: an error, a timeout, no text, or
 *     a reply that says it saw no picture ({@link readableReply}).
 *   - Kimi also reads a picture of code or an error when the caller wants the
 *     exact text (`exact`: a HIGH or MAX run), because flash does not copy
 *     single characters reliably (§0.4 of doc/ATTACHMENTS_PLAN.md). Without
 *     `exact`, flash's reading is kept and marked with {@link QUICK_CODE_NOTE}.
 *
 * With no Kimi key there is no second reader: flash's reading stands, and a
 * picture flash cannot read fails with flash's own reason.
 *
 * @param codeKnown the fast reader has already called this picture code, so
 *                  only the exact reader is asked.
 */
async function extractImage(
  key: string,
  mimeType: string,
  userMessage: string | undefined,
  opts: { exact: boolean; codeKnown?: boolean },
): Promise<ExtractionResult> {
  // Kimi's vision models reject remote URLs outright ("unsupported image url")
  // — they take a base64 data URI or an ms://<file-id>. So we pull the bytes
  // back through this process rather than handing over a presigned link.
  // Base64 inflates ~33%, which ATTACHMENT_MAX_IMAGE_BYTES already bounds.
  const bytes = await getObjectBytes(key);
  const dataUri = `data:${normalizeImageMime(mimeType)};base64,${Buffer.from(bytes).toString("base64")}`;
  const system = IMAGE_SYSTEM_PROMPT + intentHint(userMessage);
  const picture: UserContent = [{ type: "image_url", image_url: { url: dataUri } }];

  if (opts.codeKnown) return readImageWithKimi(system, picture);

  const flash = env.DEEPSEEK_MODEL_FLASH;
  const started = Date.now();
  let first: { reply: string; usage: ReadUsage };
  try {
    // With Kimi behind it a failure goes straight there; alone, it gets one more try.
    first = await readWith(deepseek, flash, system + FIRST_READER_RULES, picture, FAST_READ_TIMEOUT_MS, kimi ? 0 : 1);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logRead("attachment.read_fallback", { from: flash, reason: reason.slice(0, 300), fallback: kimi !== null });
    if (!kimi) throw err;
    return readImageWithKimi(system, picture);
  }

  const { kind, text } = splitKind(first.reply);
  logRead("attachment.read", { reader: flash, ms: Date.now() - started, kind });
  const quick: ExtractionResult = {
    text: kind === "code" ? `${QUICK_CODE_NOTE}\n\n${text}` : text,
    model: flash,
    tokens: tokensOf([first.usage]),
    usage: [first.usage],
  };
  if (kind !== "code" || !opts.exact || !kimi) return quick;

  try {
    return await readImageWithKimi(system, picture, [first.usage]);
  } catch (err) {
    // The quick reading is still a reading; it says of itself what it is.
    logRead("attachment.read_fallback", {
      from: env.KIMI_EXTRACT_MODEL,
      reason: (err instanceof Error ? err.message : String(err)).slice(0, 300),
      fallback: true,
    });
    return quick;
  }
}

/**
 * Kimi's file-extract service: upload the raw file, read back its text.
 * Covers the formats we deliberately don't parse in-process (xlsx, pptx, legacy
 * .doc, epub) and rescues a scanned PDF that yielded no text locally.
 *
 * `purpose: "file-extract"` is Moonshot-specific and absent from the
 * OpenAI-typed union, hence the cast.
 */
async function extractViaKimiFiles(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
): Promise<ExtractionResult> {
  if (!kimi) throw new Error("Attachment extraction is not configured");

  // Kimi reports empty uploads as "File size is zero, please confirm and
  // re-upload" — which reads like a client problem and sent us the wrong way
  // once already. If the bytes are empty here, something upstream consumed
  // them (pdf.js detaches arrays it's handed), so say that instead.
  if (bytes.byteLength === 0) {
    throw new Error(
      `Refusing to upload 0 bytes for ${filename} — the buffer was consumed before reaching file-extract`,
    );
  }

  const uploaded = await kimi.files.create({
    file: new File([bytes as BlobPart], filename, { type: mimeType }),
    purpose: "file-extract" as OpenAI.FilePurpose,
  });

  try {
    const res = await kimi.files.content(uploaded.id);
    const raw = await res.text();

    // Moonshot returns JSON with the text under `content`; tolerate plain text
    // in case that ever changes.
    let text = raw;
    try {
      const parsed = JSON.parse(raw) as { content?: string };
      if (typeof parsed.content === "string") text = parsed.content;
    } catch {
      // not JSON — use the body as-is
    }

    text = text.trim();
    if (text.length < MIN_USEFUL_CHARS) {
      throw new Error("File extraction returned no usable text");
    }
    // Not a chat model — label it for what it is so cost debugging stays honest.
    return { text, model: "kimi-file-extract", tokens: 0, usage: [] };
  } finally {
    // Don't accumulate uploads on Moonshot's side; we already hold the bytes.
    await kimi.files.delete(uploaded.id).catch(() => undefined);
  }
}

/** Bytes that don't decode as text — a binary file mislabelled by extension. */
function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return text.includes("\0") ? null : text;
  } catch {
    return null;
  }
}

/**
 * Route one attachment to the cheapest thing that can actually read it:
 *
 *   image            → the fast reader, with Kimi behind it (`extractImage`)
 *   text-like        → decoded in-process, no model, no cost
 *   pdf / docx       → parsed in-process; falls through to Kimi if it yields
 *                      nothing usable (a scanned PDF has no text layer)
 *   everything else  → Kimi file-extract (xlsx, pptx, legacy .doc, epub)
 *
 * Only if Kimi is unavailable or also fails do we fall back to a stub, so the
 * agent is told plainly rather than handed silence.
 */
async function extractByType(
  blobKey: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
  userMessage: string | undefined,
  opts: { exact: boolean; codeKnown?: boolean },
): Promise<ExtractionResult> {
  if (isImageMime(mimeType)) {
    return extractImage(blobKey, mimeType, userMessage, opts);
  }

  const bytes = await getObjectBytes(blobKey);

  if (isTextLike(filename, mimeType)) {
    const text = decodeUtf8(bytes);
    // An extension can lie. If it isn't really text, treat it as a document.
    if (text !== null) return { text, model: null, tokens: 0, usage: [] };
  }

  if (isLocallyParsable(mimeType)) {
    const parsed = await parseDocumentLocally(bytes, mimeType);
    if (parsed?.usable) {
      return { text: parsed.text, model: "local", tokens: 0, usage: [] };
    }
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "attachment.localParse.empty",
        filename,
        mimeType,
        note: "falling back to Kimi file-extract",
      }),
    );
  }

  if (kimi) {
    try {
      return await extractViaKimiFiles(bytes, filename, mimeType);
    } catch (err) {
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          event: "attachment.kimiFileExtract.failed",
          filename,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  return {
    text: `[Attachment: ${filename} (${formatBytes(sizeBytes)}, ${mimeType}) — contents could not be read. The user can still download it.]`,
    model: null,
    tokens: 0,
    usage: [],
  };
}

/**
 * Read one attachment and store what it says.
 *
 * Never throws — failures are recorded as FAILED so the send path can degrade
 * to a stub instead of blocking the message.
 *
 * @param opts.exact the caller wants the exact text of a picture of code or an
 *                   error: a HIGH or MAX run. A picture that was read quickly
 *                   is then read again by Kimi, and the quick reading is kept
 *                   if that fails.
 * @returns the model calls made, for a caller that bills them. Empty when
 *          nothing was called: a file read locally, a reused reading, a failure.
 */
export async function runExtraction(
  attachmentId: string,
  userMessage?: string,
  opts: { exact?: boolean } = {},
): Promise<ReadUsage[]> {
  const row = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  });
  if (!row) return [];
  const exact = opts.exact === true && kimi !== null;

  if (row.status === AttachmentStatus.READY) {
    if (!exact || !row.blobKey || !wantsExactRead(row.extractedText)) return [];
    // Stays READY while it is read again: what it has is usable, and whoever
    // is watching the row should not see it go back to "being read".
    try {
      const result = await extractByType(
        row.blobKey,
        row.filename,
        row.mimeType,
        row.sizeBytes,
        userMessage,
        { exact: true, codeKnown: true },
      );
      await prisma.attachment.update({
        where: { id: attachmentId },
        data: {
          extractedText: truncate(result.text),
          preview: result.text.slice(0, PREVIEW_CHARS),
          extractionModel: result.model,
          extractionTokens: row.extractionTokens + result.tokens,
        },
      });
      return result.usage;
    } catch (err) {
      logRead("attachment.reread.failed", {
        attachmentId,
        error: (err instanceof Error ? err.message : String(err)).slice(0, 300),
      });
      return [];
    }
  }

  try {
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { status: AttachmentStatus.EXTRACTING, extractionError: null },
    });

    // Same bytes, same user, read by either reader — reuse rather than read
    // again. Not a quick reading of code when the exact one is wanted, and not
    // when this read comes with the user's words: a reading is shaped by the
    // request it was made for, and a few seconds buys one shaped by this one.
    if (row.contentHash && !userMessage?.trim()) {
      const cached = await prisma.attachment.findFirst({
        where: {
          userId: row.userId,
          contentHash: row.contentHash,
          status: AttachmentStatus.READY,
          extractionModel: { in: [env.DEEPSEEK_MODEL_FLASH, env.KIMI_EXTRACT_MODEL] },
          id: { not: attachmentId },
          extractedText: { not: null },
          ...(exact ? { NOT: { extractedText: { startsWith: QUICK_CODE_NOTE } } } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
      if (cached?.extractedText) {
        await prisma.attachment.update({
          where: { id: attachmentId },
          data: {
            status: AttachmentStatus.READY,
            extractedText: cached.extractedText,
            extractionModel: cached.extractionModel,
            extractionTokens: 0,
          },
        });
        return [];
      }
    }

    if (!row.blobKey) throw new Error("Attachment has no stored object");

    const result = await extractByType(
      row.blobKey,
      row.filename,
      row.mimeType,
      row.sizeBytes,
      userMessage,
      { exact },
    );

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        status: AttachmentStatus.READY,
        extractedText: truncate(result.text),
        preview: result.text.slice(0, PREVIEW_CHARS),
        extractionModel: result.model,
        extractionTokens: result.tokens,
        extractionError: null,
      },
    });
    return result.usage;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "attachment.extract.failed",
        attachmentId,
        error: message,
      }),
    );
    await prisma.attachment
      .update({
        where: { id: attachmentId },
        data: {
          status: AttachmentStatus.FAILED,
          extractionError: message.slice(0, 500),
        },
      })
      .catch(() => undefined);
    return [];
  }
}

export interface ResolvedAttachment {
  id: string;
  kind: AttachmentKind;
  filename: string;
  status: AttachmentStatus;
  extractedText: string | null;
  extractionError: string | null;
}

/**
 * The attachments a message is about to be sent with, in the caller's order.
 *
 * Checks only: found, owned, not already sent. It does not wait for a file to
 * be read. A file that is unread at send goes into the message as
 * {@link unreadAttachmentBlock} and is read when the run starts
 * (`worker/lib/readAttachments.ts`). The ownership check matters:
 * `attachmentIds` comes straight from the client.
 */
export async function claimableAttachments(
  userId: string,
  attachmentIds: string[],
): Promise<ResolvedAttachment[]> {
  const rows = await prisma.attachment.findMany({
    where: { id: { in: attachmentIds } },
    select: {
      id: true,
      kind: true,
      filename: true,
      status: true,
      extractedText: true,
      extractionError: true,
      userId: true,
      messageId: true,
      feedbackId: true,
    },
  });

  if (rows.length !== attachmentIds.length) {
    throw new Error("ATTACHMENT_NOT_FOUND");
  }
  if (rows.some((r) => r.userId !== userId)) {
    throw new Error("ATTACHMENT_FORBIDDEN");
  }
  // Stops one upload being replayed into many messages.
  if (rows.some((r) => r.messageId !== null || r.feedbackId != null)) {
    throw new Error("ATTACHMENT_ALREADY_USED");
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  return attachmentIds.map((id) => {
    const r = byId.get(id)!;
    return {
      id: r.id,
      kind: r.kind,
      filename: r.filename,
      status: r.status,
      extractedText: r.extractedText,
      extractionError: r.extractionError,
    };
  });
}

/** The wrapper marks the boundary between the user's own words and
 *  machine-generated description. */
export function attachmentBlock(a: ResolvedAttachment): string {
  const body =
    a.status === AttachmentStatus.READY && a.extractedText
      ? truncate(a.extractedText)
      : `(could not be read: ${a.extractionError ?? "extraction did not finish"})`;

  return wrapAttachment(a, body);
}

type AttachmentTag = Pick<ResolvedAttachment, "id" | "filename" | "kind">;

function wrapAttachment(a: AttachmentTag, body: string): string {
  const kind = a.kind.toLowerCase();
  return `<attachment id="${a.id}" name="${escapeAttr(a.filename)}" kind="${kind}">\n${body}\n</attachment>`;
}

/** What stands in an attachment's block until the run that owns it has read the file. */
export const UNREAD_BODY = "(not read yet)";

/**
 * The block for a file that is stored and not yet read. It holds the file's
 * place in the message, in the order it was sent, and keeps the first block of
 * a message with no words recognisable as tau's: the transcript shows block 0
 * as the user's own words unless it opens with a tag like this one. The run
 * replaces it with {@link attachmentBlock}.
 */
export function unreadAttachmentBlock(a: AttachmentTag): string {
  return wrapAttachment(a, UNREAD_BODY);
}

/** The id an attachment block is for, or null for any other text. */
export function attachmentBlockId(text: string): string | null {
  return /^<attachment id="([^"]+)"/.exec(text)?.[1] ?? null;
}

/** Whether this is a block still waiting for its file to be read. */
export function isUnreadBlock(text: string): boolean {
  return attachmentBlockId(text) !== null && text.endsWith(`>\n${UNREAD_BODY}\n</attachment>`);
}

// `>` matters as much as `<` here: the model reads these tags as text, so an
// unescaped `>` in a filename closes the tag early and the rest reads as body.
// Exported for `visualContext.ts`, which emits a sibling tag into the same
// content array and needs exactly this rule, not a second opinion on it.
export function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
