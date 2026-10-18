import type { ActionItem, ActionKind, JobStatus, Message } from "@/src/stores/useProjectStore";

/**
 * What the chat loader shows (boards/Chat-Loader.dc.html), derived from the
 * job stream's state rather than a timer. While a run is live the headline
 * names the phase, not the tool, so it changes a few times per run:
 * - thinking: before tau says or does anything, and between steps;
 * - working: a tool is running (reading, searching, running a check);
 * - writing: a file or a reply is being written.
 * The step itself (src/App.tsx, "Reading 4 files") sits after the headline
 * and is the only part that changes often. When the run ends:
 * - stopped: the user stopped the run;
 * - done: the run finished in this browser.
 */
export type RunningLoaderView = {
  kind: "thinking" | "working" | "writing";
  label: string;
  /** The step in words: "Reading", "Searching the project", "3 files". */
  detail: string | null;
  /** What the step is about, shown in mono: a path, a query. */
  target: string | null;
};

export type ChatLoaderView =
  | RunningLoaderView
  | { kind: "stopped" }
  | { kind: "done"; seconds: number | null; actions: number };

export interface ChatLoaderInput {
  isAiTyping: boolean;
  status: JobStatus;
  streaming: boolean;
  writingPath: string | null;
  activity: string | null;
  liveAction: ActionItem | null;
  messages: readonly Pick<Message, "role" | "actions">[];
  runStartedAt: number | null;
  runEndedAt: number | null;
}

/** Messages after the latest user message: the run's own turn. */
export function currentTurn<T extends Pick<Message, "role">>(messages: readonly T[]): T[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages.slice(i + 1);
  }
  return [...messages];
}

/** Steps tau took this turn, as the "N Actions" chips count them. */
export function turnActionCount(messages: readonly Pick<Message, "role" | "actions">[]): number {
  return currentTurn(messages).reduce((n, m) => n + (m.role === "ai" ? (m.actions?.length ?? 0) : 0), 0);
}

// Action labels are written in the past tense for the transcript ("Edited
// app.tsx"); the live line says what is happening now.
const PRESENT: [RegExp, string][] = [
  [/^Created\b/, "Writing"],
  [/^Edited\b/, "Editing"],
  [/^Opened\b/, "Reading"],
  [/^Deleted\b/, "Deleting"],
  [/^Looked through\b/, "Looking through"],
  [/^Looked at\b/, "Looking at"],
  [/^Looked back for:/, "Looking back for:"],
  [/^Re-read\b/, "Re-reading"],
  [/^Read the\b/, "Reading the"],
  [/^Read a\b/, "Reading a"],
  [/^Searched images:/, "Searching images:"],
  [/^Searched\b/, "Searching"],
  [/^Checked\b/, "Checking"],
  [/^Ran\b/, "Running"],
  [/^Waited for\b/, "Waiting for"],
  [/^Downloaded\b/, "Downloading"],
  [/^Added\b/, "Adding"],
  [/^Explored:/, "Exploring:"],
  [/^Pushed\b/, "Pushing"],
  [/^Filed\b/, "Filing"],
  [/^Set up\b/, "Setting up"],
  [/^Prepared\b/, "Preparing"],
  [/^Asked\b/, "Asking"],
];

const PATH_KINDS = new Set<ActionItem["kind"]>(["create_file", "edit_file", "read_file", "delete_file"]);

/** "Edited app.tsx" with meta.path "src/app.tsx" → { verb: "Editing", target: "src/app.tsx" }. */
export function liveActionLine(action: ActionItem): { verb: string; target: string | null } {
  let label = action.label.trim();
  for (const [pattern, present] of PRESENT) {
    if (pattern.test(label)) {
      label = label.replace(pattern, present);
      break;
    }
  }
  const path = typeof action.meta?.path === "string" ? action.meta.path : "";
  if (PATH_KINDS.has(action.kind) && path) {
    // The label ends in the file's base name; the line shows the whole path.
    const verb = label.split(/\s+/)[0] ?? label;
    return { verb, target: path };
  }
  const colon = label.indexOf(": ");
  if (colon > 0) return { verb: label.slice(0, colon), target: label.slice(colon + 2) };
  return { verb: label, target: null };
}

