import type Sandbox from "e2b";
import { prisma } from "@/lib/prisma";
import { getObjectBytes } from "@/lib/s3";
import { log } from "@/worker/lib/log";
import { publish } from "@/worker/lib/publish";
import { markProjectWorkspaceStarted } from "@/worker/lib/projectWorkspace";
import { parseImageMeta } from "./image-dimensions";
import { asString, isBinaryPath, persistBinaryFile, publicPath, toWorkdirPath } from "./utils";

/** How much of a picture is read to find its width and height. */
const HEADER_BYTES = 256 * 1024;

/** How many attachments an answer to a wrong id lists. */
const LISTED = 10;

/** The extension a stored attachment is saved under: what it is, not what it was called. */
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

/**
 * The extension an attachment is placed under, or null when it cannot be
 * placed. Only what the project stores as bytes can be (`isBinaryPath`): a
 * `.docx` or a spreadsheet would go through the text pipeline and come back
 * corrupt, and a text file's contents are already in the conversation.
 */
export function attachmentExtension(filename: string, mimeType: string): string | null {
  const known = EXTENSION_BY_MIME[mimeType.toLowerCase()];
  if (known) return known;
  const named = /\.([a-z0-9]{1,5})$/i.exec(filename)?.[1]?.toLowerCase();
  return named && isBinaryPath(`file.${named}`) ? named : null;
}

/** What to say when the id is not one of this project's attachments. */
async function unknownAttachment(userId: string, projectId: string): Promise<string> {
  const sent = await prisma.attachment.findMany({
    where: { userId, message: { projectId }, blobKey: { not: null } },
    orderBy: { createdAt: "desc" },
    take: LISTED,
    select: { id: true, filename: true, mimeType: true },
  });
  const usable = sent.filter((a) => attachmentExtension(a.filename, a.mimeType));
  if (usable.length === 0) {
    return "No attachment with that id, and the user has sent no picture or PDF in this project. Ask them to attach it.";
  }
  const list = usable.map((a) => `${a.id} (${a.filename})`).join(", ");
  return `No attachment with that id in this project. Use the \`id\` of the \`<attachment>\` block. Sent so far, newest first: ${list}.`;
}

/**
 * `use_attachment`: save a picture or PDF the user attached into the project.
 *
 * An attachment reaches the agent as a description (`attachmentBlock` in
 * api/lib/attachments.ts), which is enough to act on a screenshot of an error
 * and useless for "put my photo on the page": without this the agent could
 * only search for a stand-in. The bytes are saved the way `download_asset`
 * saves them, so the file survives the sandbox and goes with the project.
 *
 * The id comes from the model, so the row is looked up by owner and project
 * together: an id from another account or another project finds nothing.
 */
export async function useAttachment(
  input: unknown,
  sandbox: Sandbox,
  jobId: string,
  projectId: string,
  userId: string,
  indexer: () => number,
) {
  const { attachment_id, path } = (input ?? {}) as { attachment_id?: unknown; path?: unknown };
  const id = asString(attachment_id, "attachment_id").trim();
  const requested = asString(path, "path");

  const row = await prisma.attachment.findFirst({
    where: { id, userId, message: { projectId } },
    select: { filename: true, mimeType: true, blobKey: true },
  });
  if (!row) return { error: await unknownAttachment(userId, projectId) };

  const extension = row.blobKey ? attachmentExtension(row.filename, row.mimeType) : null;
  if (!row.blobKey || !extension) {
    return {
      error: `"${row.filename}" cannot be placed in the app: only a picture or a PDF can. What it says is already in the attachment's text, so write that into the app instead.`,
    };
  }

  let bytes: Uint8Array;
  try {
    bytes = await getObjectBytes(row.blobKey);
    if (bytes.byteLength === 0) throw new Error("the stored file is empty");
  } catch (err) {
    log.warn("attachment.use_failed", { jobId, projectId, error: String(err).slice(0, 300) });
    return { error: `The file for "${row.filename}" could not be read. Ask the user to attach it again.` };
  }

  const dest = publicPath(requested, extension);
  await markProjectWorkspaceStarted(projectId);
  await publish(jobId, { type: "file_start", path: dest });
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  await sandbox.files.write(toWorkdirPath(dest), body);
  const { persisted } = await persistBinaryFile(jobId, projectId, userId, dest, bytes, indexer);

  const size = parseImageMeta(Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, HEADER_BYTES)));
  log.info("attachment.used", { jobId, projectId, path: dest, bytes: bytes.byteLength });
  return {
    success: true,
    path: `/${dest.replace(/^public\//, "")}`,
    file: dest,
    name: row.filename,
    bytes: bytes.byteLength,
    ...(size ? { width: size.width, height: size.height } : {}),
    ...(persisted ? {} : { persisted, warning: "The file could not be saved with the project." }),
  };
}
