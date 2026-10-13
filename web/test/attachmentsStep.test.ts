import { describe, expect, test } from "bun:test";
import { useProjectStore } from "../src/stores/useProjectStore";
import type { ProjectDetail, ProjectMessage } from "../src/features/project/types";
import type { MessageAttachment } from "../src/features/composer/attachments/types";

// tau reads what was attached before the agent's first turn and reports it as
// a step. The step is in no stored tool call, so it reaches the chat two ways:
// as an event while it happens, and worked out from the message's files when
// the conversation is loaded again.

const file = (over: Partial<MessageAttachment> = {}): MessageAttachment => ({
  id: "a1",
  kind: "IMAGE",
  status: "READY",
  filename: "mock-up.png",
  mimeType: "image/png",
  sizeBytes: 10,
  extractionError: null,
  preview: null,
  ...over,
});

const userRow = (attachments: MessageAttachment[], sequence = 1): ProjectMessage => ({
  id: `u${sequence}`,
  role: "USER",
  type: "USER",
  content: [{ type: "text", text: "make it like this" }],
  sequence,
  createdAt: "2026-10-13T00:00:00Z",
  attachments,
});

const toolRow = (name: string, args: object, sequence: number): ProjectMessage => ({
  id: `t${sequence}`,
  role: "ASSISTANT",
  type: "TOOL_REQ",
  content: { content: null, tool_calls: [{ id: `call${sequence}`, function: { name, arguments: JSON.stringify(args) } }] },
  sequence,
  createdAt: "2026-10-13T00:00:05Z",
});

function load(id: string, messages: ProjectMessage[]) {
  const detail: ProjectDetail = {
    project: { id, name: "Test", description: null, tags: [], sandboxStatus: "NONE", workspaceStartedAt: null, previewImageUrl: null },
    messages,
    latestFragment: null,
    activeJobId: null,
    activeJobEventIndex: null,
    jobState: null,
    checkpoints: [],
  } as unknown as ProjectDetail;
  useProjectStore.getState().initProject(id);
  useProjectStore.getState().hydrate(detail);
  return useProjectStore.getState().chatMessages;
}

describe("the step for looking at attached files", () => {
  test("arrives live as a step of its own, named for the file", () => {
    useProjectStore.getState().initProject("live-one");
    useProjectStore.getState().appendUserMessage("make it like this", [file()]);
    useProjectStore.getState().applyEvent({
      type: "tool_req",
      index: 1,
      toolName: "read_attachments",
      toolCallId: "attachments_u1",
      input: { files: ["mock-up.png"] },
    });

    const messages = useProjectStore.getState().chatMessages;
    expect(messages.map((m) => m.role)).toEqual(["user", "ai"]);
    expect(messages[1].actions).toEqual([{ kind: "read_attachments", label: "Looked at mock-up.png" }]);
  });

  test("several files are counted, and its result changes nothing", () => {
    useProjectStore.getState().initProject("live-many");
    useProjectStore.getState().appendUserMessage("these", [file(), file({ id: "a2", filename: "logo.png" })]);
    useProjectStore.getState().applyEvent({ type: "tool_req", index: 1, toolName: "read_attachments", toolCallId: "attachments_u1", input: { files: ["mock-up.png", "logo.png"] } });
    useProjectStore.getState().applyEvent({ type: "tool_res", index: 2, toolCallId: "attachments_u1", output: { read: 2, failed: 0 } });

    const actions = useProjectStore.getState().chatMessages[1].actions ?? [];
    expect(actions.map((a) => a.label)).toEqual(["Looked at 2 attached files"]);
  });

  test("is there again after a reload, first in the reply, with the agent's own steps after it", () => {
    const messages = load("reload", [userRow([file()]), toolRow("read_file", { path: "src/App.tsx" }, 2)]);
    expect(messages.map((m) => m.role)).toEqual(["user", "ai"]);
    expect((messages[1].actions ?? []).map((a) => a.kind)).toEqual(["read_attachments", "read_file"]);
    expect(messages[1].actions![0].label).toBe("Looked at mock-up.png");
  });

  test("a file tau could not read still had the step", () => {
    const messages = load("reload-failed", [userRow([file({ status: "FAILED", extractionError: "unreadable" })])]);
    expect(messages[1].actions?.[0].kind).toBe("read_attachments");
  });

  test("files that are still waiting, pasted text, and messages without files show no step", () => {
    expect(load("waiting", [userRow([file({ status: "PENDING" })])]).map((m) => m.role)).toEqual(["user"]);
    expect(load("pasted", [userRow([file({ kind: "PASTED", filename: "Pasted content" })])]).map((m) => m.role)).toEqual(["user"]);
    expect(load("none", [userRow([])]).map((m) => m.role)).toEqual(["user"]);
  });

  test("only the files count toward the label, not a paste sent with them", () => {
    const messages = load("mixed", [userRow([file({ kind: "PASTED", filename: "Pasted content" }), file({ id: "a2" }), file({ id: "a3", filename: "logo.png" })])]);
    expect(messages[1].actions?.[0].label).toBe("Looked at 2 attached files");
  });
});
