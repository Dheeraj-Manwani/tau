import { ArrowUpRightIcon, RadarIcon } from "lucide-react";

import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/empty-state";
import { useProjectShowcase } from "./api";
import { CardChrome, ProjectCardSkeleton } from "./ProjectCardParts";
import { projectCardClass, projectGridClass } from "./projectCardStyles";

/** Live sites other people deployed, on the same card as My projects. */
export function CommunityProjects() {
  const { data: projects, isLoading, isError, refetch } = useProjectShowcase();
  return (
    <section aria-labelledby="community-projects-heading" className="relative flex flex-col gap-7 py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-3">
          <p className="eyebrow">// 02</p>
          <h2 id="community-projects-heading" className="display-heading text-[44px] text-silver-900">
            See what others are building
          </h2>
          <p className="max-w-lg text-sm text-silver-600">
            Small ideas, real websites. Explore what the community is putting into the world.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className={projectGridClass} aria-busy="true" aria-label="Loading community projects">
          {Array.from({ length: 3 }, (_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <Alert
          tone="danger"
          action={
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        >
          Community projects are unavailable right now.
        </Alert>
      ) : !projects?.length ? (
        <EmptyState
          icon={RadarIcon}
          title="Good things are taking shape."
          description="As builders refine and deploy their projects, you’ll find a selection of their live sites here."
        />
      ) : (
        <div className={projectGridClass}>
          {projects.map((project) => (
            <a
              key={project.slug}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit ${project.slug} (opens in a new tab)`}
              className={`group ${projectCardClass}`}
            >
              <CardChrome />
              <div className="relative grid h-[150px] place-items-center bg-[repeating-linear-gradient(135deg,#0e0e10_0_10px,#131316_10px_20px)]">
                <span aria-hidden="true" className="display-heading text-5xl text-silver-600">
                  {project.slug.slice(0, 2)}
                </span>
                <Badge tone="green" dot className="absolute top-3 left-3">
                  Live
                </Badge>
                <ArrowUpRightIcon className="absolute top-3 right-3 size-4 text-silver-600 transition-colors group-hover:text-silver-900" />
              </div>
              <div className="flex flex-col gap-1 px-4 py-3.5">
                <h3 className="truncate text-sm font-semibold capitalize">{project.slug.replace(/-/g, " ")}</h3>
                <p className="truncate font-mono text-[11.5px] text-silver-500">
                  {project.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
      <p className="text-xs leading-relaxed text-silver-500">
        Featuring live sites deployed in the last 90 days, shaped through at least three build prompts.
      </p>
    </section>
  );
}
