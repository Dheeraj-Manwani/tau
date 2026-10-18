import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownIcon,
  BellIcon,
  BookOpen,
  Box,
  BrainIcon,
  BugIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleIcon,
  CopyIcon,
  FileIcon,
  FilePen,
  FilePlus,
  FileX,
  FolderOpenIcon,
  GlobeIcon,
  GitPullRequestIcon,
  CircleDotIcon,
  DownloadIcon,
  EraserIcon,
  HammerIcon,
  HeartPulseIcon,
  HomeIcon,
  PaperclipIcon,
  ImagesIcon,
  InfoIcon,
  ListPlusIcon,
  Loader2Icon,
  RulerIcon,
  MessageCircleQuestionMark,
  MessageSquareIcon,
  MinusIcon,
  PanelLeftCloseIcon,
  PencilIcon,
  PlayIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SquareCheckBigIcon,
  SquareMousePointerIcon,
  TelescopeIcon,
  TerminalIcon,
  TimerIcon,
  Trash2Icon,
  XIcon,
  Summary,
} from "lucide-react";
import toast from "react-hot-toast";

import { cn } from "@/src/lib/utils";
import { ChatMarkdown } from "@/src/components/ChatMarkdown";
import { InkReveal } from "@/src/components/motion/InkReveal";
import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Skeleton } from "@/src/components/ui/skeleton";
import { ChatLoader } from "@/src/components/motion/ChatLoader";
import { TauMark } from "@/src/components/motion/TauMark";
import { chatLoaderView, type ChatLoaderView } from "@/src/features/project/chatLoaderState";
import { useSteadyLoaderView } from "@/src/features/project/useSteadyLoaderView";
import { PromptComposer } from "@/src/features/composer/PromptComposer";
import { ComposerSettings } from "@/src/features/composer/ComposerSettings";
import { useEffortChoice } from "@/src/features/composer/useEffortChoice";
import { useAttachments } from "@/src/features/composer/attachments/useAttachments";
import { MessageAttachmentRail } from "@/src/features/composer/attachments/AttachmentRail";
import { toMessageAttachments } from "@/src/features/composer/attachments/chipModel";
import {
  useProjectStore,
  type ActionItem,
  type DividerMeta,
  type Message,
  type MessageElement,
  type Todo,
} from "@/src/stores/useProjectStore";
import {
  fetchOlderMessages,
  submitJobAnswer,
  useProject,
  useSummarizeChat,
} from "@/src/features/project/api";
import { useSendMessage } from "@/src/features/project/useSendMessage";
import { useContextUsage } from "@/src/features/project/useContextUsage";
import { SecretRequestPrompt } from "@/src/features/project/SecretRequestPrompt";
import {
  CREDIT_RESUME_PROMPT,
  shouldOfferCreditResume,
} from "@/src/features/project/creditResume";
import { DeleteProjectDialog } from "@/src/features/project/DeleteProjectDialog";
import { EditProjectDialog } from "@/src/features/project/EditProjectDialog";
import { ClearChatDialog } from "@/src/features/project/ClearChatDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { CircularProgress } from "@/src/components/ui/circular-progress";
import { ApiError } from "@/src/lib/api-client";
import { APP_HOME } from "@/src/lib/routes";
import { useBalance } from "@/src/features/billing/api";
import { UserMenu } from "@/src/components/UserMenu";
import type { ReadyNotificationController } from "@/src/features/project/useReadyNotification";

function formatRelativeTime(ts: number): string {
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

const ENTRANCE = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 500, damping: 36 },
} as const;

function ActionIcon({ kind }: { kind: ActionItem["kind"] }) {
  if (kind === "create_plan") return <BrainIcon className="size-3.5" />;
  if (kind === "update_todo")
    return <SquareCheckBigIcon className="size-3.5" />;
  if (kind === "add_todos") return <ListPlusIcon className="size-3.5" />;
  if (kind === "run_command") return <TerminalIcon className="size-3.5" />;

  if (kind === "create_file") return <FilePlus className="size-3.5" />;

  if (kind === "edit_file") return <FilePen className="size-3.5" />;

  if (kind === "read_file") return <BookOpen className="size-3.5" />;
  if (kind === "list_dir") return <FolderOpenIcon className="size-3.5" />;
  if (kind === "delete_file") return <FileX className="size-3.5" />;
  if (kind === "tail_command_output")
    return <ScrollTextIcon className="size-3.5" />;
  if (kind === "wait_for_port") return <TimerIcon className="size-3.5" />;
  if (kind === "check_sandbox") return <HeartPulseIcon className="size-3.5" />;
  if (kind === "provision_sandbox") return <Box className="size-3.5" />;
  if (kind === "ask_user")
    return <MessageCircleQuestionMark className="size-3.5" />;
  if (kind === "dispatch_explorer")
    return <TelescopeIcon className="size-3.5" />;
  if (kind === "dispatch_debugger") return <BugIcon className="size-3.5" />;
  if (kind === "dispatch_verifier")
    return <ShieldCheckIcon className="size-3.5" />;
  if (kind === "dispatch_implementer")
    return <HammerIcon className="size-3.5" />;
  if (kind === "web_search") return <GlobeIcon className="size-3.5" />;
  if (kind === "search_images") return <ImagesIcon className="size-3.5" />;
  if (kind === "image_dimensions") return <RulerIcon className="size-3.5" />;
  if (kind === "download_asset") return <DownloadIcon className="size-3.5" />;
  if (kind === "read_attachments")
    return <PaperclipIcon className="size-3.5" />;
  if (kind === "push_to_github")
    return <GitPullRequestIcon className="size-3.5" />;
  if (kind === "create_github_issue")
    return <CircleDotIcon className="size-3.5" />;
  return <FileIcon className="size-3.5" />;
}

