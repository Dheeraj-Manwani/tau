import type { MouseEvent } from "react";
import { EraserIcon } from "lucide-react";
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
import { useClearChat } from "@/src/features/project/api";
import { useProjectStore } from "@/src/stores/useProjectStore";

interface ClearChatDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Failed to clear chat";
}

export function ClearChatDialog({
  projectId,
  open,
  onOpenChange,
}: ClearChatDialogProps) {
  const clearChat = useClearChat(projectId);
  const setContextUsage = useProjectStore((s) => s.setContextUsage);

  const handleClear = (event: MouseEvent) => {
    // Keep the dialog open (showing "Clearing…") until the mutation resolves,
    // same as DeleteProjectDialog.
    event.preventDefault();
    clearChat.mutate(undefined, {
      onSuccess: (data) => {
        toast.success("Chat cleared");
        setContextUsage(data);
        onOpenChange(false);
      },
      onError: (err) => {
        toast.error(messageFor(err));
        onOpenChange(false);
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[440px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Clear chat?</AlertDialogTitle>
          <AlertDialogDescription>
            Starts a new conversation. Your project files and build stay as
            they are; the old messages are no longer shown.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost">Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="secondary"
            disabled={clearChat.isPending}
            onClick={handleClear}
          >
            {!clearChat.isPending && <EraserIcon />}
            {clearChat.isPending ? "Clearing…" : "Clear chat"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
