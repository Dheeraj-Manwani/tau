import { useEffect, useState } from "react";
import { DownloadIcon, FileTextIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { getAttachmentContent, getAttachmentUrl } from "./api";
import { formatBytes, type AttachmentKind } from "./types";

export interface PreviewTarget {
  id: string | null;
  kind: AttachmentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Available immediately for a just-picked local file. */
  localUrl?: string;
  /** Available immediately for a just-pasted chip. */
  localText?: string;
}

interface AttachmentModalProps {
  target: PreviewTarget | null;
  onClose: () => void;
}

export function AttachmentModal({ target, onClose }: AttachmentModalProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      {target && (
        <DialogContent className="max-w-[min(56rem,calc(100vw-2rem))] sm:max-w-[min(56rem,calc(100vw-2rem))]">
          {target.kind === "IMAGE" && <ImageBody target={target} />}
          {target.kind === "PASTED" && <PastedBody target={target} />}
          {target.kind === "FILE" && <FileBody target={target} />}
        </DialogContent>
      )}
    </Dialog>
  );
}

/** Presigned GET, fetched lazily and only when there's no local URL. */
function useRemoteUrl(target: PreviewTarget): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (target.localUrl || !target.id) return;
    let cancelled = false;
    void getAttachmentUrl(target.id)
      .then((r) => {
        if (!cancelled) setUrl(r.url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [target.id, target.localUrl]);

  return target.localUrl ?? url;
}

function ImageBody({ target }: { target: PreviewTarget }) {
  const src = useRemoteUrl(target);

  return (
    <div className="flex flex-col items-center gap-3">
      <DialogTitle className="sr-only">{target.filename}</DialogTitle>
      {src ? (
        <img
          src={src}
          alt={target.filename}
          className="max-h-[75vh] w-auto max-w-full rounded-lg border border-line object-contain"
        />
      ) : (
        <div className="flex h-64 items-center justify-center">
          <Loader2Icon className="size-5 animate-spin text-blue-500 motion-reduce:animate-none" />
        </div>
      )}
      <p className="font-mono text-xs text-silver-500">{target.filename}</p>
    </div>
  );
}

function PastedBody({ target }: { target: PreviewTarget }) {
  const [text, setText] = useState<string | null>(target.localText ?? null);

  useEffect(() => {
    if (target.localText !== undefined || !target.id) return;
    let cancelled = false;
    void getAttachmentContent(target.id)
      .then((r) => {
        if (!cancelled) setText(r.text ?? "");
      })
      .catch(() => {
        if (!cancelled) setText("");
      });
    return () => {
      cancelled = true;
    };
  }, [target.id, target.localText]);

  const lineCount = text ? text.split("\n").length : null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <DialogTitle>Pasted content</DialogTitle>
        <p className="mt-2 font-mono text-xs text-silver-500">
          {formatBytes(target.sizeBytes)}
          {lineCount !== null && ` · ${lineCount} lines`} · Formatting may be
          inconsistent from source
        </p>
      </div>

      {text === null ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2Icon className="size-5 animate-spin text-blue-500 motion-reduce:animate-none" />
        </div>
      ) : (
        <div className="scrollbar-thin max-h-[65vh] overflow-auto rounded-md border border-line bg-space-void p-3.5">
          <pre className="font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-silver-600">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}

function FileBody({ target }: { target: PreviewTarget }) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!target.id) return;
    setDownloading(true);
    try {
      const { url } = await getAttachmentUrl(target.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <DialogTitle className="sr-only">{target.filename}</DialogTitle>
      <span className="grid size-11 place-items-center rounded-lg border border-line-strong bg-space-surface">
        <FileTextIcon className="size-5 text-silver-600" />
      </span>
      <div className="text-center">
        <p className="text-sm font-semibold text-silver-900">{target.filename}</p>
        <p className="mt-1 font-mono text-xs text-silver-500">
          {formatBytes(target.sizeBytes)} · {target.mimeType}
        </p>
      </div>
      <Button
        onClick={() => void download()}
        disabled={!target.id}
        loading={downloading}
      >
        {!downloading && <DownloadIcon />}
        Download
      </Button>
    </div>
  );
}