// File steps come in quick runs. A run of one kind is counted, so four reads
// in a row read "Reading 4 files" instead of swapping the line four times.
const FILE_GROUP: Partial<Record<ActionKind, "read" | "write" | "delete">> = {
  read_file: "read",
  create_file: "write",
  edit_file: "write",
  delete_file: "delete",
};

/** How many of this turn's latest actions, counting back, share `group`. */
function trailingFileRun(messages: ChatLoaderInput["messages"], group: string): number {
  const turn = currentTurn(messages);
  let n = 0;
  for (let i = turn.length - 1; i >= 0; i--) {
    if (turn[i].role !== "ai") continue;
    const actions = turn[i].actions ?? [];
    for (let j = actions.length - 1; j >= 0; j--) {
      if (FILE_GROUP[actions[j].kind] !== group) return n;
      n++;
    }
  }
  return n;
}

function runningView(input: ChatLoaderInput): RunningLoaderView {
  const action = input.liveAction;
  const group = action ? FILE_GROUP[action.kind] : undefined;
  // The live action is already in the transcript; the max covers a gap.
  const count = group ? Math.max(1, trailingFileRun(input.messages, group)) : 1;

  if (input.writingPath || group === "write") {
    const path = input.writingPath ?? (typeof action?.meta?.path === "string" ? action.meta.path : null);
    return { kind: "writing", label: "Writing", detail: count > 1 ? `${count} files` : null, target: path };
  }
  if (input.streaming) return { kind: "writing", label: "Writing", detail: null, target: null };
  if (action) {
    const { verb, target } = liveActionLine(action);
    return { kind: "working", label: "Working", detail: count > 1 ? `${verb} ${count} files` : verb, target };
  }
  const label = input.activity && input.activity !== "Working" ? input.activity : "Thinking";
  return { kind: "thinking", label, detail: null, target: null };
}

export function chatLoaderView(input: ChatLoaderInput): ChatLoaderView | null {
  if (input.isAiTyping) return runningView(input);

  // The end of a run speaks only while it is still the end of the chat: once
  // the user writes again, that turn owns what comes next.
  const last = input.messages[input.messages.length - 1];
  if (last?.role === "user") return null;

  if (input.status === "cancelled") return { kind: "stopped" };
  if (input.status === "done" && input.runStartedAt !== null) {
    const seconds =
      input.runEndedAt !== null
        ? Math.max(0, Math.round((input.runEndedAt - input.runStartedAt) / 1000))
        : null;
    return { kind: "done", seconds, actions: turnActionCount(input.messages) };
  }
  return null;
}

export function isRunningView(view: ChatLoaderView | null): view is RunningLoaderView {
  return view?.kind === "thinking" || view?.kind === "working" || view?.kind === "writing";
}

/** Two views with the same key render the same line. */
export function loaderViewKey(view: ChatLoaderView | null): string {
  return view ? JSON.stringify(view) : "";
}

/** A live line stays up at least this long before the next one replaces it. */
export const LOADER_MIN_HOLD_MS = 1200;
/** A step that is over sooner than this never reaches the screen. */
export const LOADER_MIN_LIFE_MS = 400;

/**
 * How long a new live line waits before it replaces the one shown since
 * `shownAt`: until that one has had its hold, and until the new one has
 * lasted long enough to be worth reading.
 */
export function loaderSwapDelay(shownAt: number, now: number): number {
  return Math.max(LOADER_MIN_LIFE_MS, shownAt + LOADER_MIN_HOLD_MS - now);
}

/** 7 → "0:07", 125 → "2:05". */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 42 → "42s", 125 → "2m 5s". */
export function formatDuration(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
