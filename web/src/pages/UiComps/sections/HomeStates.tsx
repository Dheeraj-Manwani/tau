import type { QueryClient } from "@tanstack/react-query";

import { projectKeys } from "@/src/features/project/api";
import { CommunityProjects } from "@/src/features/project/CommunityProjects";
import { MyProjects } from "@/src/features/project/MyProjects";
import { ProjectCardSkeleton, ThumbnailPlaceholder } from "@/src/features/project/ProjectCardParts";
import type { ListProjectsResponse } from "@/src/features/project/types";

import { Section, Spec } from "../frame";
import { projectsPage } from "../fixtures";
import { seedError } from "../mockApi";
import { MockScope } from "../scope";

/** MyProjects' first page: no search, no cursor. */
const FIRST_PAGE = [...projectKeys.list(), "page", "", ""];
const SHOWCASE = ["project", "showcase"];

const page = (data: ListProjectsResponse) => (client: QueryClient) => client.setQueryData(FIRST_PAGE, data);
const failed = (key: readonly unknown[]) => (client: QueryClient) => seedError(client, key, new Error("Network Error"));

export function HomeStates() {
  return (
    <Section id="home" eyebrow="screens · home" title="Home: projects">
      <Spec label="Card skeleton">
        <div className="grid grid-cols-2 gap-3">
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
        </div>
      </Spec>
      <Spec label="Thumbnail placeholder" note="a project with no cover yet">
        <div className="aspect-video overflow-hidden rounded-md border border-line">
          <ThumbnailPlaceholder />
        </div>
      </Spec>

      <Spec wide label="My projects · loading" note="query pending">
        <MockScope>
          <MyProjects />
        </MockScope>
      </Spec>
      <Spec wide label="My projects · none yet" note="total 0">
        <MockScope seed={page(projectsPage(0))}>
          <MyProjects />
        </MockScope>
      </Spec>
      <Spec wide label="My projects · a few" note="3 projects, one page">
        <MockScope seed={page(projectsPage(3))}>
          <MyProjects />
        </MockScope>
      </Spec>
      <Spec wide label="My projects · paged" note="6 of 23, next cursor">
        <MockScope seed={page(projectsPage(6, 23))}>
          <MyProjects />
        </MockScope>
      </Spec>
      <Spec wide label="My projects · error" note="request failed">
        <MockScope seed={failed(FIRST_PAGE)}>
          <MyProjects />
        </MockScope>
      </Spec>

      <Spec wide label="Community · loading">
        <MockScope>
          <CommunityProjects />
        </MockScope>
      </Spec>
      <Spec wide label="Community · empty">
        <MockScope seed={(client) => client.setQueryData(SHOWCASE, [])}>
          <CommunityProjects />
        </MockScope>
      </Spec>
      <Spec wide label="Community · error">
        <MockScope seed={failed(SHOWCASE)}>
          <CommunityProjects />
        </MockScope>
      </Spec>
    </Section>
  );
}
