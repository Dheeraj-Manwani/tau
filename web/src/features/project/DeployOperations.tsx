import { useState, type ReactNode } from "react";
import { ChevronDownIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, RefreshCwIcon, WrenchIcon } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/src/lib/api-client";
import { cn } from "@/src/lib/utils";
import { Alert, type AlertTone } from "@/src/components/ui/alert";
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
import { Button } from "@/src/components/ui/button";
import { InsetWell } from "@/src/components/ui/card";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { useSendMessage } from "./useSendMessage";
import { useBalance } from "@/src/features/billing/api";
import { useUpgradeModalStore } from "@/src/features/billing/useUpgradeModalStore";
import {
  errorMessage,
  deployFailureError,
  useTakeSiteOffline,
  type DeployFailure,
} from "./deploy";

export function DeployedUrlActions({ url }: { url: string }) {
  return (
    <>
      <Button variant="secondary" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer">
          Open site
          <ExternalLinkIcon />
        </a>
      </Button>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            toast.success("URL copied");
          } catch {
            toast.error("Couldn't copy the URL. Select the address above to copy it.");
          }
        }}
      >
        <CopyIcon />
        Copy URL
      </Button>
    </>
  );
}

const noticeTone: Record<"warning" | "error" | "info", AlertTone> = {
  warning: "warning",
  error: "danger",
  info: "info",
};

/** Deploy's notices are the system alert: tinted block, icon, white text. */
export function DeployNotice({
  children,
  tone = "warning",
  action,
}: {
  children: ReactNode;
  tone?: "warning" | "error" | "info";
  action?: ReactNode;
}) {
  return (
    <Alert tone={noticeTone[tone]} action={action}>
      {children}
    </Alert>
  );
}

/**
 * Why the last deployment didn't go live (boards/Deploy-Tabs.dc.html): a
 * failed build offers "Ask tau to fix" as the one primary; database changes
 * ask for review and a confirmed deploy.
 */
export function DeployFailureNotice({
  projectId,
  failure,
  blocked,
  confirmDisabled,
  onConfirmSchema,
}: {
  projectId: string;
  failure: DeployFailure;
  blocked: boolean;
  confirmDisabled: boolean;
  onConfirmSchema: () => void;
}) {
  const { send, canSend, isSending } = useSendMessage(projectId);
  const setChatOpen = useProjectStore((s) => s.setChatOpen);
  const review = !!failure.schemaChanges?.length && !failure.changedSince;
  return (
    <DeployNotice tone={review || failure.changedSince ? "warning" : "error"}>
      <p className="font-semibold">
        {review
          ? "Review database changes"
          : failure.changedSince
            ? "The project changed since the last failed deployment"
            : "The last deployment did not go live"}
      </p>
      <p className="mt-1 text-silver-600">
        {failure.changedSince ? "Deploy the current version to try the updated files." : failure.error}
      </p>
      {review && (
        <>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {failure.schemaChanges!.map((change, i) => (
              <li key={`${change.kind}-${i}`}>{change.message}</li>
            ))}
          </ul>
          <p className="mt-2 text-silver-600">
            Tau takes a restore point first, adds what is new and leaves existing data as it is.
          </p>
          <Button size="sm" className="mt-3" disabled={confirmDisabled} onClick={onConfirmSchema}>
            Confirm changes & deploy
          </Button>
        </>
      )}
      {!review && !failure.changedSince && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              disabled={blocked || !canSend}
              loading={isSending}
              onClick={() => {
                if (
                  send("Deploying failed. Fix what stops the production build so the app can be deployed.", {
                    buildError: deployFailureError(failure),
                  })
                )
                  setChatOpen(true);
              }}
            >
              {!isSending && <WrenchIcon />}
              Ask tau to fix
            </Button>
            <span className="text-xs text-silver-500">Your live version is untouched.</span>
          </div>
          {(!canSend || blocked) && (
            <p className="mt-2 text-silver-600">
              Wait until the current project operation finishes before asking Tau to fix this.
            </p>
          )}
        </>
      )}
    </DeployNotice>
  );
}