const TODO_STATUS_CFG = {
  done: { Icon: CheckIcon, label: "Done", cls: "text-green-400" },
  skipped: {
    Icon: MinusIcon,
    label: "Skipped",
    cls: "text-silver-500",
  },
  blocked: { Icon: XIcon, label: "Blocked", cls: "text-red-400" },
  pending: {
    Icon: CircleIcon,
    label: "Pending",
    cls: "text-silver-500 opacity-60",
  },
} as const;

function ActionDetail({ action }: { action: ActionItem }) {
  if (action.kind === "create_plan") {
    const meta = action.meta as
      | { description?: string; todos?: (string | Todo)[] }
      | undefined;
    return (
      <div className="space-y-2">
        {meta?.description && (
          <p className="leading-relaxed text-silver-600">
            {meta.description}
          </p>
        )}
        {!!meta?.todos?.length && (
          <div className="space-y-1 pt-1">
            <div>Next steps:</div>
            {meta.todos.map((todo, i) => {
              const item =
                typeof todo === "string"
                  ? { sno: i + 1, label: todo, status: "pending" }
                  : todo;
              const status = item.status as keyof typeof TODO_STATUS_CFG;
              const cfg = TODO_STATUS_CFG[status] ?? TODO_STATUS_CFG.pending;
              return (
                <div
                  key={item.sno}
                  className="flex items-center gap-2 text-silver-600"
                >
                  <cfg.Icon className={cn("size-3 shrink-0", cfg.cls)} />
                  <span
                    className={cn(
                      item.status === "done" ? "line-through opacity-50" : "",
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (action.kind === "add_todos") {
    const meta = action.meta as { todos?: string[] } | undefined;
    if (!meta?.todos?.length) return null;
    return (
      <div className="space-y-1">
        {meta.todos.map((todo, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-silver-600"
          >
            <CircleIcon className="mt-0.5 size-2.5 shrink-0 opacity-30" />
            <span>{todo}</span>
          </div>
        ))}
      </div>
    );
  }

  if (action.kind === "update_todo") {
    const meta = action.meta as
      | {
          sno?: number;
          status?: string;
          todos?: { sno: number; label: string; status: string }[];
        }
      | undefined;

    // Full plan snapshot available (live streaming path).
    if (meta?.todos?.length) {
      return (
        <div className="space-y-1.5">
          {meta.todos.map((todo) => {
            const s = todo.status as keyof typeof TODO_STATUS_CFG;
            const cfg = TODO_STATUS_CFG[s] ?? TODO_STATUS_CFG.pending;
            return (
              <div
                key={todo.sno}
                className="flex items-center gap-2 text-silver-600"
              >
                <cfg.Icon className={cn("size-3 shrink-0", cfg.cls)} />
                <span
                  className={cn(
                    todo.status === "done" ? "line-through opacity-50" : "",
                  )}
                >
                  {todo.label}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    // Reload path: only sno + status available.
    if (meta?.sno !== undefined) {
      const s = (meta.status ?? "pending") as keyof typeof TODO_STATUS_CFG;
      const cfg = TODO_STATUS_CFG[s] ?? TODO_STATUS_CFG.pending;
      return (
        <div className="flex items-center gap-2 text-silver-600">
          <cfg.Icon className={cn("size-3 shrink-0", cfg.cls)} />
          <span>
            Item #{meta.sno} marked as {meta.status}
          </span>
        </div>
      );
    }

    return null;
  }

  if (
    action.kind === "dispatch_explorer" ||
    action.kind === "dispatch_debugger" ||
    action.kind === "dispatch_verifier" ||
    action.kind === "dispatch_implementer" ||
    action.kind === "web_search" ||
    action.kind === "search_images" ||
    action.kind === "push_to_github" ||
    action.kind === "create_github_issue"
  ) {
    const meta = action.meta as
      | { prompt?: string; result?: string }
      | undefined;
    const taskLabel =
      action.kind === "web_search" || action.kind === "search_images"
        ? "Query"
        : action.kind === "push_to_github"
          ? "Update"
          : action.kind === "create_github_issue"
            ? "Issue"
            : "Task";
    const resultLabel =
      action.kind === "search_images"
        ? "Images"
        : action.kind === "web_search"
          ? "Results"
          : "Result";
    const loadingLabel =
      action.kind === "web_search" || action.kind === "search_images"
        ? "Searching…"
        : action.kind === "push_to_github"
          ? "Pushing…"
          : action.kind === "create_github_issue"
            ? "Filing…"
            : "Working…";
    return (
      <div className="space-y-2.5">
        {meta?.prompt && (
          <div>
            <div className="lab mb-1.5 text-[10px]">
              {taskLabel}
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-silver-600">
              {meta.prompt}
            </p>
          </div>
        )}
        <div>
          <div className="lab mb-1.5 text-[10px]">
            {resultLabel}
          </div>
          {meta?.result ? (
            <div className="text-silver-600">
              <ChatMarkdown content={meta.result} compact />
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-silver-500">
              <Loader2Icon className="size-3 animate-spin text-blue-500 motion-reduce:animate-none" />
              {loadingLabel}
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}

const FILE_LINK_KINDS = new Set<ActionItem["kind"]>([
  "create_file",
  "edit_file",
  "read_file",
  "download_asset",
]);

function ActionsAccordion({ actions }: { actions: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const openFile = useProjectStore((s) => s.openFile);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);

  const openInCodePanel = (path: string) => {
    openFile(path);
    setActiveTab("code");
  };

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  if (!open) {
    return (
      // The quiet chip for the work in between (boards/Surfaces.dc.html §04).
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex h-[26px] cursor-pointer items-center gap-2 rounded-sm border border-line px-2.5 text-xs font-medium text-silver-600 transition-colors duration-150 outline-none hover:border-line-strong hover:bg-space-surface hover:text-silver-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <div className="flex items-center gap-1.5 opacity-70">
          {actions.slice(0, 8).map((a, i) => (
            <span key={i}>
              <ActionIcon kind={a.kind} />
            </span>
          ))}
          {actions.length > 8 && <span className="text-[10px]">…</span>}
        </div>
        <span className="">
          {actions.length} Action{actions.length !== 1 ? "s" : ""}
        </span>
        <ChevronDownIcon className="size-3 shrink-0 opacity-60" />
      </button>
    );
  }

  return (
    // Expanded: a quiet inset with mono rows, no icons in colour.
    <div className="mt-3 text-xs text-silver-600">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(false)}
        className="mb-1.5 -ml-1.5 px-1.5"
      >
        <ChevronUpIcon />
        Show less
      </Button>

      <div className="rounded-md border border-line bg-space-void p-1 font-mono text-[12px]">
        {actions.map((action, i) => {
          const hasTodoSnapshot =
            action.kind === "update_todo" &&
            Array.isArray(
              (action.meta as { todos?: unknown } | undefined)?.todos,
            ) &&
            ((action.meta as { todos?: unknown[] }).todos?.length ?? 0) > 0;
          const isExpandable =
            action.kind === "create_plan" ||
            action.kind === "add_todos" ||
            hasTodoSnapshot ||
            action.kind === "dispatch_explorer" ||
            action.kind === "dispatch_debugger" ||
            action.kind === "dispatch_verifier" ||
            action.kind === "dispatch_implementer" ||
            action.kind === "web_search" ||
            action.kind === "search_images" ||
            action.kind === "push_to_github" ||
            action.kind === "create_github_issue";
          const isOpen = expanded.has(i);
          const isFileLink = FILE_LINK_KINDS.has(action.kind);
          const filePath = isFileLink
            ? ((action.meta as { path?: string } | undefined)?.path ?? "")
            : "";
          const isInteractive = isExpandable || (isFileLink && !!filePath);
          const handleActivate = isExpandable
            ? () => toggle(i)
            : isFileLink && filePath
              ? () => openInCodePanel(filePath)
              : undefined;
          return (
            <div key={i}>
              <div
                role={isInteractive ? "button" : undefined}
                tabIndex={isInteractive ? 0 : undefined}
                onClick={handleActivate}
                onKeyDown={
                  handleActivate
                    ? (e) => e.key === "Enter" && handleActivate()
                    : undefined
                }
                className={cn(
                  "flex items-center gap-2.5 px-2 py-1.5 transition-colors outline-none focus-visible:bg-space-raised",
                  isExpandable && !isOpen
                    ? "cursor-pointer rounded-sm hover:bg-space-raised hover:text-silver-900"
                    : isExpandable && isOpen
                      ? "cursor-pointer rounded-t-sm bg-space-raised text-silver-900"
                      : isFileLink && filePath
                        ? "cursor-pointer rounded-sm hover:bg-space-raised hover:text-silver-900"
                        : "rounded-sm",
                )}
              >
                <span className="shrink-0 opacity-50">
                  <ActionIcon kind={action.kind} />
                </span>
                <span className="flex-1 truncate">{action.label}</span>
                {isExpandable && (
                  <span className="shrink-0 opacity-40">
                    {isOpen ? (
                      <ChevronUpIcon className="size-3" />
                    ) : (
                      <ChevronDownIcon className="size-3" />
                    )}
                  </span>
                )}
              </div>
              {isExpandable && isOpen && (
                <div className="mb-1 rounded-b-sm border border-line bg-space-surface px-3 py-2.5 font-sans text-xs">
                  <ActionDetail action={action} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A small icon-only "Copy" affordance that fades in on hover of the message
// it belongs to, pinned to its bottom-right corner. Absolutely positioned
// into a reserved right-hand gutter, not stacked below the content, so it
// never adds height to the message - two replies back to back stay exactly
// as close as they'd be without it.
function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy to clipboard.");
        }
      }}
      aria-label="Copy message"
      title="Copy"
      className="pointer-events-none absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-sm text-silver-600 opacity-0 transition-[opacity,background-color,color] group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100 group-hover/message:pointer-events-auto group-hover/message:opacity-100 hover:bg-space-raised hover:text-silver-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      {copied ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </button>
  );
}

const USER_MSG_LINE_CLAMP = 4;

/**
 * "This turn was about that element", above the bubble it belongs to.
 *
 * The alternative was what shipped first: the file, line, tag, text and classes
 * prepended to the user's own message, so a one-sentence request rendered as a
 * five-line paragraph of bookkeeping. All of that still reaches the model: it
 * just travels in a block the transcript doesn't read
 * (`server/src/api/lib/visualContext.ts`), leaving this to say the same thing
 * in the space it deserves.
 *
 * Clicking it opens the file, which is the one thing anyone wants from it
 * later; the element itself is long gone by then.
 */
function ElementChip({ element }: { element: MessageElement }) {
  const openFile = useProjectStore((s) => s.openFile);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const known = useProjectStore((s) => Boolean(s.files[element.path]));

  return (
    <button
      type="button"
      disabled={!known}
      onClick={() => {
        openFile(element.path);
        setActiveTab("code");
      }}
      title={
        known
          ? `Open ${element.path}`
          : `${element.path} isn't in the file tree yet`
      }
      className="flex max-w-[80%] items-center gap-1.5 rounded-xs border border-line bg-space-surface px-2 py-0.5 text-[11px] text-silver-600 transition-colors enabled:cursor-pointer enabled:hover:border-line-strong enabled:hover:text-silver-900 disabled:cursor-default"
    >
      <SquareMousePointerIcon className="size-3 shrink-0" />
      <span className="truncate font-mono">
        &lt;{element.tagName}&gt; · {element.path.split("/").pop()}:
        {element.line}
      </span>
    </button>
  );
}

// User turns sit in a right-aligned bubble with a timestamp underneath; tau's
// replies render as flat, full-width text on the surface (no bubble), the way a
// chat transcript reads.
function ChatBubble({
  message,
  delay,
  noAnimate = false,
  streaming = false,
}: {
  message: Message;
  delay: number;
  noAnimate?: boolean;
  /** tau is still writing this reply: it develops as it streams (InkReveal). */
  streaming?: boolean;
}) {
  const transition = { ...ENTRANCE.transition, delay };
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // Compare clamped height vs full scroll height to detect overflow.
    setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [message.content]);

  if (message.role === "user") {
    const attachments = message.attachments ?? [];
    const bubble = (
      <div className="flex flex-col items-end gap-1">
        {attachments.length > 0 && (
          <div className="max-w-[85%]">
            <MessageAttachmentRail attachments={attachments} />
          </div>
        )}
        {message.element && <ElementChip element={message.element} />}
        {/* Attachment-only turns have no text of their own: render the chips
            and the timestamp, but no empty bubble. */}
        {message.content && (
          // You: a raised bubble on the right. Tau: plain text, no bubble.
          <div className="max-w-[80%] rounded-xl border border-line bg-space-raised px-4 py-3 text-sm leading-[1.6] text-silver-900">
            <div
              ref={contentRef}
              style={
                expanded
                  ? undefined
                  : {
                      WebkitLineClamp: USER_MSG_LINE_CLAMP,
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }
              }
              className="whitespace-pre-wrap break-words"
            >
              {message.content}
            </div>
            {(overflows || expanded) && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 cursor-pointer text-xs text-blue-500 underline-offset-3 hover:text-blue-hi hover:underline"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}
        <span className="px-1 text-xs text-silver-500">
          {formatRelativeTime(message.timestamp)}
        </span>
      </div>
    );

    if (noAnimate) return bubble;
    return (
      <motion.div
        initial={ENTRANCE.initial}
        animate={ENTRANCE.animate}
        transition={transition}
      >
        {bubble}
      </motion.div>
    );
  }

  const aiBody = (
    <div>
      {message.content && (
        <div className="group/message relative pr-8 text-sm text-silver-900">
          <InkReveal live={streaming}>
            <ChatMarkdown content={message.content} />
          </InkReveal>
          {!streaming && <CopyMessageButton text={message.content} />}
        </div>
      )}
      {message.actions && message.actions.length > 0 && (
        <ActionsAccordion actions={message.actions} />
      )}
    </div>
  );

  if (noAnimate) return aiBody;

  return (
    <motion.div
      initial={ENTRANCE.initial}
      animate={ENTRANCE.animate}
      transition={transition}
    >
      {aiBody}
    </motion.div>
  );
}

// While tau works, the chat loader says what it is doing (thinking, a live
// action, writing); when the run ends it says how it ended (stopped, done).
function TypingBubble({
  view,
  runStartedAt,
  stalled = false,
  onStop,
  onResume,
  resuming,
}: {
  view: ChatLoaderView;
  runStartedAt: number | null;
  /** The run has gone quiet past the stall threshold: say so instead of
   *  shimmering indefinitely at a job that may never speak again. */
  stalled?: boolean;
  onStop?: (() => void) | null;
  onResume?: () => void;
  resuming?: boolean;
}) {
  const running = view.kind === "thinking" || view.kind === "working" || view.kind === "writing";
  if (stalled && running) {
    return (
      <motion.div
        initial={ENTRANCE.initial}
        animate={ENTRANCE.animate}
        exit={{ opacity: 0 }}
        className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-silver-600"
      >
        <TauMark state="still" />
        <span>Tau has gone quiet. It may need a fresh start.</span>
        {onStop && (
          <Button variant="secondary" size="sm" onClick={onStop}>
            Stop it
          </Button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={ENTRANCE.initial}
      animate={ENTRANCE.animate}
      exit={{ opacity: 0 }}
      className="mt-6"
    >
      <ChatLoader
        view={view}
        runStartedAt={runStartedAt}
        onResume={onResume}
        resuming={resuming}
      />
    </motion.div>
  );
}

function ContextDivider({ meta }: { meta: DividerMeta }) {
  const [open, setOpen] = useState(false);
  const hasSummary = meta.summary.trim().length > 0;

  return (
    <div className="my-1">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-line" />
        <button
          type="button"
          disabled={!hasSummary}
          onClick={() => hasSummary && setOpen((v) => !v)}
          className="flex cursor-pointer items-center gap-1.5 rounded-xs border border-line bg-space-surface px-2.5 py-1 font-mono text-[11px] text-silver-500 transition-colors hover:text-silver-900 disabled:cursor-default disabled:hover:text-silver-500"
        >
          <ScrollTextIcon className="size-3 shrink-0 opacity-60" />
          <span>Earlier conversation tucked away</span>
          {hasSummary &&
            (open ? (
              <ChevronUpIcon className="size-3 shrink-0" />
            ) : (
              <ChevronDownIcon className="size-3 shrink-0" />
            ))}
        </button>
        <div className="h-px flex-1 bg-line" />
      </div>
      {open && hasSummary && (
        <div className="mt-2 rounded-md border border-line bg-space-surface px-3 py-2.5 text-xs text-silver-600">
          <ChatMarkdown content={meta.summary} compact />
        </div>
      )}
    </div>
  );
}

/** An info icon at the end of a menu row, explaining it in a tooltip. */
function MenuHint({ children }: { children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="flex size-4 shrink-0 items-center justify-center text-silver-500 hover:text-silver-600"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <InfoIcon className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-56">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function ProjectSwitcher({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  // Bootstrap owns fetching. Mounting this header must only observe its cache;
  // a second fetch can otherwise unmount/remount it on every failed response.
  const { data: detail } = useProject(projectId, { enabled: false });
  const name = detail?.project.name ?? "Project";
  const nameRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const jobActive = Boolean(detail?.activeJobId);
  const summarizeChat = useSummarizeChat(projectId);
  const setContextUsage = useProjectStore((s) => s.setContextUsage);

  const handleSummarize = () => {
    summarizeChat.mutate(undefined, {
      onSuccess: (data) => {
        toast.success("Chat summarized");
        // Apply the fresh usage snapshot immediately — no flash, the user
        // already knows why this changed, they just triggered it themselves.
        setContextUsage(data);
      },
      onError: (err) =>
        toast.error(
          err instanceof ApiError ? err.message : "Failed to summarize chat",
        ),
    });
  };

  useEffect(() => {
    const el = nameRef.current;
    if (el) setIsTruncated(el.scrollWidth > el.clientWidth);
  }, [name]);

  const projectAsListItem = detail
    ? {
        id: projectId,
        name: detail.project.name,
        description: detail.project.description,
        tags: detail.project.tags,
        instructions: detail.project.instructions,
        sandboxStatus: detail.project.sandboxStatus,
        createdAt: "",
        updatedAt: "",
        previewImageUrl: null,
      }
    : null;

  return (
    <>
      {/* The project name is a place, not a status: a ghost trigger
          (boards/Overlays.dc.html "Menus in context"). */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                data-tour="project-switcher"
                className="group max-w-full min-w-0 gap-2.5 px-2.5 text-silver-900 hover:text-silver-900"
              >
                <FolderOpenIcon className="text-silver-600" />
                <span ref={nameRef} className="max-w-[220px] min-w-0 truncate font-medium">
                  {name}
                </span>
                <ChevronDownIcon className="text-silver-600 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          {isTruncated && <TooltipContent>{name}</TooltipContent>}
        </Tooltip>

        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuItem onSelect={() => navigate(APP_HOME)}>
            <HomeIcon />
            Home
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <PencilIcon />
            Edit project
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setClearOpen(true)} disabled={jobActive}>
            <EraserIcon />
            <span className="flex-1">Clear chat</span>
            <MenuHint>
              {jobActive
                ? "Finish or cancel the current run first."
                : "Clears the chat, keeps your files. Recommended before starting an unrelated piece of work."}
            </MenuHint>
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={handleSummarize}
            disabled={jobActive || summarizeChat.isPending}
          >
            {summarizeChat.isPending ? (
              <Loader2Icon className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Summary />
            )}
            <span className="flex-1">
              {summarizeChat.isPending ? "Summarizing…" : "Summarize chat"}
            </span>
            <MenuHint>
              {jobActive
                ? "Finish or cancel the current run first."
                : "Shortens the chat history so tau keeps more room to work. Recommended when a conversation has been running long."}
            </MenuHint>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2Icon />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProjectDialog
        project={projectAsListItem}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <ClearChatDialog
        projectId={projectId}
        open={clearOpen}
        onOpenChange={setClearOpen}
      />

      <DeleteProjectDialog
        project={projectAsListItem}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => navigate(APP_HOME)}
      />
    </>
  );
}

// Sentinel selection for the free-form row, distinct from any option string
// the agent could plausibly suggest.
const ASK_USER_CUSTOM = "__custom__";
const ASK_USER_SKIP_ANSWER = "No strong preference. Use your best judgment.";

function AskUserOptionRow({
  label,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      className={cn(
        "flex w-full cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40",
        selected
          ? "border-blue-500 bg-blue-500/12 text-silver-900"
          : "border-line-strong bg-space-void text-silver-600 hover:border-line-hover hover:text-silver-900",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected ? "border-blue-500" : "border-line-hover",
        )}
      >
        {selected && <span className="size-[7px] rounded-full bg-blue-500" />}
      </span>
      <span className="leading-snug">{label}</span>
    </button>
  );
}

function AskUserPrompt({
  projectId,
  jobId,
  questionId,
  question,
  options,
  onAnswered,
}: {
  projectId: string;
  jobId: string;
  questionId: string;
  question: string;
  options: string[];
  onAnswered: (answer: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  const submit = async (answer: string) => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      await submitJobAnswer(projectId, jobId, questionId, answer.trim());
      onAnswered(answer.trim());
    } catch {
      toast.error("Failed to send your answer. Please try again.");
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting &&
    (selected === ASK_USER_CUSTOM ? custom.trim().length > 0 : !!selected);

  const handleSubmit = () => {
    if (!canSubmit || !selected) return;
    void submit(selected === ASK_USER_CUSTOM ? custom : selected);
  };

  return (
    // tau asks you something: the composer's surface, one strong edge, the
    // options as choice rows and one primary to answer.
    <div className="rounded-[14px] border border-line-strong bg-space-surface">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <p className="text-sm leading-snug font-semibold text-silver-900">
          {question}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={submitting}
          onClick={() => void submit(ASK_USER_SKIP_ANSWER)}
          aria-label="Skip this question"
          title="Skip"
          className="-mt-1 -mr-1.5"
        >
          <XIcon />
        </Button>
      </div>

      <div role="radiogroup" aria-label={question} className="space-y-1.5 px-3 py-3">
        {options.map((opt) => (
          <AskUserOptionRow
            key={opt}
            label={opt}
            selected={selected === opt}
            disabled={submitting}
            onSelect={() => setSelected(opt)}
          />
        ))}

        <div
          onClick={() => {
            setSelected(ASK_USER_CUSTOM);
            customInputRef.current?.focus();
          }}
          className={cn(
            "flex cursor-text items-center gap-2.5 rounded-md border px-3 py-2.5 transition-colors duration-150",
            selected === ASK_USER_CUSTOM
              ? "border-blue-500 bg-blue-500/12"
              : "border-line-strong bg-space-void hover:border-line-hover",
          )}
        >
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
              selected === ASK_USER_CUSTOM ? "border-blue-500" : "border-line-hover",
            )}
          >
            {selected === ASK_USER_CUSTOM && (
              <span className="size-[7px] rounded-full bg-blue-500" />
            )}
          </span>
          <input
            ref={customInputRef}
            type="text"
            value={custom}
            onChange={(e) => {
              setSelected(ASK_USER_CUSTOM);
              setCustom(e.target.value);
            }}
            onFocus={() => setSelected(ASK_USER_CUSTOM)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit(custom);
              }
            }}
            disabled={submitting}
            placeholder="Write your own…"
            className="w-full min-w-0 bg-transparent text-sm text-silver-900 placeholder:text-silver-500 focus:outline-none focus-visible:outline-none disabled:opacity-40"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line px-3 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          disabled={submitting}
          onClick={() => void submit(ASK_USER_SKIP_ANSWER)}
        >
          Skip
        </Button>
        <Button size="sm" disabled={!canSubmit} loading={submitting} onClick={handleSubmit}>
          Answer
        </Button>
      </div>
    </div>
  );
}

/** The transcript before the project's messages have loaded. */
export function ChatHistorySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading chat">
      <Skeleton className="ml-auto h-11 w-3/5 rounded-xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-[90%]" />
        <Skeleton className="h-3 w-[75%]" />
        <Skeleton className="h-3 w-[40%]" />
      </div>
    </div>
  );
}

/** A loaded project with no messages (a cleared chat). */
export function ChatEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 text-center">
      <span className="grid size-10 place-items-center rounded-md border border-line-strong bg-space-surface text-silver-600">
        <MessageSquareIcon className="size-4" />
      </span>
      <p className="text-sm font-semibold text-silver-900">No messages yet</p>
      <p className="max-w-60 text-[13px] text-silver-500">Ask tau for a change below.</p>
    </div>
  );
}

export function ChatPanel({
  showCollapse = true,
  readyNotification,
}: {
  showCollapse?: boolean;
  readyNotification?: ReadyNotificationController;
}) {
  const { id: projectId } = useParams<{ id: string }>();
  const messages = useProjectStore((s) => s.chatMessages);
  const hydrated = useProjectStore((s) => s.hydrated);
  const isAiTyping = useProjectStore((s) => s.isAiTyping);
  const activity = useProjectStore((s) => s.activity);
  const isStalled = useProjectStore((s) => s.isStalled);
  const status = useProjectStore((s) => s.status);
  const streamingId = useProjectStore((s) => s.streamingId);
  const writingPath = useProjectStore((s) => s.writingPath);
  const liveAction = useProjectStore((s) => s.liveAction);
  const runStartedAt = useProjectStore((s) => s.runStartedAt);
  const runEndedAt = useProjectStore((s) => s.runEndedAt);
  const prependMessages = useProjectStore((s) => s.prependMessages);
  const hasMoreMessages = useProjectStore((s) => s.hasMoreMessages);
  const oldestSequence = useProjectStore((s) => s.oldestSequence);
  const cancelStream = useProjectStore((s) => s.cancelStream);
  const toggleChat = useProjectStore((s) => s.toggleChat);
  const pendingQuestion = useProjectStore((s) => s.pendingQuestion);
  const answerPendingQuestion = useProjectStore((s) => s.answerPendingQuestion);
  const currentJobId = useProjectStore((s) => s.currentJobId);
  const {
    usage: contextUsage,
    flashKind: contextUsageFlashKind,
    flashToken: contextUsageFlashToken,
  } = useContextUsage();

  const { data: balance } = useBalance();
  const isStreaming = status === "streaming";
  const chatLoading = !hydrated && messages.length === 0 && !isStreaming;
  // Genuinely empty, not just "not loaded yet" — e.g. right after "Clear chat".
  const chatEmpty = hydrated && !isStreaming && messages.length === 0;

  // Shared with the Home composer and the visual-edit inspector, so a MAX
  // choice made anywhere carries everywhere.
  const { effort, setEffort } = useEffortChoice();
  const { send, isSending } = useSendMessage(projectId);
  const canContinueAfterCredits =
    !isStreaming &&
    !isSending &&
    shouldOfferCreditResume(messages, balance?.credits.available);
  const loaderView = useSteadyLoaderView(chatLoaderView({
    isAiTyping,
    status,
    streaming: streamingId !== null,
    writingPath,
    activity,
    liveAction,
    messages,
    runStartedAt,
    runEndedAt,
  }));

  const [draft, setDraft] = useState("");

  const attachments = useAttachments();
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Messages present on first render get a staggered entrance; later ones don't.
  const [initialCount] = useState(messages.length);
  // Tracks message IDs prepended via pagination: they skip the entrance animation.
  const [prependedIds, setPrependedIds] = useState(() => new Set<string>());
  // Scroll height snapshot taken just before prepending, used to hold position.
  const scrollHeightBeforePrependRef = useRef<number | null>(null);
  // Whether the viewport was near the bottom before the last messages change.
  const wasNearBottomRef = useRef(true);
  // Tracks whether we've done the initial snap-to-bottom on first load.
  const initialScrollDoneRef = useRef(false);

  // Snap to bottom instantly on the first render that has messages.
  useLayoutEffect(() => {
    if (initialScrollDoneRef.current || messages.length === 0) return;
    initialScrollDoneRef.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // After prepend: compensate scrollTop so the visible content doesn't jump.
  useLayoutEffect(() => {
    if (scrollHeightBeforePrependRef.current === null) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollTop += el.scrollHeight - scrollHeightBeforePrependRef.current;
    }
    scrollHeightBeforePrependRef.current = null;
  }, [messages]);

  // Auto-scroll to bottom only when the user was already near the bottom.
  useEffect(() => {
    if (!wasNearBottomRef.current) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isAiTyping]);

  const loadOlderMessages = useCallback(async () => {
    if (
      isLoadingOlder ||
      !hasMoreMessages ||
      !projectId ||
      oldestSequence === null
    )
      return;
    setIsLoadingOlder(true);
    scrollHeightBeforePrependRef.current =
      scrollRef.current?.scrollHeight ?? null;
    try {
      const {
        messages: older,
        hasMore,
        checkpoints,
      } = await fetchOlderMessages(projectId, oldestSequence);
      setPrependedIds((previous) => {
        const next = new Set(previous);
        older.forEach((m) => next.add(m.id));
        return next;
      });
      prependMessages(older, hasMore, checkpoints);
    } catch {
      scrollHeightBeforePrependRef.current = null;
    } finally {
      setIsLoadingOlder(false);
    }
  }, [
    isLoadingOlder,
    hasMoreMessages,
    projectId,
    oldestSequence,
    prependMessages,
  ]);

  // When the loaded messages don't fill the viewport there is no scroll event
  // to trigger the normal scroll-up pagination: auto-load until they do.
  useEffect(() => {
    if (isStreaming || isLoadingOlder || !hasMoreMessages) return;
    const el = scrollRef.current;
    if (!el || el.scrollTop >= 80) return;
    void loadOlderMessages();
  }, [
    messages,
    isStreaming,
    isLoadingOlder,
    hasMoreMessages,
    loadOlderMessages,
  ]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasNearBottomRef.current = distFromBottom < 120;
    setShowScrollDown(distFromBottom > 200);
    if (el.scrollTop < 80 && hasMoreMessages && !isLoadingOlder) {
      void loadOlderMessages();
    }
  };

  const canSend =
    (draft.trim().length > 0 || attachments.attachments.length > 0) &&
    !isStreaming &&
    !isSending &&
    !attachments.isBusy;

  const submit = () => {
    const content = draft.trim();
    if (attachments.isBusy) return;

    // Snapshot for rollback: a failed send shouldn't eat the attachments.
    const sentAttachments = attachments.attachments;
    const sent = send(content, {
      effort,
      attachmentIds: attachments.readyIds,
      attachments: toMessageAttachments(sentAttachments),
      onFailed: () => {
        setDraft(content);
        attachments.restore(sentAttachments);
      },
    });
    if (!sent) return;

    setDraft("");
    attachments.clear();
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-space-void">
      <div className="flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-line py-3 pr-3.5 pl-3">
        <div className="min-w-0">
          {projectId && <ProjectSwitcher projectId={projectId} />}
        </div>
        <div className="flex items-center gap-1">
          {contextUsage && (
            // The ring is a context-usage meter, not a loader.
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className="flex size-8 items-center justify-center rounded-sm outline-none hover:bg-space-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  <CircularProgress
                    percent={contextUsage.usagePercent}
                    flashKind={contextUsageFlashKind}
                    flashToken={contextUsageFlashToken}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-56">
                {Math.round(contextUsage.usagePercent)}% of context window used.
                Auto-compacts at 60%, summarizes at 75%.
              </TooltipContent>
            </Tooltip>
          )}
          {/* Collapse only makes sense once the chat is docked beside the
            workspace; pre-build it owns the whole (centered) screen. */}
          {showCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleChat}
              aria-label="Collapse chat"
              data-tour="collapse-chat"
            >
              <PanelLeftCloseIcon />
            </Button>
          )}
          {!showCollapse && (
            <span className="ml-1.5 flex">
              <UserMenu />
            </span>
          )}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden" data-tour="chat-thread">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn(
            "h-full overflow-y-auto py-[22px] [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin]",
            showCollapse ? "px-5" : "px-1",
          )}
        >
          {isLoadingOlder && (
            <div role="status" className="flex items-center justify-center gap-2.5 py-2">
              <TauMark size={20} />
              <span className="font-mono text-xs text-silver-500">Loading earlier messages</span>
            </div>
          )}
          {chatLoading && <ChatHistorySkeleton />}
          {chatEmpty && <ChatEmpty />}
          {messages.map((m, i) => {
            // Consecutive messages from the same speaker (tau narrating a
            // multi-step turn: "I'll set up...", "4 Actions", "Adding a
            // button...", "2 Actions", ...) read as one continuous stream and
            // sit close together; an actual turn change (user <-> tau, or a
            // context-summary divider) gets the full gap so the thread still
            // reads as distinct exchanges rather than one flat wall.
            const prev = i > 0 ? messages[i - 1] : undefined;
            const sameSpeakerAsPrev =
              !!prev &&
              prev.role !== "divider" &&
              m.role !== "divider" &&
              prev.role === m.role;
            const spacing =
              i === 0 && !isLoadingOlder
                ? undefined
                : sameSpeakerAsPrev
                  ? "mt-3"
                  : "mt-6";
            return (
              <div key={m.id} className={spacing}>
                {m.role === "divider" && m.divider ? (
                  <ContextDivider meta={m.divider} />
                ) : (
                  <ChatBubble
                    message={m}
                    delay={
                      prependedIds.has(m.id)
                        ? 0
                        : i < initialCount
                          ? i * 0.04
                          : 0
                    }
                    noAnimate={prependedIds.has(m.id)}
                    streaming={m.id === streamingId}
                  />
                )}
              </div>
            );
          })}
          {canContinueAfterCredits && (
            <motion.div
              initial={ENTRANCE.initial}
              animate={ENTRANCE.animate}
              transition={ENTRANCE.transition}
              className="mt-6"
            >
              <Button onClick={() => void send(CREDIT_RESUME_PROMPT, { effort })}>
                <PlayIcon className="fill-current" />
                Continue
              </Button>
            </motion.div>
          )}
          <AnimatePresence>
            {loaderView && !canContinueAfterCredits && (
              <TypingBubble
                // A new key per run end so "done" fires its one flash fresh.
                key={loaderView.kind === "done" || loaderView.kind === "stopped" ? loaderView.kind : "run"}
                view={loaderView}
                runStartedAt={runStartedAt}
                stalled={isStalled}
                onStop={cancelStream}
                onResume={() => void send(CREDIT_RESUME_PROMPT, { effort })}
                resuming={isSending}
              />
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showScrollDown && (
            <motion.button
              key="scroll-down"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              type="button"
              onClick={scrollToBottom}
              aria-label="Scroll to bottom"
              className="absolute bottom-3 left-1/2 flex size-8 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-space-overlay text-silver-600 shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-colors hover:border-line-hover hover:bg-space-raised hover:text-silver-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <ArrowDownIcon className="size-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div
        className={cn("shrink-0", showCollapse ? "px-4 pb-4" : "pb-[22px]")}
        data-tour="composer"
      >
        {!pendingQuestion && readyNotification?.showPrompt && (
          <div className="mb-2 flex w-full items-center gap-2.5 rounded-lg border border-line bg-space-surface py-2 pr-2 pl-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-space-overlay text-silver-600">
              <BellIcon className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-silver-900">
                Notify when ready?
              </span>
              <span className="block truncate text-xs text-silver-500">
                You can switch tabs while Tau works
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={readyNotification.snooze}
              title="Hide this for 3 days"
            >
              Not now
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void readyNotification.enable()}
            >
              Notify me
            </Button>
          </div>
        )}
        {pendingQuestion?.secrets?.length && currentJobId && projectId ? (
          <SecretRequestPrompt
            key={pendingQuestion.id}
            projectId={projectId}
            jobId={currentJobId}
            questionId={pendingQuestion.id}
            fields={pendingQuestion.secrets}
            onAnswered={(answer) =>
              answerPendingQuestion(pendingQuestion.id, answer)
            }
          />
        ) : pendingQuestion && currentJobId && projectId ? (
          <AskUserPrompt
            projectId={projectId}
            jobId={currentJobId}
            questionId={pendingQuestion.id}
            question={pendingQuestion.question}
            options={pendingQuestion.options}
            onAnswered={(answer) =>
              answerPendingQuestion(pendingQuestion.id, answer)
            }
          />
        ) : (
          <PromptComposer
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            onStop={isStreaming && cancelStream ? cancelStream : undefined}
            placeholder={
              isStreaming ? "tau is working…" : "Ask tau to change something…"
            }
            minRows={1}
            maxRows={4}
            isSubmitting={!canSend && draft.trim().length > 0}
            compact
            attachments={attachments.attachments}
            onAttach={(files) => attachments.addFiles(files)}
            onRemoveAttachment={attachments.remove}
            onPasteLarge={attachments.addPaste}
            attachmentsBusy={attachments.isBusy}
            controls={
              <ComposerSettings effort={effort} onEffortChange={setEffort} compact />
            }
          />
        )}
        {/* Before the first build the chat owns the screen alone. */}
        {!showCollapse && (
          <p className="mt-4 text-center text-xs text-silver-500">
            Chat only until the workspace is ready. The preview, code and tools
            appear here once the first build lands.
          </p>
        )}
      </div>
    </div>
  );
}
