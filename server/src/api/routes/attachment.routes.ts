import { Router, raw } from "express";
import { env } from "@/lib/env";
import {
  signUpload,
  uploadBytes,
  completeUpload,
  createPaste,
  getAttachment,
  getAttachmentContent,
  getAttachmentUrl,
  deleteAttachment,
} from "../controllers/attachment.controller";
import { attachmentRateLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

// The limit counts files: one for each `/sign` and each paste. The two steps
// that follow a sign are bounded by the row instead — `/upload` takes only the
// bytes that were signed for, and `/complete` starts at most one read — so
// they are not counted again. When they were, a file cost three of the forty
// and the fourteenth in an hour was refused half-way (doc/ATTACHMENTS_PLAN.md).
router.post("/sign", attachmentRateLimiter, signUpload);
router.put("/:attachmentId/upload", raw({
  type: "application/octet-stream",
  limit: Math.max(env.ATTACHMENT_MAX_BYTES, env.ATTACHMENT_MAX_IMAGE_BYTES),
  inflate: false,
}), uploadBytes);
router.post("/paste", attachmentRateLimiter, createPaste);
router.post("/:attachmentId/complete", completeUpload);

router.get("/:attachmentId", getAttachment);
router.get("/:attachmentId/content", getAttachmentContent);
router.get("/:attachmentId/url", getAttachmentUrl);
router.delete("/:attachmentId", deleteAttachment);

export default router;
