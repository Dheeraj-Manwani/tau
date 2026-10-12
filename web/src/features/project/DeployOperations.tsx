import { useState, type ReactNode } from "react";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  DownloadIcon,
  LoaderCircleIcon,
  WrenchIcon,
} from "lucide-react";
import { api } from "@/src/lib/api-client";
import { cn } from "@/src/lib/utils";
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

export const deployButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-silver-200 bg-space-overlay px-3 py-2 text-xs font-medium text-silver-900 transition-colors hover:bg-silver-200 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9";
export const deployPrimaryClass =
  "border-transparent bg-blue-500 text-blue-900 hover:bg-blue-400";

export function DeployNotice({
  children,
  tone = "warning",
}: {
  children: ReactNode;
  tone?: "warning" | "error" | "info";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg p-3 text-xs leading-relaxed",
        tone === "error"
          ? "bg-red-500/10 text-red-200"
          : tone === "info"
            ? "bg-blue-500/10 text-blue-200"
            : "bg-amber-500/10 text-amber-200",
      )}
    >
      <AlertTriangleIcon
        className="mt-0.5 size-4 shrink-0"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

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
      <p className="font-medium">
        {review
          ? "Review database changes"
          : failure.changedSince
            ? "The project changed since the last failed deployment"
            : "The last deployment did not go live"}
      </p>
      <p className="mt-1">
        {failure.changedSince
          ? "Deploy the current version to try the updated files."
          : failure.error}
      </p>
      {review && (
        <>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {failure.schemaChanges!.map((change, i) => (
              <li key={`${change.kind}-${i}`}>{change.message}</li>
            ))}
          </ul>
          <p className="mt-2">
            Tau takes a restore point first, adds what is new and leaves
            existing data as it is.
          </p>
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={onConfirmSchema}
            className={cn(deployButtonClass, deployPrimaryClass, "mt-3")}
          >
            Confirm changes & deploy
          </button>
        </>
      )}
      {!review && !failure.changedSince && (
        <>
          <button
            type="button"
            disabled={blocked || !canSend}
            onClick={() => {
              if (
                send(
                  "Deploying failed. Fix what stops the production build so the app can be deployed.",
                  { buildError: deployFailureError(failure) },
                )
              )
                setChatOpen(true);
            }}
            className={cn(deployButtonClass, deployPrimaryClass, "mt-3")}
          >
            {isSending ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" />
            ) : (
              <WrenchIcon className="size-3.5" />
            )}
            Fix with tau
          </button>
          {(!canSend || blocked) && (
            <p className="mt-2">
              Wait until the current project operation finishes before asking
              Tau to fix this.
            </p>
          )}
        </>
      )}
    </DeployNotice>
  );
}

export function TakeOffline({
  projectId,
  blocked,
}: {
  projectId: string;
  blocked: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const takeOffline = useTakeSiteOffline(projectId);
  return (
    <div>
      <p className="text-xs leading-relaxed text-silver-600">
        Taking your site offline stops public access. The address stays yours.
      </p>
      {!confirming ? (
        <button
          type="button"
          disabled={blocked}
          onClick={() => setConfirming(true)}
          className={cn(deployButtonClass, "mt-3 text-red-300")}
        >
          Take site offline
        </button>
      ) : (
        <div className="mt-3 rounded-lg bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-200">
            Take this site offline?
          </p>
          <p className="mt-1 text-xs text-silver-600">
            Visitors will no longer see your app. You can restore an available
            version or deploy again.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={takeOffline.isPending}
              onClick={() => setConfirming(false)}
              className={deployButtonClass}
            >
              Keep online
            </button>
            <button
              type="button"
              disabled={blocked || takeOffline.isPending}
              onClick={() => takeOffline.mutate()}
              className={cn(deployButtonClass, "text-red-300")}
            >
              {takeOffline.isPending ? "Taking offline…" : "Take offline"}
            </button>
          </div>
          {takeOffline.isError && (
            <p role="alert" className="mt-2 text-xs text-red-300">
              {errorMessage(
                takeOffline.error,
                "Couldn't take the site offline.",
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function DeployBadge() {
  const { data: balance } = useBalance();
  const openUpgrade = useUpgradeModalStore((s) => s.openModal);
  if (balance?.plan !== "FREE") return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-silver-600">
      Shows a “Built with tau” badge.
      <button
        type="button"
        onClick={() => openUpgrade("Upgrade to Pro to remove this badge")}
        className="text-blue-500 hover:underline"
      >
        Remove with Pro
      </button>
    </p>
  );
}

export function RefreshSecrets({
  projectId,
  blocked,
}: {
  projectId: string;
  blocked: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy || blocked}
        className={deployButtonClass}
        onClick={async () => {
          if (busy || blocked) return;
          setBusy(true);
          setMessage("Applying your latest secrets to the live server…");
          try {
            await api.post(`/project/${projectId}/deploy/refresh-secrets`);
            setMessage("Your live server now has your latest secrets.");
          } catch (err) {
            setMessage(
              err instanceof Error
                ? err.message
                : "Couldn't update the live server. Try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Updating secrets…" : "Update secrets"}
      </button>
      {message && (
        <p role="status" className="mt-2 text-xs text-silver-600">
          {message}
        </p>
      )}
    </div>
  );
}

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
      const res = await api.get<{ logs: string }>(
        `/project/${projectId}/deploy/logs`,
      );
      setLogs(res.data.logs);
    } catch {
      setError("Couldn't read the server's logs. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open && logs === null) void load();
        }}
        className={deployButtonClass}
      >
        Server logs
        <ChevronDownIcon className={cn("size-3.5", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3">
          <p className="mb-2 text-[11px] text-silver-600">
            Production server · last hour · secret values are masked
          </p>
          {error && (
            <p role="alert" className="mb-2 text-xs text-red-300">
              {error}
            </p>
          )}
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-space-surface p-3 font-mono text-xs text-silver-600">
            {busy && logs === null ? "Loading server logs…" : (logs ?? "")}
            {!busy && logs === "" && "Nothing printed in the last hour."}
          </pre>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className={cn(deployButtonClass, "mt-2")}
          >
            {busy ? "Refreshing…" : "Refresh logs"}
          </button>
        </div>
      )}
    </div>
  );
}

export function ExportData({
  projectId,
  blocked,
}: {
  projectId: string;
  blocked: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy || blocked}
        className={deployButtonClass}
        onClick={async () => {
          if (busy || blocked) return;
          setBusy(true);
          setMessage("Preparing the production data export…");
          try {
            const res = await api.get<Blob>(
              `/project/${projectId}/database/export`,
              { responseType: "blob" },
            );
            const url = URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = "data-export.zip";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage(
              "Your data export was sent to your browser for download.",
            );
          } catch {
            setMessage("Couldn't export your data. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <DownloadIcon className="size-3.5" />
        {busy ? "Preparing export…" : "Export data (CSV)"}
      </button>
      {message && (
        <p role="status" className="mt-2 text-xs text-silver-600">
          {message}
        </p>
      )}
    </div>
  );
}
