---
title: Attachments
description: Images, PDFs and pasted content in the composer: what tau does with them, the size limits, and what mobile omits.
section: build
order: 5
updated: 2026-10-12
---

You can attach files to any message. A screenshot of a layout is usually a faster
way to describe a design than a paragraph, and a spec you already have is better
than a spec you retype.

## What you can attach

- **Images**: screenshots, mockups, photos of a whiteboard.
- **Documents**: PDFs and text files.
- **Pasted content**: paste a table, a log, or a block of text straight into the
  composer and it becomes an attachment instead of a wall of prompt.

## Limits

| Limit | Value |
|---|---|
| Max file size | 10 MB |
| Max image size | 5 MB |
| Max attachments per message | 5 |

These are the defaults tau runs with. A file over the limit is rejected at upload
rather than silently truncated.

## What happens to them

1. The file uploads from your browser. The chip is ready as soon as it has, and
   you can send straight away.
2. When you send, tau reads each file before the agent starts: a PDF becomes
   text, an image is described. The chat shows this as a step, "Looked at your
   attached files".
3. What each file says is folded into the message the agent reads.

That last step matters for understanding cost and behaviour: the agent works from
**text**, which is part of your message. It is not re-reading the original file
on every turn. Reading a picture is a small model call and is charged to the
request it was sent with.

Because a file is read when you send it, what you typed guides the reading:
"fix this error" gets the text copied out, "build this" gets the layout.

> [!NOTE]
> A screenshot of code or an error is read character for character on **HIGH**
> and **MAX**. On **LOW** it is read quickly, which is reliable for file names
> and line numbers and can be a character out in the code itself.

## Putting your own picture in the app

An attached picture or PDF can also go into the app itself. Say where you want
it, for example "use the attached photo of me as the portrait at the top", and tau saves
that exact file into the project and builds the page around it. It works for a
photo, a logo, a product shot, or a PDF the page should link to, such as a CV.

Tau only does this when you ask for the file to appear. A screenshot sent to show
a layout or a bug is read, not placed. Other documents and pasted text are used
for what they say and are not added to the app as files.

## Using attachments well

**A screenshot for layout.** "Like this, but our colours" with a screenshot
attached is one sentence that replaces a design brief.

**A PDF for requirements.** If you already have a spec, attach it and write one
line about which part to build first. Do not paste the whole thing into the
prompt box.

**Sample data as a paste.** Paste ten representative rows. Tau will infer the
schema from real data more reliably than from your description of it.

**A screenshot of the bug.** Something rendering wrong is much easier to fix from
a picture than from a description of the picture.

**Your own photo or logo.** Attach it and say where it goes. Tau uses the file you
sent rather than finding a stand-in.

## On mobile

The mobile app supports camera, photo library, and file attachments.

It deliberately does **not** support paste-to-attach: that is a web-only
affordance. On mobile, paste goes into the prompt text like any other paste.

## Housekeeping

Attachments you upload but never send are swept periodically. An attachment on a
sent message stays with that message, for provenance and so the chat still makes
sense when you scroll back to it.

## Next

- [Writing prompts](/docs/build/writing-prompts)
- [Mobile parity](/docs/mobile/parity): everything the app leaves out, and why
- [Limits](/docs/billing/limits)
