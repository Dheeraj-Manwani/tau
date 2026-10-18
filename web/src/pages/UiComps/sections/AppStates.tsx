import { SplashScreen } from "@/src/components/SplashScreen";
import { DataSpinner } from "@/src/components/ui/data-spinner";
import { Skeleton } from "@/src/components/ui/skeleton";
import { ProjectLoadError } from "@/src/features/project/ProjectPage";
import { ApiError } from "@/src/lib/api-client";

import { Frame, Section, Spec } from "../frame";

export function AppStates() {
  return (
    <Section id="app" eyebrow="screens · app" title="App shell & page loads">
      <Spec label="Splash (auth resolving)" note="main.tsx hydrateFallbackElement, RequireAuth">
        <Frame height={260} className="[&>div]:min-h-full [&>div]:h-full">
          <SplashScreen />
        </Frame>
      </Spec>
      <Spec label="Loading project" note="ProjectPage, layoutMode === 'loading'">
        <Frame height={260}>
          <div className="flex h-full w-full items-center justify-center">
            <DataSpinner label="Loading project" />
          </div>
        </Frame>
      </Spec>
      <Spec label="Data spinner">
        <div className="flex flex-col gap-3">
          <DataSpinner />
          <DataSpinner label="Loading credits" />
        </div>
      </Spec>
      <Spec label="Skeleton blocks">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-[90%]" />
          <Skeleton className="h-3 w-[70%]" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </Spec>
      <Spec label="Project load error · no access" note="ApiError 403">
        <Frame height={200}>
          <ProjectLoadError error={new ApiError(403, "Forbidden")} onRetry={() => {}} />
        </Frame>
      </Spec>
      <Spec label="Project load error · gone" note="ApiError 404 / 410">
        <Frame height={200}>
          <ProjectLoadError error={new ApiError(404, "Not found")} onRetry={() => {}} />
        </Frame>
      </Spec>
      <Spec label="Project load error · request failed" note="network or 5xx">
        <Frame height={200}>
          <ProjectLoadError error={new Error("Network Error")} onRetry={() => {}} />
        </Frame>
      </Spec>
    </Section>
  );
}
