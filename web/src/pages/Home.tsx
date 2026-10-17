import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import toast from "react-hot-toast";

import { useDocumentMeta } from "@/src/components/useDocumentMeta";
import { PromptComposer } from "@/src/features/composer/PromptComposer";
import { useAttachments } from "@/src/features/composer/attachments/useAttachments";
import { ComposerSettings } from "@/src/features/composer/ComposerSettings";
import { useEffortChoice } from "@/src/features/composer/useEffortChoice";
import { DesignDialog } from "@/src/features/design/DesignDialog";
import {
  compactConfig,
  countChoices,
  designLabel,
  sameDesign,
  useDesignCatalog,
  type DesignConfig,
} from "@/src/features/design/api";
import { MyProjects } from "@/src/features/project/MyProjects";
import { CommunityProjects } from "@/src/features/project/CommunityProjects";
import { HomeFooter } from "@/src/components/HomeFooter";
import { useInitProject, useProjects } from "@/src/features/project/api";
import { markFreshBuild } from "@/src/features/project/revealSession";
import { showConcurrentJobLimitToast } from "@/src/features/project/concurrencyToast";
import { ApiError } from "@/src/lib/api-client";
import { projectPath } from "@/src/lib/routes";
import { clearPendingPrompt, peekPendingPrompt } from "@/src/lib/promptHandoff";
import { useBillingStore } from "@/src/features/billing/useBillingStore";
import { useBalance } from "@/src/features/billing/api";
import { DataSpinner } from "@/src/components/ui/data-spinner";
import { StormCanvas } from "@/src/components/StormCanvas";
// import { LightningComposer } from "@/src/features/composer/LightningComposer";
import { AmbienceSwitches } from "@/src/components/AmbienceSwitches";
import { shouldShowAmbienceHint } from "@/src/lib/ambienceHint";
import { useLoopingAudio } from "@/src/hooks/useLoopingAudio";
import { useThunder } from "@/src/hooks/useThunder";
import { stormSounds } from "@/src/lib/thunder";
import { useSettingsStore } from "@/src/stores/useSettingsStore";
import { env } from "@/src/lib/env";
import { useReduceMotion } from "@/src/hooks/useReduceMotion";
import { useSettings } from "@/src/hooks/useSettings";
import { cn } from "@/src/lib/utils";

// Free plan may own at most this many concurrent projects (mirrors
// FREE_PLAN_MAX_PROJECTS in api/src/lib/pricing.ts). PRO is unlimited.
const FREE_PLAN_MAX_PROJECTS = 3;

const SUGGESTIONS = [
  "Build me a personal finance dashboard with charts…",
  "Create a landing page for my coffee shop…",
  "Make a kanban board with drag-and-drop…",
  "Design a portfolio site with a blog…",
  "Build a real-time chat app with rooms…",
  "Spin up an admin panel for my store…",
];

