/**
 * Dev-only gallery of every screen's states (/ui-comps): loaders, skeletons,
 * empty and error states, and whole project panes on scenario data, without
 * creating a project or waiting for a run. Routed only when
 * import.meta.env.DEV, outside the auth guards. Never talks to the API; see
 * mockApi.ts.
 *
 * Adding a state: if a pure state function derives it (chatLoaderView,
 * getEmptyPreviewState), add an input to fixtures.ts; otherwise add a <Spec>
 * to the screen's section, or a scenario to scenarios.ts for a whole pane.
 */
import { useEffect, useState } from "react";
import { MotionConfig } from "motion/react";

import { SearchInput } from "@/src/components/ui/input";
import { Switch } from "@/src/components/ui/switch";
import { useDocumentMeta } from "@/src/components/useDocumentMeta";
import { cn } from "@/src/lib/utils";

import { FilterContext, MotionPausedContext } from "./context";
import { GALLERY_SECTIONS } from "./links";
import { installOfflineApi } from "./mockApi";
import { MockScope } from "./scope";
import { AppStates } from "./sections/AppStates";
import { BillingStates } from "./sections/BillingStates";
import { ChatStates } from "./sections/ChatStates";
import { HomeStates } from "./sections/HomeStates";
import { Modals } from "./sections/Modals";
import { PreviewStates } from "./sections/PreviewStates";
import { Primitives } from "./sections/Primitives";
import { Scenarios } from "./sections/Scenarios";
import { ToolStates } from "./sections/ToolStates";

installOfflineApi();

/** `#preview/empty-stalled` → scroll to that tile and ring it. */
function useHashTarget() {
  useEffect(() => {
    let ringed: HTMLElement | null = null;
    const go = () => {
      ringed?.removeAttribute("data-target");
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ block: "start" });
      if (id.includes("/")) {
        el.setAttribute("data-target", "true");
        ringed = el;
      }
    };
    // After lazy sections settle.
    const timer = window.setTimeout(go, 50);
    window.addEventListener("hashchange", go);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", go);
    };
  }, []);
}

export default function UiComps() {
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  useDocumentMeta({ title: "UI states", noIndex: true });
  useHashTarget();

  return (
    <MotionPausedContext.Provider value={paused}>
      <FilterContext.Provider value={filter}>
        <MotionConfig reducedMotion={paused ? "always" : "user"}>
          <MockScope>
            <div
              className={cn(
                "min-h-[100svh] bg-space-void",
                // CSS animations too (spinners, shimmer, rain): freeze them for comparing.
                paused && "[&_*]:![animation-play-state:paused]",
              )}
            >
              <header className="sticky top-0 z-30 border-b border-line bg-space-void/90 backdrop-blur">
                <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
                  <p className="font-mono text-xs text-silver-900">/ui-comps</p>
                  <nav className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-silver-600">
                    {GALLERY_SECTIONS.map(({ id, label }) => (
                      <a key={id} href={`#${id}`} className="hover:text-silver-900">
                        {label}
                      </a>
                    ))}
                  </nav>
                  <div className="ml-auto flex items-center gap-4">
                    <label className="flex items-center gap-2 text-[13px] text-silver-600">
                      <Switch checked={paused} onCheckedChange={setPaused} aria-label="Pause motion" />
                      Pause motion
                    </label>
                    <SearchInput
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Filter states"
                      aria-label="Filter states"
                      className="w-48"
                    />
                  </div>
                </div>
              </header>

              <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-16 px-4 py-12 sm:px-6">
                <div>
                  <p className="eyebrow">// Dev only · offline</p>
                  <h1 className="display-l mt-3">Every screen, every state.</h1>
                  <p className="mt-3 max-w-2xl text-[15px] text-silver-600">
                    The real components on fixture data, grouped by screen. Nothing here reaches the API: reads stay
                    loading, writes are refused. Each tile has a # link. For mobile layouts, use the browser&apos;s device
                    toolbar: panes follow the viewport, not the tile.
                  </p>
                </div>
                <AppStates />
                <HomeStates />
                <ChatStates />
                <PreviewStates />
                <ToolStates />
                <BillingStates />
                <Modals />
                <Scenarios />
                <Primitives />
              </main>
            </div>
          </MockScope>
        </MotionConfig>
      </FilterContext.Provider>
    </MotionPausedContext.Provider>
  );
}
