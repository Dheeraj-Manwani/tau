import { LoaderCircleIcon, PowerOffIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { BUILD_PHASES, type BuildPhase } from "@/src/features/project/buildPhase";
import { PreviewFailedCard } from "@/src/features/project/PreviewFailedCard";
import { PreviewPlaceholder } from "@/src/features/project/PreviewPane";
import { PreviewStateCard } from "@/src/features/project/PreviewStateCard";
import { PreviewStoppedCard } from "@/src/features/project/PreviewStoppedCard";
import { getEmptyPreviewState } from "@/src/features/project/previewEmptyState";

import { Frame, Section, Spec } from "../frame";
import { PREVIEW_EMPTY_INPUTS } from "../fixtures";

const noop = () => {};
const PHASES: BuildPhase[] = [0, 1, 2, 3];
const BUILDING = getEmptyPreviewState(PREVIEW_EMPTY_INPUTS.find((s) => s.label === "Building")!.input);
const STOPPED_MODES = ["stopped", "restoring", "checking", "failed"] as const;

export function PreviewStates() {
  return (
    <Section
      id="preview"
      eyebrow="screens · project › preview"
      title="Preview"
      description="The no-iframe screens come from getEmptyPreviewState(), the same function PreviewPane uses."
    >
      {PREVIEW_EMPTY_INPUTS.map(({ label, input }) => {
        const state = getEmptyPreviewState(input);
        return (
          <Spec key={label} label={`Empty · ${label}`} note={`${state.tone}${state.animated ? " · animated" : ""}${state.loading ? " · loading" : ""}${state.action ? ` · action: ${state.action}` : ""}`}>
            <Frame height={state.animated ? 600 : 360}>
              <PreviewPlaceholder state={state} onAction={noop} phase={0} />
            </Frame>
          </Spec>
        );
      })}

      {PHASES.map((phase) => (
        <Spec key={phase} wide label={`Building · phase ${phase}`} note={BUILD_PHASES[phase]}>
          <Frame height={600}>
            <PreviewPlaceholder state={BUILDING} onAction={noop} phase={phase} />
          </Frame>
        </Spec>
      ))}

      {STOPPED_MODES.map((mode) => (
        <Spec key={mode} label={`Sandbox · ${mode}`} note="PreviewStoppedCard (resolvePreviewSurface)">
          <Frame height={300}>
            <PreviewStoppedCard mode={mode} onStart={noop} coverImageUrl={null} />
          </Frame>
        </Spec>
      ))}

      <Spec label="Frame failed · app crashed" note="PreviewFailedCard appError, canFix">
        <Frame height={300}>
          <PreviewFailedCard appError excerpt={"TypeError: Cannot read properties of undefined (reading 'map')\n    at HabitList (HabitList.tsx:4:18)"} onFix={noop} onReload={noop} canFix isSending={false} />
        </Frame>
      </Spec>
      <Spec label="Frame failed · fix being sent" note="isSending">
        <Frame height={300}>
          <PreviewFailedCard appError onFix={noop} onReload={noop} canFix isSending />
        </Frame>
      </Spec>
      <Spec label="Frame failed · never loaded" note="appError false, tau busy (canFix false)">
        <Frame height={300}>
          <PreviewFailedCard appError={false} onFix={noop} onReload={noop} canFix={false} isSending={false} />
        </Frame>
      </Spec>

      <Spec label="State card · neutral">
        <Frame height={260}>
          <PreviewStateCard icon={PowerOffIcon} title="Preview is asleep" description="Start it again from your saved files." actions={<Button><RotateCwIcon />Start</Button>} />
        </Frame>
      </Spec>
      <Spec label="State card · warning">
        <Frame height={260}>
          <PreviewStateCard icon={TriangleAlertIcon} tone="warning" title="Build may be stuck" description="Tau has been quiet for a while." />
        </Frame>
      </Spec>
      <Spec label="State card · error">
        <Frame height={260}>
          <PreviewStateCard icon={TriangleAlertIcon} tone="error" title="Tau hit a snag" description="Ask Tau to look over the work and try again." detail="sandbox: exit 137" />
        </Frame>
      </Spec>
      <Spec label="State card · busy">
        <Frame height={260}>
          <PreviewStateCard icon={LoaderCircleIcon} busy title="Restarting" description="Booting the sandbox from your files." role="status" />
        </Frame>
      </Spec>
    </Section>
  );
}
