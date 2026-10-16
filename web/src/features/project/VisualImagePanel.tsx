import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { DownloadIcon, ImageIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { fieldClass } from "@/src/components/ui/styles";
import { ApiError } from "@/src/lib/api-client";
import {
  useImportVisualAsset,
  useVisualEdit,
  type AssetImportRefusal,
} from "@/src/features/project/api";
import {
  computedValueFor,
  describeRefusedEdit,
} from "@/src/features/project/visualEditPrompt";
import {
  useProjectStore,
  type VisualSelection,
} from "@/src/stores/useProjectStore";

/** Extensions the picker treats as project images. Matches what the API's asset
 *  importer can write, plus `ico` and `bmp` which a scaffold may already have. */
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|svg|ico|bmp)$/i;

const IMPORT_COPY: Record<AssetImportRefusal, string> = {
  bad_url: "That doesn't look like a web address.",
  blocked_host: "That address can't be reached from here.",
  fetch_failed: "Couldn't download that image: check the link.",
  not_an_image: "That link isn't an image.",
  too_large: "That image is too large (10 MB max).",
  empty: "That link returned an empty file.",
};

/**
 * Swap the picture behind a selected `<img>`: plan §6 Phase 6.
 *
 * Two ways in, and they end at the same place:
 *
 *  - **Pick one already in the project.** Free, instant, and the common case
 *    once an app has any images at all.
 *  - **Paste a link.** The server fetches the bytes into `public/` first, then
 *    the element points at the local copy. Never at the remote URL: a borrowed
 *    image rots, can be pulled out from under the user, and doesn't come with
 *    them when they export to GitHub. Importing makes it genuinely theirs, and
 *    is what the agent's own `download_asset` tool does for the same reason.
 *
 * Either way the source rewrite is an ordinary `attr` visual edit, so it
 * inherits the tag guard, the stale-file guard and undo.
 */
