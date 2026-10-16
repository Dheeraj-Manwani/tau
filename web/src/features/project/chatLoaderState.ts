import type { ActionItem, JobStatus, Message } from "@/src/stores/useProjectStore";

/**
 * What the chat loader shows (boards/Chat-Loader.dc.html), derived from the
 * job stream's state rather than a timer:
 * - thinking: before tau says or does anything;
 * - working: a tool is running (the live action line);
 * - writing: text is streaming into a bubble;
 * - stopped: the user stopped the run;
 * - done: the run finished in this browser.
 */
export type ChatLoaderView =
  | { kind: "thinking"; label: string }
  | { kind: "working"; verb: string; target: string | null; action: ActionItem | null }
  | { kind: "writing" }
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

export function chatLoaderView(input: ChatLoaderInput): ChatLoaderView | null {
  if (input.isAiTyping) {
    if (input.writingPath) {
      return { kind: "working", verb: "Writing", target: input.writingPath, action: null };
    }
    if (input.streaming) return { kind: "writing" };
    if (input.liveAction) {
      return { kind: "working", ...liveActionLine(input.liveAction), action: input.liveAction };
    }
    const label = input.activity && input.activity !== "Working" ? input.activity : "Thinking";
    return { kind: "thinking", label };
  }

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

/** 7 → "0:07", 125 → "2:05". */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 42 → "42s", 125 → "2m 5s". */
export function formatDuration(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
