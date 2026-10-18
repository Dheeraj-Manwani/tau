import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import CodeMirror, { EditorView, keymap } from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { css as cssLang } from "@codemirror/lang-css";
import { json as jsonLang } from "@codemirror/lang-json";
import { html as htmlLang } from "@codemirror/lang-html";
import { getIcon } from "material-file-icons";
import {
  FolderTreeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  LoaderCircleIcon,
  XIcon,
  EllipsisVerticalIcon,
  FilePlusIcon,
  FolderPlusIcon,
  FolderUpIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  ChevronsDownUpIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/src/components/ui/dropdown-menu";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/src/components/ui/context-menu";

import { cn } from "@/src/lib/utils";
import { TabIndicator } from "@/src/components/motion/TabIndicator";
import { Alert } from "@/src/components/ui/alert";
import { Skeleton } from "@/src/components/ui/skeleton";
import { File, Folder, Tree } from "@/src/components/ui/file-tree";
import {
  isFileDirty,
  useProjectStore,
  type ProjectFile as ProjectFileState,
} from "@/src/stores/useProjectStore";
import { downloadProjectZip, useProjectFile } from "@/src/features/project/api";
import { useFileSave } from "@/src/features/project/useFileSave";
import { ResizeHandle } from "@/src/features/project/ResizeHandle";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { tauCodeTheme } from "@/src/features/project/codeTheme";
import { Button } from "@/src/components/ui/button";
import { SearchInput } from "@/src/components/ui/input";
import { Kbd } from "@/src/components/ui/kbd";

/** Material (VS Code) file icon for a filename, sized to fit inline. */
function MaterialIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const icon = getIcon(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: icon.svg }}
    />
  );
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function extOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
}

// Binary asset extensions: mirrors the server's isBinaryPath. These are served
// as a presigned URL (not text) and rendered as a preview, never in CodeMirror.
// SVG is intentionally absent: it's XML text and stays editable in the editor.
const BINARY_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "tiff", "tif",
  "woff", "woff2", "ttf", "otf", "eot", "mp3", "wav", "ogg", "mp4", "webm",
  "mov", "pdf",
]);
const IMAGE_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico",
]);

function isBinaryPath(path: string): boolean {
  return BINARY_EXTS.has(extOf(path));
}

/**
 * CodeMirror language extensions for the file types the agent emits.
 *
 * Note these are *syntax* modes only: there is deliberately no TypeScript
 * language service here. Type definitions live in the sandbox's node_modules,
 * which is excluded from the file manifest (`seedTemplateFiles`), so semantic
 * analysis in the browser would flag every third-party import as unresolved.
 * See doc/USER_CODE_EDITING.md §3.
 */
function languageFor(name: string) {
  if (name.endsWith(".tsx")) return [javascript({ typescript: true, jsx: true })];
  if (name.endsWith(".ts")) return [javascript({ typescript: true })];
  if (name.endsWith(".jsx")) return [javascript({ jsx: true })];
  if (name.endsWith(".js") || name.endsWith(".mjs")) return [javascript()];
  if (name.endsWith(".json")) return [jsonLang()];
  if (name.endsWith(".css")) return [cssLang()];
  if (name.endsWith(".html") || name.endsWith(".svg")) return [htmlLang()];
  return [];
}

// ── Dynamic file tree ───────────────────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
}

/** Turn a flat list of file paths into a nested folder/file tree. */
function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isFile: false, children: [] };

  for (const fullPath of paths) {
    const parts = fullPath.split("/").filter(Boolean);
    let node = root;
    let acc = "";
    parts.forEach((segment, i) => {
      acc = acc ? `${acc}/${segment}` : segment;
      const isFile = i === parts.length - 1;
      let child = node.children.find(
        (c) => c.name === segment && c.isFile === isFile,
      );
      if (!child) {
        child = { name: segment, path: acc, isFile, children: [] };
        node.children.push(child);
      }
      node = child;
    });
  }

  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) =>
      a.isFile !== b.isFile
        ? a.isFile
          ? 1
          : -1
        : a.name.localeCompare(b.name),
    );
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root.children;
}

function folderPaths(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) =>
    n.isFile ? [] : [n.path, ...folderPaths(n.children)],
  );
}