export function VisualImagePanel({
  selection,
  onReselect,
}: {
  selection: VisualSelection;
  onReselect: (loc: string) => void;
}) {
  const projectId = useProjectStore((s) => s.projectId);
  const files = useProjectStore((s) => s.files);
  const setSelection = useProjectStore((s) => s.setVisualSelection);
  const pushUndo = useProjectStore((s) => s.pushVisualUndo);
  const prefillVisualPrompt = useProjectStore((s) => s.prefillVisualPrompt);

  const visualEdit = useVisualEdit(projectId ?? undefined);
  const importAsset = useImportVisualAsset(projectId ?? undefined);

  const [url, setUrl] = useState("");
  const busy = visualEdit.isPending || importAsset.isPending;

  // `public/hero.png` is served at `/hero.png`; anything else keeps its path.
  // Vite's rule, and the reason the two are listed together rather than the
  // file paths being shown raw.
  const projectImages = useMemo(
    () =>
      Object.keys(files)
        .filter((p) => IMAGE_EXT.test(p))
        .sort()
        .map((path) => ({
          path,
          src: path.startsWith("public/") ? `/${path.slice(7)}` : `/${path}`,
        })),
    [files],
  );

  /** Point the element at `src`, through the normal visual-edit path. */
  const applySrc = (src: string) => {
    if (busy) return;
    // The runtime reports the browser-resolved absolute URL, so it can't be the
    // undo value: but the previous *source* text is what we'd need and we don't
    // have it. Deriving it from the resolved URL is right whenever the image is
    // one of ours, which is every image this panel can set.
    const previous = toProjectSrc(selection.src);

    visualEdit.mutate(
      {
        loc: selection.loc,
        expectTag: selection.tagName,
        op: { kind: "attr", name: "src", value: src },
      },
      {
        onSuccess: (data) => {
          if (!data.applied) {
            if (data.reason === "dynamic_attribute") {
              const op = { kind: "attr", name: "src", value: src } as const;
              prefillVisualPrompt(describeRefusedEdit(op), computedValueFor(op));
              toast("tau can do this: the request is ready above.", {
                icon: "💬",
              });
            } else {
              toast.error("Couldn't use that image.");
            }
            return;
          }

          setSelection({ ...selection, src });
          setUrl("");
          if (previous && previous !== src) {
            pushUndo({
              loc: selection.loc,
              expectTag: selection.tagName,
              op: { kind: "attr", name: "src", value: previous },
              label: "image",
            });
          }
          onReselect(selection.loc);
        },
        onError: (err) => {
          const status = err instanceof ApiError ? err.status : 0;
          if (status === 409) {
            toast.error(
              err instanceof ApiError && err.message === "generation in progress"
                ? "Can't edit while tau is building."
                : "This element moved: select it again.",
            );
            setSelection(null);
          } else {
            toast.error("Couldn't use that image.");
          }
        },
      },
    );
  };

  const importAndApply = () => {
    const trimmed = url.trim();
    if (!trimmed || busy) return;
    importAsset.mutate(
      { url: trimmed },
      {
        onSuccess: (data) => {
          if (!data.imported) {
            toast.error(IMPORT_COPY[data.reason]);
            return;
          }
          applySrc(data.src);
        },
        onError: (err) => {
          const status = err instanceof ApiError ? err.status : 0;
          toast.error(
            status === 429
              ? "Too many image imports: try again shortly."
              : "Couldn't import that image.",
          );
        },
      },
    );
  };

  return (
    <div
      className={cn(
        "scrollbar-thin max-h-64 space-y-2.5 overflow-y-auto border-b border-line px-4 py-3",
        busy && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <input
          value={url}
          disabled={busy}
          placeholder="Paste an image link…"
          spellCheck={false}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              importAndApply();
            }
            e.stopPropagation();
          }}
          aria-label="Image URL"
          className={cn(fieldClass, "h-8 rounded-sm px-2.5 text-xs")}
        />
        <Button
          size="sm"
          className="h-8"
          disabled={busy || !url.trim()}
          loading={importAsset.isPending}
          onClick={importAndApply}
        >
          {!importAsset.isPending && <DownloadIcon />}
          Use
        </Button>
      </div>
      <p className="text-xs text-silver-500">
        The image is copied into your project, so it keeps working after the link
        goes away.
      </p>

      {projectImages.length > 0 && (
        <div>
          <p className="lab pb-2">
            Already in this project
          </p>
          <div className="flex flex-wrap gap-1.5">
            {projectImages.map(({ path, src }) => {
              const isCurrent = toProjectSrc(selection.src) === src;
              return (
                <button
                  key={path}
                  type="button"
                  disabled={busy}
                  onClick={() => applySrc(src)}
                  title={path}
                  aria-pressed={isCurrent}
                  className={cn(
                    "flex h-6 cursor-pointer items-center gap-1.5 rounded-xs border px-2 font-mono text-[11px] transition-colors duration-150 disabled:cursor-default",
                    isCurrent
                      ? "border-blue-500 bg-blue-500/12 text-silver-900"
                      : "border-line-strong bg-space-surface text-silver-600 hover:border-line-hover hover:text-silver-900",
                  )}
                >
                  <ImageIcon className="size-3 shrink-0" />
                  <span className="max-w-32 truncate">{src}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * `https://5173-abc.e2b.app/hero.png` → `/hero.png`.
 *
 * The runtime reports `el.src`, which the browser has resolved against the
 * preview origin. Undo and the "currently selected" check both need to compare
 * against what would be written into the source, so strip the origin back off.
 * A genuinely remote image has a different origin and is left alone.
 */
function toProjectSrc(resolved: string | undefined): string {
  if (!resolved) return "";
  try {
    const parsed = new URL(resolved);
    // Only our own preview origin collapses to a path; the check is that the
    // element is showing a file from the project rather than someone else's CDN.
    return parsed.origin === window.location.origin ||
      /^https?:\/\/\d+-/.test(resolved)
      ? `${parsed.pathname}${parsed.search}`
      : resolved;
  } catch {
    return resolved;
  }
}
