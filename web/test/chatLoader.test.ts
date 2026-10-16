import { describe, expect, test } from "bun:test";

import {
  chatLoaderView,
  formatDuration,
  formatElapsed,
  liveActionLine,
  turnActionCount,
  type ChatLoaderInput,
} from "@/src/features/project/chatLoaderState";

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

describe("chat loader state", () => {
  test("thinks before tau says or does anything", () => {
    expect(chatLoaderView(base)).toEqual({ kind: "thinking", label: "Thinking" });
    expect(chatLoaderView({ ...base, activity: "Queued" })).toEqual({ kind: "thinking", label: "Queued" });
    // "Working" is the store's placeholder between file events, not a label.
    expect(chatLoaderView({ ...base, activity: "Working" })).toEqual({ kind: "thinking", label: "Thinking" });
  });

  test("a running tool becomes the live action line", () => {
    const view = chatLoaderView({
      ...base,
      liveAction: { kind: "read_file", label: "Opened app.tsx", meta: { path: "src/app.tsx" } },
    });
    expect(view).toMatchObject({ kind: "working", verb: "Reading", target: "src/app.tsx" });
  });

  test("a file streaming in wins over the tool that asked for it", () => {
    expect(
      chatLoaderView({
        ...base,
        writingPath: "src/Board.tsx",
        liveAction: { kind: "create_file", label: "Created Board.tsx", meta: { path: "src/Board.tsx" } },
      }),
    ).toMatchObject({ kind: "working", verb: "Writing", target: "src/Board.tsx" });
  });

  test("streaming text settles the mark", () => {
    expect(chatLoaderView({ ...base, streaming: true })).toEqual({ kind: "writing" });
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