function Home() {
  useDocumentMeta({ title: "Tau", exactTitle: true, noIndex: true });

  const navigate = useNavigate();
  const initProject = useInitProject();
  const openOutOfCredits = useBillingStore((s) => s.open);
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: balance, isLoading: balanceLoading } = useBalance();
  // If they described their idea on the landing page before signing up, it is
  // waiting for them here. Read without consuming (StrictMode may run this
  // initializer twice); the effect below retires it once we're mounted.
  const [prompt, setPrompt] = useState(() => peekPendingPrompt() ?? "");
  const [suggestion, setSuggestion] = useState(0);
  const [initializing, setInitializing] = useState(false);
  const attachments = useAttachments();
  // The look chosen for this project. Null until the user touches the picker,
  // and the composer then shows their default look, if they have set one in
  // Settings. A choice made here is not carried to the next project: a style
  // picked for a bakery should not quietly dress the next dashboard.
  const [chosenDesign, setChosenDesign] = useState<DesignConfig | null>(null);
  const { defaultDesign, setDefaultDesign, hasSeenMotionIntro } = useSettings();
  const design: DesignConfig = chosenDesign ?? defaultDesign ?? {};
  const catalog = useDesignCatalog();
  const [designOpen, setDesignOpen] = useState(false);
  // The storm's rain splashes against the composer's top edge.
  const composerRef = useRef<HTMLDivElement>(null);
  const composer = useCallback(() => composerRef.current, []);
  const isSubmitting = initProject.isPending;
  // Otherwise the suggestion carousel animates over the chip rail.
  const showPlaceholder =
    prompt.length === 0 && attachments.attachments.length === 0;

  // Proactively surface the free-plan project cap instead of only failing on
  // submit with a 403. PRO users are unlimited, so only gate FREE.
  const isFreePlan = (balance?.plan ?? "FREE") === "FREE";
  const limitsLoading = projectsLoading || balanceLoading;
  const projectCount = projects?.length ?? 0;
  const atProjectLimit = isFreePlan && projectCount >= FREE_PLAN_MAX_PROJECTS;

  // Shared with the project composer and the visual-edit inspector.
  const { effort, setEffort } = useEffortChoice();
  // Covers both the OS setting and the in-app Settings toggle: the
  // placeholder's stutter-in and rotation defer to it (the CSS loops stop
  // on their own).
  const reduceMotion = useReduceMotion();
  // Rain, lightning and the soundtrack, switched from above the composer.
  const ambience = useSettingsStore((s) => s.ambience);
  const setAmbience = useSettingsStore((s) => s.setAmbience);
  // With Sound on: the music, plus the storm's rain bed and thunder when those
  // switches are on too. The storm sits under the music.
  const audible = stormSounds({ ...ambience, reduceMotion });
  useLoopingAudio(env.AUDIO_URL, ambience.sound, 0.35);
  useLoopingAudio(env.RAIN_AUDIO_URL, audible.rain, 0.25);
  const onStrike = useThunder(env.THUNDER_AUDIO_URLS, audible.thunder);
  // A one-time callout pointing at those switches, once the page has settled.
  const ambienceHintSeen = useSettingsStore((s) => s.ambienceHintSeen);
  const markAmbienceHintSeen = useSettingsStore((s) => s.markAmbienceHintSeen);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), 1500);
    return () => window.clearTimeout(id);
  }, []);

  // A prefilled prompt is a one-time welcome, not a sticky draft.
  useEffect(() => clearPendingPrompt(), []);

  // Cycle through suggestions while the input is empty. Same 4s cadence as
  // landing's StormComposer - which, like here, just shows the first
  // suggestion statically under reduced motion rather than rotating it.
  useEffect(() => {
    if (!showPlaceholder || isSubmitting || reduceMotion) return;
    const id = setInterval(
      () => setSuggestion((i) => (i + 1) % SUGGESTIONS.length),
      4000,
    );
    return () => clearInterval(id);
  }, [showPlaceholder, isSubmitting, reduceMotion]);

  const submit = () => {
    const message = prompt.trim();
    const attachmentIds = attachments.readyIds;
    if ((message.length === 0 && attachmentIds.length === 0) || isSubmitting)
      return;
    if (attachments.isBusy) return;
    if (atProjectLimit) {
      toast.error(
        "You've reached the free plan limit of 3 projects. Delete one or upgrade to Pro to create more.",
      );
      return;
    }
    setInitializing(true);
    // Create the project + enqueue the first job, then hand off to the project
    // route. The prompt + jobId ride along in router state so the workspace can
    // show the message and subscribe to the live stream immediately.
    initProject.mutate(
      {
        message,
        effort,
        attachmentIds,
        // What the composer shows is what is sent. Untouched and empty is left
        // out, so the server applies the default look itself (it may not have
        // loaded here yet). Emptied by hand is sent empty: that is the user
        // saying "not my default, let tau decide".
        design: compactConfig(design) ?? (chosenDesign ? {} : undefined),
      },
      {
        onSuccess: ({ projectId, jobId }) => {
          attachments.clear();
          setChosenDesign(null);
          // Flag this project so its page plays the centered → split reveal once.
          markFreshBuild(projectId);
          navigate(projectPath(projectId), {
            state: { jobId, prompt: message },
          });
        },
        onError: (err) => {
          setInitializing(false);
          if (err instanceof ApiError && err.status === 402) {
            openOutOfCredits();
          } else if (err instanceof ApiError && err.status === 429) {
            showConcurrentJobLimitToast();
          } else if (
            err instanceof ApiError &&
            err.message === "PROJECT_LIMIT_REACHED"
          ) {
            toast.error(
              "You've reached the free plan limit of 3 projects. Delete one or upgrade to Pro to create more.",
            );
          } else {
            toast.error(
              err instanceof ApiError
                ? err.message
                : "Couldn't start your project",
            );
          }
        },
      },
    );
  };

  return (
    // Tier A (boards/Home.dc.html): the rain, the tube-lit "to build?" and the
    // glitching placeholder belong here. The composer itself stays a tool.
    <div className="relative h-full overflow-x-hidden overflow-y-auto">
      <StormCanvas
        target={composer}
        rain={ambience.rain}
        lightning={ambience.lightning}
        onStrike={onStrike}
      />
      <div className="relative mx-auto flex w-full max-w-[976px] flex-col px-6 pt-20">
        <section className="flex flex-col items-center gap-9 pt-16 sm:pt-[104px]">
          <div className="flex flex-col items-center gap-[22px] text-center">
            <p className="eyebrow">— Describe it. Build it. —</p>
            <h1 className="text-[clamp(52px,10vw,112px)] tracking-[-0.005em] [text-shadow:0_0_40px_rgba(255,255,255,0.08)]">
              What do you want
              <br />
              <span className="tube">to build?</span>
            </h1>
          </div>

          <div className="relative w-full max-w-[848px] text-left">
            {/* Out of flow: floats in the hero gap instead of adding a row. */}
            <div className="absolute right-0 bottom-full mb-1.5">
              <AmbienceSwitches
                value={ambience}
                onChange={setAmbience}
                reduceMotion={reduceMotion}
                hasSound={Boolean(env.AUDIO_URL)}
                hint={shouldShowAmbienceHint({
                  seen: ambienceHintSeen,
                  motionIntroSeen: hasSeenMotionIntro,
                  settled,
                  blocked: designOpen,
                })}
                onHintDismiss={markAmbienceHintSeen}
              />
            </div>
            <div ref={composerRef}>
              {/* Lightning border on MAX effort, switched off for now.
              <LightningComposer
                active={effort === "MAX" && ambience.lightning}
              > */}
              <PromptComposer
                value={prompt}
                onChange={setPrompt}
                onSubmit={submit}
                isSubmitting={isSubmitting}
                disabled={atProjectLimit}
                minRows={2}
                maxRows={12}
                submitLabel="Build"
                ariaLabel="Describe what you want to build"
                attachments={attachments.attachments}
                onAttach={(files) => attachments.addFiles(files)}
                onRemoveAttachment={attachments.remove}
                onPasteLarge={attachments.addPaste}
                attachmentsBusy={attachments.isBusy}
                controls={
                  <ComposerSettings
                    effort={effort}
                    onEffortChange={setEffort}
                    disabled={atProjectLimit || isSubmitting}
                    // Hidden where the server builds on the older templates
                    // (`catalog.enabled`): a choice there would be stored and ignored.
                    style={
                      catalog.data?.enabled
                        ? {
                            label: designLabel(design, catalog.data),
                            accent: design.accent,
                            isAuto: countChoices(design) === 0,
                            detail:
                              defaultDesign && sameDesign(design, defaultDesign)
                                ? "Your default look"
                                : "Chosen for this project",
                            onAuto: () => setChosenDesign({}),
                            onBrowse: () => setDesignOpen(true),
                          }
                        : null
                    }
                  />
                }
                placeholderText={
                  showPlaceholder ? SUGGESTIONS[suggestion] : undefined
                }
                overlay={
                  showPlaceholder ? (
                    <span
                      key={suggestion}
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute top-0 left-1 text-base leading-[1.55] whitespace-pre-wrap text-silver-500",
                        !reduceMotion && "composer-glitch",
                      )}
                    >
                      {SUGGESTIONS[suggestion]}
                    </span>
                  ) : null
                }
              />
              {/* </LightningComposer> */}
            </div>
            <DesignDialog
              open={designOpen}
              onOpenChange={setDesignOpen}
              value={design}
              onChange={setChosenDesign}
              savedDefault={defaultDesign}
              onSaveDefault={(look) => {
                setDefaultDesign(look);
                toast.success("New projects will start from this look");
              }}
            />
            {limitsLoading ? (
              <div className="mt-2 flex h-5 items-center px-1">
                <DataSpinner
                  label="Loading account limits"
                  className="[&_svg]:size-3"
                />
              </div>
            ) : (
              isFreePlan && (
                <div className="mt-2 flex items-center justify-between px-1 font-mono text-xs text-silver-500">
                  <span>
                    {Math.min(projectCount, FREE_PLAN_MAX_PROJECTS)} /{" "}
                    {FREE_PLAN_MAX_PROJECTS} projects
                  </span>
                  {atProjectLimit && (
                    <span className="text-orange-400">
                      Free plan limit reached.
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        </section>

        <AnimatePresence mode="wait">
          {!initializing && (
            <motion.div key="projects" exit={{ opacity: 0 }}>
              <MyProjects />
              <CommunityProjects />
              <HomeFooter />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Home;
