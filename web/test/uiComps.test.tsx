import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import { chatLoaderView } from "@/src/features/project/chatLoaderState";
import { getEmptyPreviewState } from "@/src/features/project/previewEmptyState";
import { api, ApiError } from "@/src/lib/api-client";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { CHAT_LOADER_INPUTS, PREVIEW_EMPTY_INPUTS } from "@/src/pages/UiComps/fixtures";
import { installOfflineApi } from "@/src/pages/UiComps/mockApi";
import { applyScenario, resetScenario, SCENARIOS } from "@/src/pages/UiComps/scenarios";
import { AppStates } from "@/src/pages/UiComps/sections/AppStates";
import { ChatStates } from "@/src/pages/UiComps/sections/ChatStates";
import { ToolStates } from "@/src/pages/UiComps/sections/ToolStates";

// The dev-only /ui-comps gallery: its tiles must keep covering every state the
// product's state functions can produce, and it must never reach the API.

const realWindow = globalThis.window;
beforeAll(() => {
  // Bun has no DOM; the offline gate and scenarios only read these.
  globalThis.window = { location: { pathname: "/ui-comps", origin: "http://localhost" } } as unknown as Window & typeof globalThis;
});
afterAll(() => {
  globalThis.window = realWindow;
});

describe("gallery coverage", () => {
  test("shows every chat loader kind", () => {
    const kinds = new Set(CHAT_LOADER_INPUTS.map(({ input }) => chatLoaderView(input)?.kind));
    expect([...kinds].sort()).toEqual(["done", "stopped", "thinking", "working", "writing"]);
  });

  test("each empty-preview tile is a distinct state", () => {
    const states = PREVIEW_EMPTY_INPUTS.map(({ input }) => JSON.stringify(getEmptyPreviewState(input)));
    expect(new Set(states).size).toBe(states.length);
  });

  test("scenario ids are unique", () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("offline api", () => {
  installOfflineApi();

  test("refuses writes with a 503 instead of sending them", async () => {
    const error = await api.post("/project", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
  });

  test("leaves reads pending, so unseeded queries show their loading state", async () => {
    const outcome = await Promise.race([
      api.get("/credits/balance").then(() => "settled", () => "settled"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 50)),
    ]);
    expect(outcome).toBe("pending");
  });
});

describe("scenarios", () => {
  test("apply over a clean project and reset afterwards", () => {
    applyScenario(SCENARIOS.find((s) => s.id === "stalled")!);
    expect(useProjectStore.getState()).toMatchObject({ projectId: "ui-demo", status: "streaming", isStalled: true });

    applyScenario(SCENARIOS.find((s) => s.id === "empty")!);
    expect(useProjectStore.getState()).toMatchObject({ status: "idle", isStalled: false, chatMessages: [] });

    resetScenario();
    expect(useProjectStore.getState()).toMatchObject({ projectId: null, status: "idle", chatMessages: [] });
  });
});

describe("sections render", () => {
  test.each([
    ["app", AppStates],
    ["chat", ChatStates],
    ["tools", ToolStates],
  ] as const)("%s", (_, Section) => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Section />
      </MemoryRouter>,
    );
    expect(html).toContain("<section");
  });
});
