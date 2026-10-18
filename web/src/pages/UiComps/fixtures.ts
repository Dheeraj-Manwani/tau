/**
 * Sample data for /ui-comps. Typed against the real API and store shapes, so
 * a changed response shape breaks the gallery at compile time instead of
 * quietly showing a state the product can no longer reach.
 */
import type { AuthUser } from "@/src/features/auth/types";
import type { BalanceSummary, CreditPack, SpendSummary } from "@/src/features/billing/api";
import type { ChatLoaderInput } from "@/src/features/project/chatLoaderState";
import type { DeployStep } from "@/src/features/project/deployPresentation";
import type { EmptyPreviewInput } from "@/src/features/project/previewEmptyState";
import type { ListProjectsResponse, PendingQuestion, ProjectDetail, ProjectListItem } from "@/src/features/project/types";
import type { ActionItem, Message, Plan, ProjectFile } from "@/src/stores/useProjectStore";

export const DEMO_PROJECT_ID = "ui-demo";
const NOW = Date.now();
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

export function demoUser(reduceMotion = false): AuthUser {
  return {
    id: "user-demo",
    email: "demo@tau.local",
    emailVerifiedAt: iso(86_400_000),
    role: "USER",
    createdAt: iso(30 * 86_400_000),
    preferences: { reduceMotion, hasSeenMotionIntro: true },
    displayName: "Demo",
    avatarPath: null,
  };
}

export function balance(available: number, plan: BalanceSummary["plan"] = "FREE"): BalanceSummary {
  const micro = (n: number) => String(n * 1_000_000);
  return {
    plan,
    cycleEnd: plan === "PRO" ? iso(-14 * 86_400_000) : null,
    effortCeilings: { LOW: 20, HIGH: 60, MAX: 120 },
    credits: { available, free: Math.min(available, 50), plan: plan === "PRO" ? available : 0, bonus: 0, reserved: 0 },
    micro: { available: micro(available), free: micro(Math.min(available, 50)), plan: micro(0), bonus: "0", reserved: "0" },
  };
}

export const PACKS: CreditPack[] = [
  { id: "pack-200", credits: 200, price: { amount: 49900, currency: "INR" } },
  { id: "pack-500", credits: 500, price: { amount: 99900, currency: "INR" } },
  { id: "pack-1500", credits: 1500, price: { amount: 249900, currency: "INR" } },
];

export const SPEND: SpendSummary = {
  windowDays: 30,
  since: iso(30 * 86_400_000),
  build: { credits: 312, microCredits: "312000000" },
  runtime: {
    credits: 48,
    microCredits: "48000000",
    requests: 1290,
    inputTokens: 1_840_000,
    outputTokens: 402_000,
    byModel: [
      { alias: "fast", requests: 1100, credits: 21 },
      { alias: "smart", requests: 190, credits: 27 },
    ],
  },
  total: { credits: 360, microCredits: "360000000" },
};

function project(i: number, name: string): ProjectListItem {
  return {
    id: `p-${i}`,
    name,
    description: i % 2 ? "A small app tau built for the gallery." : null,
    tags: i % 3 === 0 ? ["demo"] : [],
    instructions: null,
    sandboxStatus: "RUNNING",
    createdAt: iso(i * 3_600_000),
    updatedAt: iso(i * 1_800_000),
    previewImageUrl: null,
  };
}

const NAMES = ["Habit tracker", "Recipe box", "Portfolio", "Invoice maker", "Weather board", "Pomodoro"];

export function projectsPage(count: number, total = count): ListProjectsResponse {
  return { projects: NAMES.slice(0, count).map((n, i) => project(i + 1, n)), nextCursor: total > count ? "next" : null, total };
}

/** What ChatPanel's header reads from the cache (the project name, job flag). */
export function projectDetail(activeJob: boolean): ProjectDetail {
  return {
    project: {
      id: DEMO_PROJECT_ID,
      name: "Habit tracker",
      description: "A daily habit tracker with streaks.",
      tags: ["demo"],
      instructions: null,
      sandboxStatus: "RUNNING",
      workspaceStartedAt: iso(600_000),
      previewImageUrl: null,
    },
    messages: [],
    latestFragment: null,
    activeJobId: activeJob ? "job-demo" : null,
    activeJobEventIndex: null,
    jobState: null,
    checkpoints: [],
    contextUsage: { tokensUsed: 38_000, tokensBudget: 200_000, usagePercent: 19 },
  };
}

