import { useState } from "react";

import { Button } from "@/src/components/ui/button";
import { billingKeys } from "@/src/features/billing/api";
import { OutOfCreditsModal } from "@/src/features/billing/OutOfCreditsModal";
import { UpgradeModal } from "@/src/features/billing/UpgradeModal";
import { useBillingStore } from "@/src/features/billing/useBillingStore";
import { useUpgradeModalStore } from "@/src/features/billing/useUpgradeModalStore";
import { FeedbackModal } from "@/src/features/feedback/FeedbackModal";
import { useFeedbackStore } from "@/src/features/feedback/useFeedbackStore";
import { GamesModal } from "@/src/features/project/GamesModal";
import { getGamesStatus, type GamesStatus } from "@/src/features/project/gamesStatus";
import { SettingsModal } from "@/src/features/settings/SettingsModal";
import { SupportTauModal } from "@/src/features/support/SupportTauModal";
import { useSupportStore } from "@/src/features/support/useSupportStore";
import { useSettingsStore } from "@/src/stores/useSettingsStore";

import { Row, Section, Spec } from "../frame";
import { balance, PREVIEW_EMPTY_INPUTS } from "../fixtures";
import { MockScope } from "../scope";

const building = PREVIEW_EMPTY_INPUTS.find((s) => s.label === "Building")!.input;
const GAMES: { label: string; status: GamesStatus }[] = [
  { label: "tau working", status: getGamesStatus({ ...building, hasPreview: false }) },
  { label: "done, preview ready", status: getGamesStatus({ ...building, status: "done", hasPreview: true }) },
  { label: "needs you", status: getGamesStatus({ ...building, waitingForAnswer: true, hasPreview: false }) },
];

/** The app-wide modals, mounted here as AppShell mounts them. */
export function Modals() {
  const [games, setGames] = useState<GamesStatus | null>(null);
  return (
    <Section id="modals" eyebrow="screens · overlays" title="Modals">
      <MockScope seed={(client) => client.setQueryData(billingKeys.balance, balance(0))}>
        <Spec wide label="App modals" note="real components, fed from fixtures; writes fail offline">
          <Row>
            <Button variant="secondary" onClick={() => useBillingStore.getState().open()}>Out of credits</Button>
            <Button variant="secondary" onClick={() => useUpgradeModalStore.getState().openModal()}>Upgrade</Button>
            <Button variant="secondary" onClick={() => useSettingsStore.getState().openSettings()}>Settings</Button>
            <Button variant="secondary" onClick={() => useFeedbackStore.getState().open("account")}>Feedback</Button>
            <Button variant="secondary" onClick={() => useSupportStore.getState().open()}>Support tau</Button>
          </Row>
        </Spec>
        <OutOfCreditsModal />
        <UpgradeModal />
        <SettingsModal />
        <FeedbackModal />
        <SupportTauModal />
      </MockScope>
      <Spec wide label="Games while building" note="status from getGamesStatus()">
        <Row>
          {GAMES.map(({ label, status }) => (
            <Button key={label} variant="secondary" onClick={() => setGames(status)}>
              {label}
            </Button>
          ))}
        </Row>
        {games && <GamesModal open onOpenChange={(open) => !open && setGames(null)} status={games} />}
      </Spec>
    </Section>
  );
}
