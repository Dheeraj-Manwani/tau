import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Group,
  Panel,
  Separator,
  type PanelImperativeHandle,
} from "react-resizable-panels";

import { cn } from "@/src/lib/utils";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { DataSpinner } from "@/src/components/ui/data-spinner";
import { useDocumentMeta } from "@/src/components/useDocumentMeta";
import { api, ApiError, isTerminalRequestError } from "@/src/lib/api-client";
import { APP_HOME } from "@/src/lib/routes";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { ChatPanel } from "@/src/features/project/ChatPanel";
import { RightPanel } from "@/src/features/project/RightPanel";
import { useProject, useProjectTree, projectKeys } from "@/src/features/project/api";
import { useJobStream, seedWatermark } from "@/src/features/project/useJobStream";
import type { ProjectDetail, ProjectJobStatusResponse } from "@/src/features/project/types";
import { jobStatusFromDetail, jobStatusNeedsResync } from "@/src/features/project/projectJobPoll";
import {
  clearFreshBuild,
  hasFreshBuild,
} from "@/src/features/project/revealSession";
import { useReadyNotification } from "@/src/features/project/useReadyNotification";
import { useAgentFavicon } from "@/src/features/project/useAgentFavicon";
import { useFirstBuildFlash } from "@/src/features/project/useFirstBuildFlash";
import { resolveProjectLayout } from "@/src/features/project/projectLayout";
import { useProjectTours } from "@/src/features/tour/useProjectTours";
import { useReduceMotion } from "@/src/hooks/useReduceMotion";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";

// Only fetched once a tour is actually due: most visits never need it.
const ProjectTour = lazy(() => import("@/src/features/tour/ProjectTour"));

/**
 * How long an "active" job may send nothing before the UI calls it stalled.
 *
 * Generously above the quietest legitimate gap: a single agent turn is bounded
 * by the LLM request timeout (4 min) and streams `llm_chunk` frames throughout,
 * and long tool calls publish `tool_req`/`tool_res` around themselves. Silence
 * past this is a wedged or orphaned run, not a slow one.
 */
const STALL_AFTER_MS = 5 * 60_000;