// ── The run ──────────────────────────────────────────────────────────────────

export const ACTIONS: Record<string, ActionItem> = {
  read: { kind: "read_file", label: "Opened App.tsx", meta: { path: "src/App.tsx" } },
  create: { kind: "create_file", label: "Created HabitList.tsx", meta: { path: "src/components/HabitList.tsx" } },
  edit: { kind: "edit_file", label: "Edited index.css", meta: { path: "src/index.css" } },
  run: { kind: "run_command", label: "Ran npm run build" },
  search: { kind: "web_search", label: "Searched: habit tracker streak design" },
  images: { kind: "search_images", label: "Searched images: calm morning desk" },
  check: { kind: "check_sandbox", label: "Checked the preview" },
  verify: { kind: "dispatch_verifier", label: "Checked the app works" },
};

export const PLAN: Plan = {
  name: "Habit tracker",
  description: "A daily habit tracker with streaks and a weekly view.",
  todos: [
    { sno: 1, label: "Set up the layout and theme", status: "done" },
    { sno: 2, label: "Habit list with add and complete", status: "done" },
    { sno: 3, label: "Streak counter", status: "pending" },
    { sno: 4, label: "Weekly heatmap", status: "pending" },
  ],
};

let seq = 0;
const msg = (role: Message["role"], content: string, actions?: ActionItem[]): Message => ({
  id: `m-${++seq}`,
  role,
  content,
  timestamp: NOW - (20 - seq) * 15_000,
  ...(actions ? { actions } : {}),
});

export const PROMPT = msg("user", "Build me a habit tracker with streaks and a weekly heatmap.");

/** One finished turn: the prompt, narration with action chips, a summary. */
export const FINISHED_TURN: Message[] = [
  PROMPT,
  msg("ai", "I'll set up the layout first, then the habit list.", [
    { kind: "create_plan", label: PLAN.name, meta: { description: PLAN.description, todos: PLAN.todos } },
    ACTIONS.read!,
    ACTIONS.create!,
    ACTIONS.edit!,
  ]),
  msg("ai", "Now the build and a check that it runs.", [ACTIONS.run!, ACTIONS.check!, ACTIONS.verify!]),
  msg(
    "ai",
    "Your habit tracker is ready.\n\n- **Add habits** from the box at the top\n- Tick one off to grow its **streak**\n- The heatmap shows the last 7 days",
  ),
];

export const IN_PROGRESS_TURN: Message[] = [PROMPT, msg("ai", "I'll set up the layout first.", [ACTIONS.read!, ACTIONS.create!])];

export const LONG_HISTORY: Message[] = [
  ...FINISHED_TURN,
  msg("user", "Make the heatmap green and add a dark mode."),
  msg("ai", "Done: the heatmap uses a green scale, and the theme follows your system.", [ACTIONS.edit!, ACTIONS.run!]),
  msg("user", "Can you add reminders?"),
  msg("ai", "Reminders need notifications permission, so I added a toggle in Settings that asks first.", [
    ACTIONS.search!,
    ACTIONS.create!,
    ACTIONS.edit!,
  ]),
];

export const QUESTION: PendingQuestion = {
  id: "q-1",
  question: "Should habits reset at midnight or 4am?",
  options: ["Midnight", "4am", "Let me pick in settings"],
};

export const SECRET_QUESTION: PendingQuestion = {
  id: "q-2",
  question: "This app sends reminder emails. Add your Resend API key to continue.",
  options: [],
  secrets: [{ name: "RESEND_API_KEY", label: "Resend API key", description: "Starts with re_", url: "https://resend.com/api-keys" }],
};

// ── State-function inputs: each becomes a tile ───────────────────────────────

const loaderBase: ChatLoaderInput = {
  isAiTyping: true,
  status: "streaming",
  streaming: false,
  writingPath: null,
  activity: null,
  liveAction: null,
  messages: IN_PROGRESS_TURN,
  runStartedAt: NOW - 42_000,
  runEndedAt: null,
};