function renderNodes(
  nodes: TreeNode[],
  activeFileId: string,
  writingPath: string | null,
  dirtyPaths: ReadonlySet<string>,
  openFile: (id: string) => void,
): React.ReactNode {
  return nodes.map((node) =>
    node.isFile ? (
      <File
        key={node.path}
        value={node.path}
        handleSelect={openFile}
        isSelect={activeFileId === node.path}
        fileIcon={<MaterialIcon name={node.name} className="size-4 opacity-75 saturate-50" />}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate">{node.name}</span>
          {writingPath === node.path ? (
            <LoaderCircleIcon
              aria-label="tau is writing this file"
              className="ml-auto size-3 shrink-0 animate-spin text-blue-500 motion-reduce:animate-none"
            />
          ) : (
            dirtyPaths.has(node.path) && (
              <span
                aria-label="Unsaved changes"
                title="Unsaved changes"
                className="ml-auto size-1.5 shrink-0 rounded-full bg-blue-500"
              />
            )
          )}
        </span>
      </File>
    ) : (
      <Folder key={node.path} value={node.path} element={node.name}>
        {renderNodes(node.children, activeFileId, writingPath, dirtyPaths, openFile)}
      </Folder>
    ),
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────

function TabBar({ onShowFiles }: { onShowFiles?: () => void }) {
  const files = useProjectStore((s) => s.files);
  const openFiles = useProjectStore((s) => s.openFiles);
  const activeFileId = useProjectStore((s) => s.activeFileId);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const closeFile = useProjectStore((s) => s.closeFile);
  const closeOtherFiles = useProjectStore((s) => s.closeOtherFiles);
  const closeFilesToRight = useProjectStore((s) => s.closeFilesToRight);
  const closeAllFiles = useProjectStore((s) => s.closeAllFiles);
  const writingPath = useProjectStore((s) => s.writingPath);

  const stripRef = useRef<HTMLDivElement>(null);
  const tabIndicatorId = useId();
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // Track whether the tab strip overflows in either direction so the nav arrows
  // can show/hide. Re-evaluates on scroll, on tab changes, and on resize.
  const refresh = () => {
    const el = stripRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    refresh();
    const ro = new ResizeObserver(refresh);
    ro.observe(el);
    return () => ro.disconnect();
  }, [openFiles]);

  const scrollByTabs = (dir: -1 | 1) =>
    stripRef.current?.scrollBy({ left: dir * 160, behavior: "smooth" });

  const arrowClass =
    "flex w-7 shrink-0 cursor-pointer items-center justify-center text-silver-600 transition-colors duration-150 hover:text-silver-900";

  return (
    <div className="flex h-10 shrink-0 items-stretch border-b border-line bg-space-void">
      {onShowFiles && (
        <div className="flex shrink-0 items-center border-r border-line px-1.5">
          <Button variant="ghost" size="sm" onClick={onShowFiles}>
            <FolderTreeIcon />
            Files
          </Button>
        </div>
      )}
      {canLeft && (
        <button
          type="button"
          aria-label="Scroll tabs left"
          onClick={() => scrollByTabs(-1)}
          className={arrowClass}
        >
          <ChevronLeftIcon className="size-4" />
        </button>
      )}

      <div
        ref={stripRef}
        onScroll={refresh}
        // Translate vertical wheel into horizontal scroll so many tabs are reachable.
        onWheel={(e) => {
          if (stripRef.current && e.deltaY !== 0) {
            stripRef.current.scrollLeft += e.deltaY;
          }
        }}
        role="tablist"
        aria-label="Open files"
        className="scrollbar-none flex min-w-0 flex-1 items-stretch overflow-x-auto px-1"
      >
        {openFiles.map((id, index) => {
          if (!files[id]) return null;
          const name = basename(id);
          const isActive = id === activeFileId;
          const isLast = index === openFiles.length - 1;
          return (
            <ContextMenu key={id}>
              <ContextMenuTrigger asChild>
                <div
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveFile(id)}
                  className={cn(
                    "group/tab relative flex shrink-0 cursor-pointer items-center gap-2 px-3 font-mono text-xs transition-colors duration-150",
                    isActive ? "text-silver-900" : "text-silver-600 hover:text-silver-900",
                  )}
                >
                  {isActive && (
                    <TabIndicator id={tabIndicatorId} className="inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-500" />
                  )}
                  <MaterialIcon name={name} className="size-3.5 opacity-75 saturate-50" />
                  <span className="whitespace-nowrap">{name}</span>
                  {writingPath === id ? (
                    <LoaderCircleIcon
                      aria-label="tau is writing this file"
                      className="size-3 shrink-0 animate-spin text-blue-500 motion-reduce:animate-none"
                    />
                  ) : (
                    isFileDirty(files[id]) && (
                      <span
                        aria-label="Unsaved changes"
                        title="Unsaved changes"
                        className="size-1.5 shrink-0 rounded-full bg-blue-500 group-hover/tab:hidden"
                      />
                    )
                  )}
                  <button
                    type="button"
                    aria-label={`Close ${name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFile(id);
                    }}
                    className={cn(
                      "flex size-5 cursor-pointer items-center justify-center rounded-[5px] text-silver-500 opacity-0 transition-[opacity,background-color,color] group-hover/tab:opacity-100 hover:bg-space-raised hover:text-silver-900 focus-visible:opacity-100",
                      isFileDirty(files[id]) && "group-hover/tab:opacity-100",
                    )}
                  >
                    <XIcon className="size-3" />
                  </button>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => closeFile(id)}>
                  <XIcon />
                  Close
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={openFiles.length <= 1}
                  onSelect={() => closeOtherFiles(id)}
                >
                  <XIcon />
                  Close other tabs
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={isLast}
                  onSelect={() => closeFilesToRight(id)}
                >
                  <ChevronsRightIcon />
                  Close tabs to the right
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => closeAllFiles()}
                >
                  <XIcon />
                  Close all tabs
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>

      {canRight && (
        <button
          type="button"
          aria-label="Scroll tabs right"
          onClick={() => scrollByTabs(1)}
          className={arrowClass}
        >
          <ChevronRightIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Status line under the editor: why you can't type, or what the save is doing. */
function EditorStatus({
  file,
  isBuilding,
}: {
  file: ProjectFileState;
  isBuilding: boolean;
}) {
  if (isBuilding) return <span>Read only while tau is building</span>;
  if (file.saveError) {
    return <span role="alert" className="text-red-400">{file.saveError}</span>;
  }
  if (file.saving) return <span>Saving…</span>;
  if (isFileDirty(file)) return <span className="text-silver-900">Unsaved changes</span>;
  return <span>Saved</span>;
}

function CodeEditor({ onShowFiles }: { onShowFiles?: () => void }) {
  const files = useProjectStore((s) => s.files);
  const activeFileId = useProjectStore((s) => s.activeFileId);
  const projectId = useProjectStore((s) => s.projectId);
  const setFileContent = useProjectStore((s) => s.setFileContent);
  const setFileDraft = useProjectStore((s) => s.setFileDraft);
  // The agent writes these same files. Rather than race it, edits are blocked
  // while a job is live: the api refuses them anyway (409).
  const isBuilding = useProjectStore((s) => s.status === "streaming");
  const file = activeFileId ? files[activeFileId] : undefined;

  const { flush, scheduleSave } = useFileSave(projectId ?? undefined);

  // Binary assets always need a fetch (for their presigned preview URL): their
  // in-store `content` is an empty placeholder from the file_start event, so the
  // usual `content === undefined` check would wrongly skip the load.
  const needsLoad =
    file !== undefined &&
    (file.content === undefined || isBinaryPath(activeFileId));
  const {
    data: fetched,
    isLoading,
    isError,
  } = useProjectFile(projectId ?? undefined, activeFileId, {
    enabled: needsLoad,
  });

  useEffect(() => {
    // Only text files carry `content`; binary assets return a preview URL and
    // must not be pushed into the (text) file buffer.
    if (fetched !== undefined && !fetched.binary && activeFileId) {
      setFileContent(activeFileId, fetched.content, fetched.contentHash);
    }
  }, [fetched, activeFileId, setFileContent]);

  // Flush a pending autosave when switching away from a dirty file, so edits
  // can't sit unsaved behind a tab the user has moved on from.
  const previousFileId = useRef(activeFileId);
  useEffect(() => {
    const previous = previousFileId.current;
    if (previous && previous !== activeFileId) flush(previous);
    previousFileId.current = activeFileId;
  }, [activeFileId, flush]);

  const handleChange = useCallback(
    (value: string) => {
      if (!activeFileId || isBuilding) return;
      setFileDraft(activeFileId, value);
      scheduleSave(activeFileId);
    },
    [activeFileId, isBuilding, setFileDraft, scheduleSave],
  );

  // Cmd/Ctrl+S saves now. Registered as a CodeMirror keybinding so it only
  // applies with focus in the editor and the browser's own save dialog is
  // suppressed.
  const saveKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            if (activeFileId) flush(activeFileId);
            return true;
          },
        },
      ]),
    [activeFileId, flush],
  );

  const extensions = useMemo(
    () => [
      ...languageFor(activeFileId ? basename(activeFileId) : ""),
      saveKeymap,
      EditorView.lineWrapping,
    ],
    [activeFileId, saveKeymap],
  );

  if (!file) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-space-void p-6 text-center">
        <span className="grid size-11 place-items-center rounded-lg border border-line-strong bg-space-surface">
          <span aria-hidden className="logo-mark size-5 [filter:none]" />
        </span>
        <span className="text-[13px] text-silver-500">
          Pick a file on the left to read or edit it.
        </span>
      </div>
    );
  }

  // Binary assets (downloaded images, fonts, media) can't be shown in the text
  // editor: render a preview from the presigned URL the api hands back instead.
  if (isBinaryPath(activeFileId)) {
    return (
      <div className="flex h-full flex-col bg-space-void">
        <TabBar onShowFiles={onShowFiles} />
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
          {isLoading ? (
            <Skeleton className="size-40 rounded-lg" />
          ) : isError || !fetched || !fetched.binary ? (
            <span className="text-[13px] text-silver-500">
              Couldn&rsquo;t load this file.
            </span>
          ) : IMAGE_EXTS.has(extOf(activeFileId)) ? (
            <img
              src={fetched.url}
              alt={basename(activeFileId)}
              className="max-h-full max-w-full rounded-lg border border-line object-contain"
              // Checkerboard so transparent PNGs read as transparent, not black.
              style={{
                backgroundImage:
                  "linear-gradient(45deg,#1c1c20 25%,transparent 25%),linear-gradient(-45deg,#1c1c20 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1c1c20 75%),linear-gradient(-45deg,transparent 75%,#1c1c20 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 font-mono text-xs text-silver-600">
              <MaterialIcon
                name={basename(activeFileId)}
                className="size-10"
              />
              <span>{basename(activeFileId)}</span>
              <Button variant="secondary" size="sm" asChild>
                <a href={fetched.url} target="_blank" rel="noreferrer">
                  Open file
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // The draft is the source of truth while the user is typing; fall back to the
  // saved body, then to whatever the fetch just returned (text files only).
  const fetchedText = fetched && !fetched.binary ? fetched.content : undefined;
  const value = file.draft ?? file.content ?? fetchedText ?? "";

  return (
    <div className="flex h-full flex-col bg-space-void">
      <TabBar onShowFiles={onShowFiles} />
      {needsLoad && isLoading ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-4 pl-12" aria-label="Loading file" role="status">
          {[72, 54, 88, 40, 66, 58].map((w, i) => (
            <Skeleton key={i} className="h-3 rounded-xs" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : needsLoad && isError ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-[13px] text-silver-500">
          Couldn&rsquo;t load this file.
        </div>
      ) : (
        <>
          {isBuilding && (
            <Alert tone="info" icon={LoaderCircleIcon} className="m-2 mb-0 py-2.5 [&>svg]:animate-spin motion-reduce:[&>svg]:animate-none">
              tau is writing your files. Editing is paused until it finishes.
            </Alert>
          )}
          <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
            <CodeMirror
              // Remount on file switch so undo history doesn't leak across files.
              key={activeFileId}
              value={value}
              theme={tauCodeTheme}
              extensions={extensions}
              editable={!isBuilding}
              onChange={handleChange}
              onBlur={() => activeFileId && flush(activeFileId)}
              basicSetup={{ foldGutter: false, highlightActiveLine: !isBuilding }}
              style={{ fontSize: "13px", fontFamily: "var(--mono)" }}
              height="100%"
              className="h-full [&_.cm-editor]:h-full [&_.cm-editor.cm-focused]:outline-none"
            />
          </div>
          <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-t border-line bg-space-void px-3 font-mono text-[11px] text-silver-500">
            <span className="flex min-w-0 items-center gap-2 truncate">
              <span className="truncate">{file.path}</span>
              <span aria-hidden>·</span>
              <EditorStatus file={file} isBuilding={isBuilding} />
            </span>
            {!isBuilding && isFileDirty(file) && !file.saving && (
              <Button size="sm" onClick={() => flush(file.path)}>
                Save
                <Kbd className="border-blue-900/30 bg-transparent text-blue-900">⌘S</Kbd>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function CodePane() {
  const files = useProjectStore((s) => s.files);
  const codeTreeWidth = useProjectStore((s) => s.codeTreeWidth);
  const setCodeTreeWidth = useProjectStore((s) => s.setCodeTreeWidth);
  const activeFileId = useProjectStore((s) => s.activeFileId);
  const writingPath = useProjectStore((s) => s.writingPath);
  const openFile = useProjectStore((s) => s.openFile);
  const closeAllFiles = useProjectStore((s) => s.closeAllFiles);
  const projectId = useProjectStore((s) => s.projectId);
  const isBuilding = useProjectStore((s) => s.status === "streaming");
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [collapseVersion, setCollapseVersion] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const downloadPending = useRef(false);
  // A phone has no room for both: show the tree or the open file, not a
  // 150px editor beside a 240px tree.
  const narrow = useMediaQuery("(max-width: 639px)");
  const [browsing, setBrowsing] = useState(false);
  const showTree = !narrow || !activeFileId || browsing;
  const showEditor = !narrow || (Boolean(activeFileId) && !browsing);
  const pickFile = (id: string) => {
    openFile(id);
    setBrowsing(false);
  };

  const download = async () => {
    if (!projectId || downloadPending.current) return;
    if (Object.values(useProjectStore.getState().files).some((file) => isFileDirty(file) || file.saving)) {
      toast.error("Wait for your changes to save before downloading.");
      return;
    }
    downloadPending.current = true;
    setDownloading(true);
    try {
      await downloadProjectZip(projectId);
    } catch {
      toast.error("Could not download the project ZIP. Please try again.");
    } finally {
      downloadPending.current = false;
      setDownloading(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);

  const paths = useMemo(() => Object.keys(files), [files]);
  const dirtyPaths = useMemo(
    () => new Set(paths.filter((path) => isFileDirty(files[path]!))),
    [paths, files],
  );
  const tree = useMemo(() => buildTree(paths.filter((path) =>
    (showHidden || !path.split("/").some((part) => part.startsWith("."))) &&
    path.toLowerCase().includes(search.trim().toLowerCase()),
  )), [paths, showHidden, search]);
  const expanded = useMemo(() => folderPaths(tree), [tree]);
  // Re-mount the Tree (re-applying expanded folders) only when the folder
  // structure changes: not on every file content chunk.
  const treeKey = `${projectId}:${collapseVersion}:${search}:${showHidden}:${expanded.join("|")}`;

  const handleDrag = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const left = el.getBoundingClientRect().left;
    const width = el.clientWidth;
    const next = Math.min(Math.max(clientX - left, 160), width - 300);
    setCodeTreeWidth(next);
  };

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      {showTree && (
        <div
          style={narrow ? undefined : { width: codeTreeWidth }}
          className={cn(
            "flex shrink-0 flex-col overflow-hidden bg-space-surface py-2 text-silver-900",
            narrow && "w-full",
          )}
        >
          <div className="mb-2 flex shrink-0 items-center gap-1 px-2">
            <SearchInput
              aria-label="Search files"
              placeholder="Search files"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="flex-1 [&_input]:h-8 [&_input]:text-xs"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="File options">
                  {downloading ? <LoaderCircleIcon className="animate-spin text-blue-500 motion-reduce:animate-none" /> : <EllipsisVerticalIcon />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem disabled title="File creation is not available yet"><FilePlusIcon />New file</DropdownMenuItem>
                <DropdownMenuItem disabled title="Folder creation is not available yet"><FolderPlusIcon />New folder</DropdownMenuItem>
                <DropdownMenuItem disabled title="Folder upload is not available yet"><FolderUpIcon />Upload folder</DropdownMenuItem>
                <DropdownMenuItem disabled={!projectId || paths.length === 0 || downloading || isBuilding} onSelect={() => void download()}>
                  <DownloadIcon />{downloading ? "Downloading…" : "Download as zip"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShowHidden((value) => !value)}>
                  {showHidden ? <EyeOffIcon /> : <EyeIcon />}{showHidden ? "Hide hidden files" : "Show hidden files"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { setSearch(""); setCollapseVersion((value) => value + 1); }}><ChevronsDownUpIcon />Collapse all</DropdownMenuItem>
                <DropdownMenuItem onSelect={closeAllFiles}><XIcon />Close files</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="min-h-0 flex-1">
          {paths.length === 0 ? (
            <div className="px-3 py-2 text-xs leading-normal text-silver-500">
              Files will appear here as tau builds your app.
            </div>
          ) : tree.length === 0 ? (
            <div className="px-3 py-2 text-xs text-silver-500">No file matches &ldquo;{search.trim()}&rdquo;.</div>
          ) : (
            <Tree
              key={treeKey}
              className="scrollbar-thin"
              initialSelectedId={activeFileId}
              initialExpandedItems={search.trim() ? expanded : []}
            >
              {renderNodes(tree, activeFileId, writingPath, dirtyPaths, pickFile)}
            </Tree>
          )}
          </div>
        </div>

      )}

      {!narrow && <ResizeHandle onDrag={handleDrag} />}

      {showEditor && (
        <div className="min-w-0 flex-1">
          <CodeEditor onShowFiles={narrow ? () => setBrowsing(true) : undefined} />
        </div>
      )}
    </div>
  );
}
