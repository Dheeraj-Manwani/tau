import { describe, expect, test } from "bun:test";

import {
  chatLoaderView,
  formatDuration,
  formatElapsed,
  isRunningView,
  liveActionLine,
  LOADER_MIN_HOLD_MS,
  LOADER_MIN_LIFE_MS,
  loaderSwapDelay,
  turnActionCount,
  type ChatLoaderInput,
} from "@/src/features/project/chatLoaderState";
import type { ActionItem } from "@/src/stores/useProjectStore";

const base: ChatLoaderInput = {
  isAiTyping: true,
  status: "streaming",
  streaming: false,
  writingPath: null,
  activity: "Thinking",
  liveAction: null,
  messages: [{ role: "user" }],
  runStartedAt: 1_000,
  runEndedAt: null,
};

const read = (path: string): ActionItem => ({ kind: "read_file", label: `Opened ${path}`, meta: { path } });
const edit = (path: string): ActionItem => ({ kind: "edit_file", label: `Edited ${path}`, meta: { path } });

describe("chat loader state", () => {
  test("thinks before tau says or does anything", () => {
    expect(chatLoaderView(base)).toEqual({ kind: "thinking", label: "Thinking", detail: null, target: null });
    expect(chatLoaderView({ ...base, activity: "Queued" })).toMatchObject({ kind: "thinking", label: "Queued" });
    // "Working" is the store's placeholder between file events, not a label.
    expect(chatLoaderView({ ...base, activity: "Working" })).toMatchObject({ kind: "thinking", label: "Thinking" });
  });

  test("a running tool reads Working, with the step after it", () => {
    const view = chatLoaderView({ ...base, liveAction: read("src/app.tsx") });
    expect(view).toEqual({ kind: "working", label: "Working", detail: "Reading", target: "src/app.tsx" });
    expect(chatLoaderView({ ...base, liveAction: { kind: "run_command", label: "Ran a project check" } })).toEqual({
      kind: "working",
      label: "Working",
      detail: "Running a project check",
      target: null,
    });
  });

  test("reads in a row are counted, not swapped", () => {
    const messages = [{ role: "user" as const }, { role: "ai" as const, actions: [edit("a"), read("b"), read("c")] }, { role: "ai" as const, actions: [read("d")] }];
    expect(chatLoaderView({ ...base, messages, liveAction: read("d") })).toEqual({
      kind: "working",
      label: "Working",
      detail: "Reading 3 files",
      target: "d",
    });
  });

  test("a file being written reads Writing, counting edits in a row", () => {
    expect(
      chatLoaderView({
        ...base,
        writingPath: "src/Board.tsx",
        liveAction: { kind: "create_file", label: "Created Board.tsx", meta: { path: "src/Board.tsx" } },
      }),
    ).toEqual({ kind: "writing", label: "Writing", detail: null, target: "src/Board.tsx" });
    const messages = [{ role: "user" as const }, { role: "ai" as const, actions: [read("a"), edit("b"), edit("c")] }];
    expect(chatLoaderView({ ...base, messages, liveAction: edit("c"), writingPath: "c" })).toEqual({
      kind: "writing",
      label: "Writing",
      detail: "2 files",
      target: "c",
    });
  });

  test("streaming text reads Writing", () => {
    expect(chatLoaderView({ ...base, streaming: true })).toEqual({ kind: "writing", label: "Writing", detail: null, target: null });
  });

  test("a new line waits out the shown one's hold, and its own minimum life", () => {
    // Shown for 200ms: the rest of the hold.
    expect(loaderSwapDelay(1_000, 1_200)).toBe(LOADER_MIN_HOLD_MS - 200);
    // Shown long ago: only the new line's minimum life.
    expect(loaderSwapDelay(1_000, 9_000)).toBe(LOADER_MIN_LIFE_MS);
    expect(isRunningView({ kind: "done", seconds: 1, actions: 0 })).toBe(false);
    expect(isRunningView(null)).toBe(false);
  });

  test("a stopped run offers a way back in until the user writes again", () => {
    const stopped = { ...base, isAiTyping: false, status: "cancelled" as const, messages: [{ role: "user" as const }, { role: "ai" as const }] };
    expect(chatLoaderView(stopped)).toEqual({ kind: "stopped" });
    expect(chatLoaderView({ ...stopped, messages: [...stopped.messages, { role: "user" }] })).toBeNull();
  });

  test("done reports time and this turn's actions, only for a run seen here", () => {
    const messages = [
      { role: "user" as const, actions: undefined },
      { role: "ai" as const, actions: [{ kind: "read_file" as const, label: "Opened a" }] },
      { role: "user" as const },
      { role: "ai" as const, actions: [{ kind: "edit_file" as const, label: "Edited b" }, { kind: "run_command" as const, label: "Ran a project check" }] },
      { role: "ai" as const, actions: [] },
    ];
    const done = { ...base, isAiTyping: false, status: "done" as const, messages, runEndedAt: 43_000 };
    expect(chatLoaderView(done)).toEqual({ kind: "done", seconds: 42, actions: 2 });
    // After a reload the start isn't known: say nothing rather than a wrong time.
    expect(chatLoaderView({ ...done, runStartedAt: null })).toBeNull();
    expect(turnActionCount(messages)).toBe(2);
  });

  test("action labels read in the present tense", () => {
    expect(liveActionLine({ kind: "list_dir", label: "Searched the project" })).toEqual({ verb: "Searching the project", target: null });
    expect(liveActionLine({ kind: "web_search", label: "Searched: vite config" })).toEqual({ verb: "Searching", target: "vite config" });
    expect(liveActionLine({ kind: "dispatch_verifier", label: "Reviewing how it looks" })).toEqual({ verb: "Reviewing how it looks", target: null });
  });

  test("time is mono-friendly elapsed, never a percent", () => {
    expect(formatElapsed(7)).toBe("0:07");
    expect(formatElapsed(125)).toBe("2:05");
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(125)).toBe("2m 5s");
  });
});
