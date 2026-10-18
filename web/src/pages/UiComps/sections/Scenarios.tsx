import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";

import { Segmented, SegmentedItem } from "@/src/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { projectKeys } from "@/src/features/project/api";
import { ChatPanel } from "@/src/features/project/ChatPanel";
import { RightPanel } from "@/src/features/project/RightPanel";

import { Section, Spec } from "../frame";
import { DEMO_PROJECT_ID, projectDetail } from "../fixtures";
import { GALLERY_PATH } from "../mockApi";
import { applyScenario, resetScenario, SCENARIOS, type Scenario } from "../scenarios";
import { MockScope } from "../scope";

type Layout = "workspace" | "chat";
const GROUPS = ["Project", "Run", "Preview"] as const;

/**
 * The real ChatPanel and RightPanel (preview, code, tools) on the project
 * store as a scenario leaves it. Only the panes mount, never ProjectPage, so
 * nothing opens the job stream.
 */
export function Scenarios() {
  const [scenario, setScenario] = useState<Scenario>(() => {
    const first = SCENARIOS.find((s) => s.id === "working")!;
    // Before the first paint, so the panes never render the previous state.
    applyScenario(first);
    return first;
  });
  const [layout, setLayout] = useState<Layout>("workspace");

  // Applied here as well as on select: StrictMode's remount runs the reset.
  useEffect(() => {
    applyScenario(scenario);
    return resetScenario;
  }, [scenario]);

  const choose = (id: string) => {
    const next = SCENARIOS.find((s) => s.id === id);
    if (!next) return;
    applyScenario(next);
    setScenario(next);
  };

  const panes =
    layout === "workspace" ? (
      <div className="flex h-[760px] min-w-0 overflow-hidden rounded-md border border-line bg-space-void">
        <div className="w-[400px] shrink-0 border-r border-line">
          <ChatPanel />
        </div>
        <div className="min-w-0 flex-1">
          <RightPanel />
        </div>
      </div>
    ) : (
      <div className="flex h-[760px] justify-center overflow-hidden rounded-md border border-line bg-space-void px-6">
        <div className="h-full w-full max-w-[672px]">
          <ChatPanel showCollapse={false} />
        </div>
      </div>
    );

  return (
    <Section
      id="scenarios"
      eyebrow="screens · project, whole panes"
      title="Scenarios"
      description="One scenario at a time: the project store is global. Everything inside is the real pane; switch tabs (Preview, Code, Tools) inside it as usual. Writes are refused offline."
    >
      <Spec wide label="Workspace">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={scenario.id} onValueChange={choose}>
            <SelectTrigger className="w-72" aria-label="Scenario">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUPS.map((group, i) => [
                i > 0 && <SelectSeparator key={`${group}-sep`} />,
                ...SCENARIOS.filter((s) => s.group === group).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {group} · {s.label}
                  </SelectItem>
                )),
              ])}
            </SelectContent>
          </Select>
          <Segmented value={layout} onValueChange={(v) => v && setLayout(v as Layout)} aria-label="Layout">
            <SegmentedItem value="workspace">Chat + workspace</SegmentedItem>
            <SegmentedItem value="chat">First build (chat only)</SegmentedItem>
          </Segmented>
        </div>
        <MockScope
          key={scenario.id}
          seed={(client) => {
            client.setQueryData(projectKeys.detail(DEMO_PROJECT_ID), projectDetail(scenario.store.status === "streaming"));
            scenario.seed?.(client);
          }}
        >
          {/* ChatPanel reads the project id from the route. */}
          <Routes location={`${GALLERY_PATH}/project/${DEMO_PROJECT_ID}`}>
            <Route path="project/:id" element={panes} />
          </Routes>
        </MockScope>
      </Spec>
    </Section>
  );
}
