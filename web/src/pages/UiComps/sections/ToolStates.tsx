import { DeployPipeline } from "@/src/components/motion/DeployPipeline";
import { PickerSkeleton } from "@/src/features/design/DesignPicker";
import { GithubListLoadError, GithubListLoading } from "@/src/features/project/GithubCollaborationPane";
import { GithubLoadError } from "@/src/features/project/GithubPane";

import { Section, Spec } from "../frame";
import { deploySteps } from "../fixtures";

const noop = () => {};

export function ToolStates() {
  return (
    <Section
      id="tools"
      eyebrow="screens · project › tools"
      title="Deploy, GitHub & design"
      description="The panes themselves (with their own skeletons and empty states) are under Scenarios → Tools tab."
    >
      <Spec wide label="Deploy · queued">
        <DeployPipeline steps={deploySteps(0)} console={{ done: [], current: "queued · waiting for a worker" }} />
      </Spec>
      <Spec wide label="Deploy · building">
        <DeployPipeline steps={deploySteps(2)} console={{ done: ["checking server and database", "ok"], current: "building app" }} />
      </Spec>
      <Spec wide label="Deploy · verifying">
        <DeployPipeline steps={deploySteps(5)} console={{ done: ["uploading 42 files", "setting up the server"], current: "verifying server health" }} />
      </Spec>
      <Spec wide label="Deploy · live">
        <DeployPipeline steps={deploySteps(7)} />
      </Spec>
      <Spec wide label="Deploy · build failed">
        <DeployPipeline steps={deploySteps(2, "failed")} />
      </Spec>
      <Spec wide label="Deploy · needs review">
        <DeployPipeline steps={deploySteps(4, "review")} />
      </Spec>
      <Spec wide label="Deploy · failed, stage unknown" note="a single step: no track to draw">
        <DeployPipeline steps={[{ id: "failed", label: "Deploy", detail: "The deployment failed before it reported a stage.", state: "failed" }]} />
      </Spec>

      <Spec label="GitHub · refresh failed">
        <GithubLoadError error={new Error("GitHub is not responding.")} onRetry={noop} />
      </Spec>
      <Spec label="GitHub · list loading">
        <GithubListLoading>Loading pull requests…</GithubListLoading>
      </Spec>
      <Spec label="GitHub · list failed">
        <GithubListLoadError error={new Error("GitHub could not load these results.")} onRetry={noop} />
      </Spec>

      <Spec wide label="Design picker · loading">
        <PickerSkeleton />
      </Spec>
    </Section>
  );
}