/** Site access: text on the left, the outline destructive on the right; the
 *  confirm modal carries the only solid red. */
export function TakeOffline({ projectId, blocked }: { projectId: string; blocked: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const takeOffline = useTakeSiteOffline(projectId);
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="max-w-md text-[12.5px] leading-relaxed text-silver-500">
        Taking your site offline stops public access. The address stays yours.
      </p>
      <Button variant="destructive" size="sm" disabled={blocked} onClick={() => setConfirming(true)}>
        Take site offline
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take site offline?</AlertDialogTitle>
            <AlertDialogDescription>
              Visitors will no longer see your app. The address stays yours, and you can restore an available version or
              deploy again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {takeOffline.isError && (
            <Alert tone="danger">{errorMessage(takeOffline.error, "Couldn't take the site offline.")}</Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={takeOffline.isPending}>Keep online</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-solid"
              disabled={blocked || takeOffline.isPending}
              onClick={(e) => {
                e.preventDefault();
                takeOffline.mutate(undefined, { onSuccess: () => setConfirming(false) });
              }}
            >
              {takeOffline.isPending ? "Taking offline…" : "Take offline"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function DeployBadge() {
  const { data: balance } = useBalance();
  const openUpgrade = useUpgradeModalStore((s) => s.openModal);
  if (balance?.plan !== "FREE") return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-silver-500">
      Shows a &ldquo;Built with tau&rdquo; badge.
      <Button variant="link" className="text-xs" onClick={() => openUpgrade("Upgrade to Pro to remove this badge")}>
        Remove with Pro
      </Button>
    </p>
  );
}

export function RefreshSecrets({ projectId, blocked }: { projectId: string; blocked: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={blocked}
        loading={busy}
        onClick={async () => {
          if (busy || blocked) return;
          setBusy(true);
          setMessage("Applying your latest secrets to the live server…");
          try {
            await api.post(`/project/${projectId}/deploy/refresh-secrets`);
            setMessage("Your live server now has your latest secrets.");
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Couldn't update the live server. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Updating secrets…" : "Update secrets"}
      </Button>
      {message && (
        <p role="status" className="basis-full text-xs text-silver-500">
          {message}
        </p>
      )}
    </>
  );
}

/** A toggle that opens the last hour of server output in an inset well. */
export function ServerLogs({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.get<{ logs: string }>(`/project/${projectId}/deploy/logs`);
      setLogs(res.data.logs);
    } catch {
      setError("Couldn't read the server's logs. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open && logs === null) void load();
        }}
      >
        Server logs
        <ChevronDownIcon className={cn("transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <div className="mt-2 basis-full">
          {error && (
            <Alert tone="danger" className="mb-2">
              {error}
            </Alert>
          )}
          <InsetWell
            caption="Production server · last hour · secret values are masked"
            className="max-h-72 overflow-auto break-words whitespace-pre-wrap"
          >
            {busy && logs === null ? "Loading server logs…" : (logs ?? "")}
            {!busy && logs === "" && "Nothing printed in the last hour."}
          </InsetWell>
          <Button variant="ghost" size="sm" className="mt-2 -ml-2.5" disabled={busy} onClick={() => void load()}>
            <RefreshCwIcon className={cn(busy && "animate-spin motion-reduce:animate-none")} />
            {busy ? "Refreshing…" : "Refresh logs"}
          </Button>
        </div>
      )}
    </>
  );
}

export function ExportData({ projectId, blocked }: { projectId: string; blocked: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={blocked}
        loading={busy}
        onClick={async () => {
          if (busy || blocked) return;
          setBusy(true);
          setMessage("Preparing the production data export…");
          try {
            const res = await api.get<Blob>(`/project/${projectId}/database/export`, { responseType: "blob" });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = "data-export.zip";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage("Your data export was sent to your browser for download.");
          } catch {
            setMessage("Couldn't export your data. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {!busy && <DownloadIcon />}
        {busy ? "Preparing export…" : "Export data (CSV)"}
      </Button>
      {message && (
        <p role="status" className="basis-full text-xs text-silver-500">
          {message}
        </p>
      )}
    </>
  );
}