function useProjectBootstrap() {
  const { id: projectId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const navState = location.state as { jobId?: string; prompt?: string } | null;

  const initProject = useProjectStore((s) => s.initProject);
  const startJob = useProjectStore((s) => s.startJob);
  const hydrate = useProjectStore((s) => s.hydrate);
  const hydrateTree = useProjectStore((s) => s.hydrateTree);
  const resyncFromDetail = useProjectStore((s) => s.resyncFromDetail);
  const setStalled = useProjectStore((s) => s.setStalled);
  const status = useProjectStore((s) => s.status);
  const qc = useQueryClient();

  const projectQuery = useProject(projectId);
  const { data, refetch } = projectQuery;
  const projectError = projectQuery.isError && (!data || isTerminalRequestError(projectQuery.error))
    ? projectQuery.error : null;
  const { data: tree } = useProjectTree(data && !projectError ? projectId : undefined);

  useEffect(() => {
    if (!projectId) return;
    initProject(projectId);
    if (navState?.jobId) {
      startJob(navState.jobId, navState.prompt);

      // The job handoff from Home is a one-shot instruction, not durable route
      // state. Leaving it on the history entry makes browser Back replay an old
      // job after initProject clears the transcript; hydrate then correctly
      // refuses to overwrite the resulting "streaming" state. Consume it now
      // so returning from Billing hydrates the persisted conversation instead.
      void navigate(
        `${location.pathname}${location.search}${location.hash}`,
        { replace: true, state: null },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!data || projectError || !projectQuery.isFetchedAfterMount) return;
    const wasLive = useProjectStore.getState().currentJobId === data.activeJobId &&
      useProjectStore.getState().status === "streaming";
    hydrate(data);
    if (data.activeJobId && !wasLive && data.activeJobEventIndex != null) {
      // Hydration restored the durable question/transcript. Skip events already
      // reflected in that snapshot, but never skip on the Home handoff where
      // hydrate deliberately leaves a live optimistic stream alone.
      seedWatermark(data.activeJobId, data.activeJobEventIndex);
    }
  }, [data, hydrate, projectError, projectQuery.isFetchedAfterMount]);

  useEffect(() => {
    if (tree) hydrateTree(tree);
  }, [tree, hydrateTree]);

  useEffect(() => {
    if (!projectId || projectError) return;
    if (status === "done" || status === "cancelled" || status === "error") {
      // Rebuild from the final persisted transcript. A snapshot/stream handoff
      // can miss a transient frame, but it must never leave final messages or
      // terminal reasons missing until the next full page refresh.
      void api.get<ProjectDetail>(`/project/${projectId}`).then((response) => {
        if (useProjectStore.getState().projectId !== projectId) return;
        qc.setQueryData(projectKeys.detail(projectId), response.data);
        resyncFromDetail(response.data);
      }).catch(() => {});
      void qc.invalidateQueries({ queryKey: projectKeys.tree(projectId), refetchType: "active" });
    }
  }, [status, projectId, projectError, qc, resyncFromDetail]);

  // Backstop: while the store believes a job is streaming, poll only the
  // authoritative job state. A terminal SSE event (`done`/`error`) is the fast
  // path; fetch the full transcript only when this small snapshot disagrees.
  //
  // When the server *does* still call the job active, that used to be the end of
  // it: the poll simply re-confirmed the shimmer every 6s, forever, which is
  // what made a stranded job look like an eternally-thinking project. Now a job
  // that has sent nothing for STALL_AFTER_MS is flagged as stalled so the UI can
  // say so and offer the stop button, rather than shimmering indefinitely.
  useEffect(() => {
    if (!projectId || projectError || status !== "streaming") return;
    let cancelled = false;
    let inFlight = false;
    const timer = setInterval(() => {
      const { lastEventAt, isStalled, pendingQuestion } = useProjectStore.getState();
      if (
        !pendingQuestion &&
        !isStalled &&
        lastEventAt !== null &&
        Date.now() - lastEventAt > STALL_AFTER_MS
      ) {
        setStalled(true);
      }

      if (inFlight) return;
      inFlight = true;
      void (async () => {
        try {
          const { data: snapshot } = await api.get<ProjectJobStatusResponse>(
            `/project/${projectId}/job-status`,
          );
          if (cancelled) return;
          const current = useProjectStore.getState();
          if (current.projectId !== projectId || current.status !== "streaming") return;
          if (!jobStatusNeedsResync(snapshot, current)) return;

          const { data: detail } = await api.get<ProjectDetail>(`/project/${projectId}`);
          if (cancelled) return;
          const latest = useProjectStore.getState();
          if (latest.projectId !== projectId || latest.status !== "streaming") return;
          // The SSE stream may have caught up during the two requests. Only
          // replace its state if the full server snapshot still disagrees.
          if (jobStatusNeedsResync(jobStatusFromDetail(detail), latest)) {
            qc.setQueryData(projectKeys.detail(projectId), detail);
            resyncFromDetail(detail);
          }
        } catch (error) {
          if (!cancelled && isTerminalRequestError(error)) {
            clearInterval(timer);
            // Refresh once to put the page into its stable access/error state.
            void refetch();
          }
          // Transient network failure: keep the live stream and retry next tick.
        } finally {
          inFlight = false;
        }
      })();
    }, 6000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [status, projectId, projectError, qc, refetch, resyncFromDetail, setStalled]);

  useJobStream(!projectError);

  return {
    detail: projectQuery.isFetchedAfterMount ? data : undefined,
    detailPending: projectQuery.isPending || !projectQuery.isFetchedAfterMount,
    detailError: projectError,
    retryLoad: refetch,
  };
}

const WORKSPACE_SPRING = { type: "spring", stiffness: 320, damping: 34 } as const;

/** The project could not be loaded: no access, gone, or a failed request. */
export function ProjectLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof ApiError && error.status === 403
    ? "You don’t have access to this project."
    : error instanceof ApiError && [404, 410].includes(error.status)
      ? "This project is no longer available."
      : "We couldn’t load this project. Please try again.";
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-4">
        <Alert tone="danger">{message}</Alert>
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" asChild>
            <Link to={APP_HOME}>Back to projects</Link>
          </Button>
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const { detail, detailPending, detailError, retryLoad } = useProjectBootstrap();

  useDocumentMeta({
    title: detail?.project.name ?? "Project",
    noIndex: true,
  });

  const { id: projectId } = useParams<{ id: string }>();
  const [cameFromHome] = useState(() =>
    projectId ? hasFreshBuild(projectId) : false,
  );
  useEffect(() => {
    if (projectId) clearFreshBuild(projectId);
  }, [projectId]);

  const isChatOpen = useProjectStore((s) => s.isChatOpen);
  const setChatOpen = useProjectStore((s) => s.setChatOpen);
  const buildStarted = useProjectStore((s) => s.buildStarted);
  const storeProjectId = useProjectStore((s) => s.projectId);
  const status = useProjectStore((s) => s.status);
  const currentJobId = useProjectStore((s) => s.currentJobId);
  const terminalOutcome = useProjectStore((s) => s.terminalOutcome);
  const pendingQuestion = useProjectStore((s) => s.pendingQuestion);
  const isStalled = useProjectStore((s) => s.isStalled);
  const isPreviewJob = useProjectStore((s) => s.isPreviewJob);
  const userCancelledJobId = useProjectStore((s) => s.userCancelledJobId);
  const layoutMode = resolveProjectLayout({
    liveBuildStarted: storeProjectId === projectId && buildStarted,
    workspaceStartedAt: detail?.project.workspaceStartedAt,
    hasPreviewFragment: detail?.latestFragment != null,
    detailPending,
    freshBuild: cameFromHome,
  });
  const centered = layoutMode === "chat";
  const tours = useProjectTours(layoutMode);
  const reduceMotion = useReduceMotion();
  const running = tours.running;
  const tour = running && (
    <Suspense fallback={null}>
      <ProjectTour
        key={running.key}
        steps={running.steps}
        reduceMotion={reduceMotion}
        onEnd={(outcome) => tours.end(running.id, outcome)}
      />
    </Suspense>
  );
  const readyNotification = useReadyNotification({
    projectId,
    projectName: detail?.project.name,
    currentJobId,
    status,
    isPreviewJob,
    terminalOutcome,
    pendingQuestion,
    userCancelledJobId,
  });
  useFirstBuildFlash();
  useAgentFavicon({
    status,
    pendingQuestion: pendingQuestion != null,
    stalled: isStalled,
    previewJob: isPreviewJob,
  });

  const chatPanelRef = useRef<PanelImperativeHandle | null>(null);
  // Below 768px two panes don't fit: show one at a time. Collapse chat to
  // see the workspace; "Open chat" in its top bar brings the chat back.
  const narrow = useMediaQuery("(max-width: 767px)");

  // Sync the store's isChatOpen into the panel (for the collapse button in ChatPanel).
  useEffect(() => {
    if (isChatOpen) {
      if (chatPanelRef.current?.isCollapsed()) chatPanelRef.current.expand();
    } else {
      if (!chatPanelRef.current?.isCollapsed()) chatPanelRef.current?.collapse();
    }
  }, [isChatOpen]);

  if (detailError) {
    return <ProjectLoadError error={detailError} onRetry={() => void retryLoad()} />;
  }

  if (layoutMode === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <DataSpinner label="Loading project" />
      </div>
    );
  }

  if (centered) {
    return (
      // Chat only until the first build lands (boards/Workspace-ChatOnly.dc.html):
      // one 672px column, no preview, code or tools yet.
      <div className="flex h-full w-full justify-center px-4 sm:px-6">
        <div className="h-full w-full max-w-[672px]">
          <ChatPanel
            showCollapse={false}
            readyNotification={readyNotification}
          />
        </div>
        {tour}
      </div>
    );
  }

  if (narrow) {
    return (
      <>
        {isChatOpen ? (
          <ChatPanel readyNotification={readyNotification} />
        ) : (
          <RightPanel />
        )}
        {tour}
      </>
    );
  }

  return (
    <>
      <Group orientation="horizontal" className="h-full w-full">
        {/* Strings (without units) = percentages in v4; numbers = pixels. */}
        <Panel
          panelRef={chatPanelRef}
          defaultSize="25"
          minSize="18"
          collapsible
          collapsedSize="0"
          onResize={() => {
            const collapsed = chatPanelRef.current?.isCollapsed() ?? false;
            setChatOpen(!collapsed);
          }}
        >
          <ChatPanel readyNotification={readyNotification} />
        </Panel>

        <Separator
          className={cn(
            "group relative w-px shrink-0 cursor-col-resize",
            "bg-line transition-colors duration-150",
            "hover:bg-blue-500 data-[separator=active]:bg-blue-500",
          )}
        >
          {/* Wide invisible grab zone so the 1px line is easy to grab. */}
          <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2" />
        </Separator>

        <Panel minSize="30" className="min-w-0">
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={WORKSPACE_SPRING}
            className="h-full w-full"
          >
            <RightPanel />
          </motion.div>
        </Panel>
      </Group>
      {tour}
    </>
  );
}
