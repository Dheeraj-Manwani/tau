import { useRef, useState, type ReactNode } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowUpIcon, PaperclipIcon, SquareIcon } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";
import { AttachmentRail } from "@/src/features/composer/attachments/AttachmentRail";
import {
  classifyPaste,
  filesFromDrop,
} from "@/src/features/composer/attachments/paste";
import type { AttachmentDraft } from "@/src/features/composer/attachments/types";

interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  /**
   * Accessible name for the textarea. Worth setting wherever the surrounding
   * heading doesn't already name the field: an animated placeholder is not an
   * accessible name, and neither is a placeholder that is about to change.
   */
  ariaLabel?: string;
  /** Custom node rendered over the textarea (e.g. animated suggestions). */
  overlay?: ReactNode;
  /**
   * Text that Tab fills in when pressed as the first keystroke (empty
   * value). Defaults to `placeholder`; pass this separately when `overlay`
   * replaces the native placeholder attribute with custom-rendered text
   * (e.g. the rotating suggestions on Home), since that text isn't otherwise
   * readable back from the opaque overlay node.
   */
  placeholderText?: string;
  isSubmitting?: boolean;
  /** Hard-disable input and submit (e.g. at the free-plan project cap). */
  disabled?: boolean;
  minRows?: number;
  maxRows?: number;
  autoFocus?: boolean;
  /** Tighter padding, radius, text and controls: used in the chat panel. */
  compact?: boolean;
  /** When provided, replaces the send button with a red stop button. */
  onStop?: () => void;
  /** Extra control rendered in the bottom row, just left of the send/stop button. */
  rightSlot?: ReactNode;
  /** Text shown next to the send icon (e.g. "Build"). Icon-only when omitted. */
  submitLabel?: string;

  attachments?: AttachmentDraft[];
  onAttach?: (files: File[]) => void;
  onRemoveAttachment?: (key: string) => void;
  /** Called when a paste exceeds the length threshold: becomes a chip. */
  onPasteLarge?: (text: string) => void;
  /** Blocks submit while an attachment is uploading or extracting. */
  attachmentsBusy?: boolean;
}

export function PromptComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel,
  overlay,
  placeholderText = placeholder,
  isSubmitting = false,
  disabled = false,
  minRows = 1,
  maxRows = 4,
  autoFocus = false,
  compact = false,
  onStop,
  rightSlot,
  submitLabel,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  onPasteLarge,
  attachmentsBusy = false,
}: PromptComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Drag events fire per-child, so count depth or the state flickers off as the
  // pointer crosses onto the textarea.
  const dragDepth = useRef(0);

  const hasText = value.trim().length > 0;
  const attachmentsEnabled = Boolean(onAttach);
  // An attachment-only message is legitimate.
  const canSubmit =
    (hasText || attachments.length > 0) &&
    !isSubmitting &&
    !disabled &&
    !attachmentsBusy;

  const handleFiles = (files: File[]) => {
    if (!onAttach || disabled || files.length === 0) return;
    onAttach(files);
  };

  return (
    <div
      onDragEnter={
        attachmentsEnabled
          ? (e) => {
              e.preventDefault();
              dragDepth.current += 1;
              setIsDragging(true);
            }
          : undefined
      }
      onDragOver={attachmentsEnabled ? (e) => e.preventDefault() : undefined}
      onDragLeave={
        attachmentsEnabled
          ? () => {
              dragDepth.current -= 1;
              if (dragDepth.current <= 0) {
                dragDepth.current = 0;
                setIsDragging(false);
              }
            }
          : undefined
      }
      onDrop={
        attachmentsEnabled
          ? (e) => {
              e.preventDefault();
              dragDepth.current = 0;
              setIsDragging(false);
              handleFiles(filesFromDrop(e.dataTransfer));
            }
          : undefined
      }
      // One composer, one border (boards/Home.dc.html, Surfaces.dc.html):
      // neutral at rest, blue only on focus and on the action once there is
      // something to send.
      className={cn(
        "relative flex flex-col rounded-[14px] border bg-space-surface transition-[border-color,box-shadow] duration-150 focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgb(96_165_250/0.16)]",
        isDragging
          ? "border-dashed border-blue-500 shadow-[0_0_0_3px_rgb(96_165_250/0.16)]"
          : "border-line-strong",
        compact ? "gap-2.5 p-3" : "min-h-40 gap-[18px] px-4 pt-[18px] pb-3.5",
      )}
    >
      {onRemoveAttachment && (
        <AttachmentRail
          attachments={attachments}
          onRemove={onRemoveAttachment}
        />
      )}

      <div className="relative">
        <TextareaAutosize
          value={value}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Tab" &&
              value.length === 0 &&
              !disabled &&
              placeholderText
            ) {
              e.preventDefault();
              onChange(placeholderText);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSubmit) onSubmit();
            }
          }}
          onPaste={
            attachmentsEnabled
              ? (e) => {
                  const intent = classifyPaste(e.clipboardData);
                  if (intent.kind === "files") {
                    e.preventDefault();
                    handleFiles(intent.files);
                  } else if (intent.kind === "large-text" && onPasteLarge) {
                    e.preventDefault();
                    onPasteLarge(intent.text);
                  }
                }
              : undefined
          }
          placeholder={overlay ? undefined : placeholder}
          minRows={minRows}
          maxRows={maxRows}
          autoFocus={autoFocus}
          disabled={disabled}
          className={cn(
            "scrollbar-thin w-full resize-none bg-transparent px-1 text-left leading-[1.55] text-silver-900 placeholder:text-silver-500 focus:outline-none focus-visible:outline-none",
            compact ? "text-sm" : "text-base",
            disabled && "cursor-not-allowed opacity-60",
          )}
        />
        {overlay}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size={compact ? "icon-sm" : "icon"}
          aria-label="Attach files"
          disabled={disabled || !attachmentsEnabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <PaperclipIcon />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          // Extensions as well as MIME types: browsers report `.log` as
          // octet-stream and `.ts` as video/mp2t, so a MIME-only accept list
          // greys out exactly the files a coding tool most wants.
          accept="image/*,text/*,.pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.epub,.csv,.json,.md,.log,.txt,.yaml,.yml,.toml,.ini,.env,.sql,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.rb,.php,.cs,.c,.h,.cpp,.sh"
          onChange={(e) => {
            handleFiles(Array.from(e.target.files ?? []));
            // Reset so picking the same file twice still fires onChange.
            e.target.value = "";
          }}
        />

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {rightSlot}

          {onStop ? (
            <Button
              variant="secondary"
              size={compact ? "icon-sm" : "icon"}
              onClick={onStop}
              aria-label="Stop generating"
            >
              <SquareIcon className="size-3 fill-current" />
            </Button>
          ) : (
            // Send is a disabled secondary until there is something to send,
            // then the screen's one blue action.
            <Button
              variant={canSubmit || isSubmitting ? "primary" : "secondary"}
              size={submitLabel ? "default" : compact ? "icon-sm" : "icon"}
              onClick={onSubmit}
              disabled={!canSubmit}
              loading={isSubmitting || attachmentsBusy}
              aria-label={submitLabel ?? "Send prompt"}
            >
              {submitLabel}
              {!(isSubmitting || attachmentsBusy) && <ArrowUpIcon />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
