import type { MouseEvent } from "react";
import { Trash2Icon } from "lucide-react";
import toast from "react-hot-toast";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { ApiError } from "@/src/lib/api-client";
import { useDeleteProject } from "@/src/features/project/api";
import { useProjectStorage } from "@/src/features/project/storage";
import type { ProjectListItem } from "@/src/features/project/types";

interface DeleteProjectDialogProps {
  project: ProjectListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (projectId: string) => void;
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: DeleteProjectDialogProps) {
  const deleteProject = useDeleteProject();
  // Only asked for while the dialog is open: stored files are deleted with the project.
  const storage = useProjectStorage(project?.id, open);
  const storedFiles = (storage.data?.environments ?? []).reduce((n, e) => n + e.fileCount, 0);

  const handleDelete = (event: MouseEvent) => {
    // Prevent Radix from auto-closing the dialog on Action click so it stays
    // open (showing the "Deleting…" state) until the mutation resolves.
    event.preventDefault();
    if (!project) return;
    const id = project.id;
    deleteProject.mutate(id, {
      onSuccess: () => {
        toast.success("Project deleted");
        onOpenChange(false);
        onDeleted?.(id);
      },
      onError: (err) => {
        // A 409 is the server saying why not yet (a deploy or a run still in
        // progress), in words meant for the owner.
        toast.error(
          err instanceof ApiError && err.status === 409 ? err.message : "Failed to delete project",
        );
        onOpenChange(false);
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[440px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes{" "}
            <span className="font-medium text-silver-900">{project?.name}</span>,
            its code, its chat and its history.
            {storedFiles > 0 && (
              <>
                {" "}
                The {storedFiles === 1 ? "1 file" : `${storedFiles} files`} its app has stored go too.
              </>
            )}{" "}
            This can&rsquo;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive-solid"
            disabled={deleteProject.isPending}
            onClick={handleDelete}
          >
            {!deleteProject.isPending && <Trash2Icon />}
            {deleteProject.isPending ? "Deleting…" : "Delete project"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
