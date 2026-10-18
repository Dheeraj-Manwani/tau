/**
 * Whole-pane scenarios: the project store as the job stream and the project
 * detail would leave it at one moment of a real run. One is live at a time,
 * because `useProjectStore` is a single global store.
 */
import type { QueryClient } from "@tanstack/react-query";

import { billingKeys } from "@/src/features/billing/api";
import { projectKeys } from "@/src/features/project/api";
import { OUT_OF_CREDITS_NOTICE } from "@/src/features/project/creditResume";
import { useProjectStore } from "@/src/stores/useProjectStore";

import {
  ACTIONS,
  balance,
  DEMO_PROJECT_ID,
  FILES,
  FINISHED_TURN,
  IN_PROGRESS_TURN,
  LONG_HISTORY,
  PLAN,
  PROMPT,
  QUESTION,
  SECRET_QUESTION,
} from "./fixtures";

type StoreState = ReturnType<typeof useProjectStore.getState>;

export interface Scenario {
  id: string;
  label: string;
  group: "Run" | "Preview" | "Project";
  store: Partial<StoreState>;
  /** Extra query data on top of the gallery's base seed. */
  seed?: (client: QueryClient) => void;
}

/** A working app the iframe can load: served by Vite in dev, never built. */
export function demoPreviewOrigin(): string {
  // globalThis: SCENARIOS is built at import, which the tests do without a DOM.
  return `${globalThis.location?.origin ?? "http://localhost"}/src/pages/UiComps`;
}
const DEMO_PREVIEW_PATH = "/demo-app.html";

const loaded: Partial<StoreState> = { hydrated: true, files: FILES, headSequence: 12 };
const running = (startedSecondsAgo = 38): Partial<StoreState> => ({
  ...loaded,
  status: "streaming",
  isAiTyping: true,
  buildStarted: true,
  currentJobId: "job-demo",
  runStartedAt: Date.now() - startedSecondsAgo * 1000,
  lastEventAt: Date.now(),
});
/** `state` is what the demo app reports through the real preview protocol. */
const withPreview = (state?: "build-error" | "crash"): Partial<StoreState> => ({
  previewUrl: demoPreviewOrigin(),
  previewPath: state ? `${DEMO_PREVIEW_PATH}?state=${state}` : DEMO_PREVIEW_PATH,
  openFiles: ["src/App.tsx", "src/components/HabitList.tsx"],
  activeFileId: "src/App.tsx",
});
const finished = (state?: "build-error" | "crash"): Partial<StoreState> => ({
  ...loaded,
  ...withPreview(state),
  status: "done",
  terminalOutcome: { kind: "done" },
  chatMessages: FINISHED_TURN,
  currentPlan: { ...PLAN, todos: PLAN.todos.map((t) => ({ ...t, status: "done" as const })) },
  runStartedAt: Date.now() - 154_000,
  runEndedAt: Date.now() - 2_000,
});
const alive = (value: boolean) => (client: QueryClient) =>
  client.setQueryData([...projectKeys.previewStatus(DEMO_PROJECT_ID), demoPreviewOrigin()], { alive: value });

const STREAMING_REPLY = {
  id: "m-streaming",
  role: "ai" as const,
  content: "Your habit tracker is coming together. Next I'll add the **streak counter** so each",
  timestamp: Date.now(),
};