export const CHAT_LOADER_INPUTS: { label: string; input: ChatLoaderInput }[] = [
  { label: "Thinking", input: loaderBase },
  { label: "Thinking · named activity", input: { ...loaderBase, activity: "Planning the layout" } },
  { label: "Working · reading a file", input: { ...loaderBase, liveAction: ACTIONS.read! } },
  { label: "Working · running a command", input: { ...loaderBase, liveAction: ACTIONS.run! } },
  { label: "Working · web search", input: { ...loaderBase, liveAction: ACTIONS.search! } },
  { label: "Working · writing a file", input: { ...loaderBase, writingPath: "src/components/HabitList.tsx" } },
  { label: "Writing text", input: { ...loaderBase, streaming: true } },
  { label: "Stopped", input: { ...loaderBase, isAiTyping: false, status: "cancelled" } },
  {
    label: "Done",
    input: { ...loaderBase, isAiTyping: false, status: "done", messages: FINISHED_TURN, runEndedAt: NOW - 1_000 },
  },
];

const previewBase: EmptyPreviewInput = {
  status: "idle",
  hydrated: true,
  activity: null,
  isStalled: false,
  waitingForAnswer: false,
  interruptedForCredits: false,
  availableCredits: 120,
};

export const PREVIEW_EMPTY_INPUTS: { label: string; input: EmptyPreviewInput }[] = [
  { label: "No preview yet", input: previewBase },
  { label: "Loading project", input: { ...previewBase, hydrated: false } },
  { label: "Building", input: { ...previewBase, status: "streaming", activity: "tau is designing the layout" } },
  { label: "Waiting for an answer", input: { ...previewBase, status: "streaming", waitingForAnswer: true } },
  { label: "Stalled", input: { ...previewBase, status: "streaming", isStalled: true } },
  { label: "Paused · checking credits", input: { ...previewBase, interruptedForCredits: true, availableCredits: undefined } },
  { label: "Paused · out of credits", input: { ...previewBase, interruptedForCredits: true, availableCredits: 0 } },
  { label: "Paused · credits restored", input: { ...previewBase, interruptedForCredits: true, availableCredits: 200 } },
  { label: "Stopped", input: { ...previewBase, status: "cancelled" } },
  { label: "Error", input: { ...previewBase, status: "error" } },
  { label: "Done without a preview", input: { ...previewBase, status: "done" } },
];

// ── Deploy ───────────────────────────────────────────────────────────────────

const STAGES = ["Queue", "Check", "Build", "Upload", "Server", "Verify", "Live"];

export function deploySteps(activeAt: number, end?: "failed" | "review"): DeployStep[] {
  return STAGES.map((label, i) => ({
    id: label.toLowerCase(),
    label,
    detail: i === activeAt && end === "failed" ? "The build exited with code 1." : i === activeAt && end === "review" ? "The database schema changed. Review before going live." : "",
    state: i < activeAt ? "done" : i === activeAt ? (end ?? "active") : "pending",
  }));
}

// ── Code ─────────────────────────────────────────────────────────────────────

export const FILES: Record<string, ProjectFile> = Object.fromEntries(
  (
    [
      ["index.html", '<!doctype html>\n<html lang="en">\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n'],
      ["package.json", '{\n  "name": "habit-tracker",\n  "private": true,\n  "type": "module"\n}\n'],
      ["src/main.tsx", 'import { createRoot } from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\n\ncreateRoot(document.getElementById("root")!).render(<App />);\n'],
      [
        "src/App.tsx",
        'import { HabitList } from "./components/HabitList";\n\nexport default function App() {\n  return (\n    <main className="mx-auto max-w-xl p-6">\n      <h1 className="text-2xl font-semibold">Habits</h1>\n      <HabitList />\n    </main>\n  );\n}\n',
      ],
      ["src/components/HabitList.tsx", 'export function HabitList() {\n  return <ul className="mt-6 space-y-2" />;\n}\n'],
      ["src/index.css", '@import "tailwindcss";\n\n:root {\n  color-scheme: dark;\n}\n'],
    ] as const
  ).map(([path, content]) => [path, { path, content, savedHash: "demo" }]),
);
