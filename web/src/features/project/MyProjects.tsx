import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FolderOpenIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";

import { useMe } from "@/src/features/auth/queries";
import { DeleteProjectDialog } from "@/src/features/project/DeleteProjectDialog";
import { EditProjectDialog } from "@/src/features/project/EditProjectDialog";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { EmptyState } from "@/src/components/ui/empty-state";
import { SearchInput } from "@/src/components/ui/input";
import { Pagination } from "@/src/components/ui/pagination";
import { APP_HOME, projectPath } from "@/src/lib/routes";
import { PROJECTS_PAGE_SIZE, useProjectsPage } from "./api";
import { CardChrome, ProjectCardSkeleton, ThumbnailPlaceholder } from "./ProjectCardParts";
import { projectCardClass, projectGridClass } from "./projectCardStyles";
import type { ProjectListItem } from "./types";

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ProjectCard({
  project,
  onEditClick,
  onDeleteClick,
}: {
  project: ProjectListItem;
  onEditClick: (project: ProjectListItem) => void;
  onDeleteClick: (project: ProjectListItem) => void;
}) {
  return (
    <div className="group relative">
      <Link to={projectPath(project.id)} className={projectCardClass}>
        <CardChrome />
        <div className="h-[150px] w-full overflow-hidden bg-space-void">
          {project.previewImageUrl ? (
            <img src={project.previewImageUrl} alt="" loading="lazy" className="size-full object-cover object-top" />
          ) : (
            <ThumbnailPlaceholder />
          )}
        </div>
        <div className="flex flex-col gap-1.5 px-4 py-3.5">
          <span className="truncate pr-8 text-sm font-semibold text-silver-900">{project.name}</span>
          {project.description && (
            <span className="line-clamp-2 text-xs leading-normal text-silver-600">{project.description}</span>
          )}
          {project.tags && project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {project.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="rounded-xs border border-line px-1.5 py-0.5 font-mono text-[10.5px] text-silver-500">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <span className="font-mono text-[11.5px] text-silver-500">Updated {formatUpdated(project.updatedAt)}</span>
        </div>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={`Options for ${project.name}`}
            onClick={(e) => e.preventDefault()}
            className="absolute top-8 right-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onSelect={() => onEditClick(project)}>
            <PencilIcon />
            Edit project
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onDeleteClick(project)}>
            <Trash2Icon />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function MyProjects() {
  const { data: user } = useMe();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const { data, isLoading, isError, refetch } = useProjectsPage(query, cursors.at(-1));
  const projects = data?.projects ?? [];
  // Kept from the last page that loaded, so the count doesn't blink out while
  // the next page is on its way.
  const [total, setTotal] = useState<number | null>(null);
  if (data && data.total !== total) setTotal(data.total);
  const pageCount = total === null ? undefined : Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));
  useEffect(() => {
    if (search.trim() === query) return;
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setCursors([undefined]);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, query]);
  const navigate = useNavigate();
  const { id: currentProjectId } = useParams<{ id?: string }>();

  const [pendingDelete, setPendingDelete] = useState<ProjectListItem | null>(null);
  const [pendingEdit, setPendingEdit] = useState<ProjectListItem | null>(null);

  if (!user) return null;

  const synced = search.trim() === query;

  return (
    <>
      <section aria-labelledby="my-projects-heading" className="relative flex flex-col gap-7 pt-[140px] pb-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-3">
            <p className="eyebrow">// 01</p>
            <h2 id="my-projects-heading" className="display-heading text-[44px] text-silver-900">
              My projects
            </h2>
            <p className="text-sm text-silver-600">
              {total === null || (total === 0 && !query)
                ? "Pick up where you left off."
                : query
                  ? `${total} ${total === 1 ? "match" : "matches"}`
                  : `${total} ${total === 1 ? "project" : "projects"} · Pick up where you left off.`}
            </p>
          </div>
          <div className="relative w-full sm:w-[300px]">
            <SearchInput
              aria-label="Search projects"
              placeholder="Search name or description"
              maxLength={200}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="[&_input]:pr-9"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute top-1/2 right-1 -translate-y-1/2"
              >
                <XIcon />
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className={projectGridClass} aria-busy="true" aria-label="Loading projects">
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
            Could not load your projects.
          </Alert>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderOpenIcon}
            title={
              query ? "No projects found" : cursors.length > 1 ? "No more projects on this page" : "Your next idea starts here"
            }
            description={
              query
                ? "Try a different name or description."
                : cursors.length > 1
                  ? "Go back to your previous projects."
                  : "Describe an idea above to create your first project."
            }
          />
        ) : (
          <div className={projectGridClass}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEditClick={setPendingEdit}
                onDeleteClick={setPendingDelete}
              />
            ))}
          </div>
        )}
        {(cursors.length > 1 || Boolean(data?.nextCursor)) && (
          <Pagination
            page={cursors.length}
            pageCount={pageCount}
            note={query ? "Search results" : undefined}
            hasNext={Boolean(data?.nextCursor) && !isLoading && !isError && synced}
            onPrevious={() => setCursors((previous) => previous.slice(0, -1))}
            onNext={() => {
              if (data?.nextCursor) setCursors((previous) => [...previous, data.nextCursor!]);
            }}
          />
        )}
      </section>

      <EditProjectDialog
        project={pendingEdit}
        open={pendingEdit !== null}
        onOpenChange={(open) => {
          if (!open) setPendingEdit(null);
        }}
      />

      <DeleteProjectDialog
        project={pendingDelete}
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onDeleted={(id) => {
          if (currentProjectId === id) navigate(APP_HOME);
        }}
      />
    </>
  );
}