export const SCENARIOS: Scenario[] = [
  { id: "loading", group: "Project", label: "Loading project", store: { hydrated: false } },
  { id: "empty", group: "Project", label: "Fresh project, nothing sent", store: { ...loaded, files: {} } },
  { id: "history", group: "Project", label: "Long chat history", store: { ...finished(), chatMessages: LONG_HISTORY } },

  { id: "thinking", group: "Run", label: "Thinking", store: { ...running(4), chatMessages: [PROMPT] } },
  {
    id: "working",
    group: "Run",
    label: "Working · running a command",
    store: { ...running(), chatMessages: IN_PROGRESS_TURN, currentPlan: PLAN, liveAction: ACTIONS.run! },
  },
  {
    id: "writing-file",
    group: "Run",
    label: "Writing a file",
    store: {
      ...running(),
      chatMessages: IN_PROGRESS_TURN,
      currentPlan: PLAN,
      writingPath: "src/components/HabitList.tsx",
      openFiles: ["src/components/HabitList.tsx"],
      activeFileId: "src/components/HabitList.tsx",
    },
  },
  {
    id: "streaming-text",
    group: "Run",
    label: "Streaming a reply",
    store: { ...running(), chatMessages: [...IN_PROGRESS_TURN, STREAMING_REPLY], streamingId: STREAMING_REPLY.id, currentPlan: PLAN },
  },
  {
    id: "question",
    group: "Run",
    label: "Asking a question",
    store: { ...running(), isAiTyping: false, chatMessages: IN_PROGRESS_TURN, pendingQuestion: QUESTION },
  },
  {
    id: "secret",
    group: "Run",
    label: "Asking for an API key",
    store: { ...running(), isAiTyping: false, chatMessages: IN_PROGRESS_TURN, pendingQuestion: SECRET_QUESTION },
  },
  {
    id: "stalled",
    group: "Run",
    label: "Stalled",
    store: { ...running(400), chatMessages: IN_PROGRESS_TURN, isStalled: true, activity: "Working" },
  },
  {
    id: "out-of-credits",
    group: "Run",
    label: "Paused: out of credits",
    store: {
      ...loaded,
      status: "done",
      terminalOutcome: { kind: "credits", reason: "balance" },
      chatMessages: [
        ...IN_PROGRESS_TURN,
        { id: "m-credits", role: "ai", content: `${OUT_OF_CREDITS_NOTICE}. Add credits to continue.`, timestamp: Date.now() },
      ],
    },
    seed: (client) => client.setQueryData(billingKeys.balance, balance(0)),
  },
  {
    id: "cancelled",
    group: "Run",
    label: "Stopped by you",
    store: { ...loaded, status: "cancelled", terminalOutcome: { kind: "cancelled" }, chatMessages: IN_PROGRESS_TURN, userCancelledJobId: "job-demo" },
  },
  {
    id: "error",
    group: "Run",
    label: "Run failed",
    store: {
      ...loaded,
      status: "error",
      terminalOutcome: { kind: "error", message: "The sandbox stopped responding." },
      chatMessages: IN_PROGRESS_TURN,
    },
  },

  { id: "live", group: "Preview", label: "Done, preview live", store: finished(), seed: alive(true) },
  { id: "checking", group: "Preview", label: "Checking the preview", store: finished() },
  { id: "stopped", group: "Preview", label: "Preview asleep", store: finished(), seed: alive(false) },
  { id: "restoring", group: "Preview", label: "Restarting the preview", store: { ...finished(), previewRestoring: true } },
  { id: "restore-failed", group: "Preview", label: "Restart failed", store: { ...finished(), previewRestoreFailed: true } },
  {
    id: "build-error",
    group: "Preview",
    label: "Didn't build (Dismiss → banner)",
    store: finished("build-error"),
    seed: alive(true),
  },
  { id: "crash", group: "Preview", label: "App crashed on start", store: finished("crash"), seed: alive(true) },
];

/** Reset to a clean project, then apply the scenario. */
export function applyScenario(scenario: Scenario): void {
  const store = useProjectStore.getState();
  // initProject skips the reset while "streaming" for the same id; clear first.
  useProjectStore.setState({ status: "idle" });
  store.initProject(DEMO_PROJECT_ID);
  useProjectStore.setState(scenario.store);
}

/** Leave nothing behind for a real project opened after the gallery. */
export function resetScenario(): void {
  useProjectStore.setState({ status: "idle" });
  useProjectStore.getState().initProject(`${DEMO_PROJECT_ID}-closed`);
  useProjectStore.setState({ projectId: null });
}
