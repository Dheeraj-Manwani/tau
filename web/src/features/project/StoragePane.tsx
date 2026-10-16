import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  DownloadIcon,
  EyeIcon,
  FileIcon,
  HardDriveIcon,
  ImageIcon,
  KeyRoundIcon,
  Trash2Icon,
} from "lucide-react";
import toast from "react-hot-toast";

import { cn } from "@/src/lib/utils";
import { ToolPaneContent } from "./ToolPaneContent";
import { APP_BILLING } from "@/src/lib/routes";
import { useDebounced } from "@/src/hooks/useDebounced";
import { Alert } from "@/src/components/ui/alert";
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
import { Card } from "@/src/components/ui/card";
import { Checkbox } from "@/src/components/ui/checkbox";
import { EmptyState } from "@/src/components/ui/empty-state";
import { SearchInput } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { Segmented, SegmentedItem } from "@/src/components/ui/segmented";
import { Skeleton } from "@/src/components/ui/skeleton";
import { errorMessage } from "@/src/features/project/secrets";
import {
  NEARLY_FULL_PERCENT,
  canPreview,
  fetchFileUrl,
  formatSize,
  typeLabel,
  useClearPreviewFiles,
  useDeleteStorageFiles,
  useProjectStorage,
  useRotateStorageKey,
  useStorageFiles,
  usagePercent,
  type StorageEnv,
  type StoredFile,
} from "@/src/features/project/storage";

/** "2d ago" in the narrow Added column; a date once it is older than a month. */
function formatAdded(iso: string): string {
  const ts = Date.parse(iso);
  if (!ts) return "";
  const day = Math.floor((Date.now() - ts) / 86_400_000);
  if (day < 1) return "today";
  if (day < 30) return `${day}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The allowance meter: blue, orange once nearly full, red when full. */
function UsageCard({ used, quota, maxFile }: { used: number; quota: number; maxFile: number }) {
  const navigate = useNavigate();
  const pct = usagePercent(used, quota);
  const nearlyFull = pct >= NEARLY_FULL_PERCENT;
  return (
    <Card className="flex flex-col gap-3 px-5.5 py-4.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm">
          <b className="font-mono font-semibold">{formatSize(used)}</b>{" "}
          <span className="text-silver-600">of {formatSize(quota)} used</span>
        </p>
        <p className="text-xs text-silver-500">Across all your apps · largest file {formatSize(maxFile)}</p>
      </div>
      <div
        role="meter"
        aria-label="Storage used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 overflow-hidden rounded-full bg-space-raised"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            pct >= 100 ? "bg-red-400" : nearlyFull ? "bg-orange-400" : "bg-blue-500",
          )}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
      {nearlyFull && (
        <Alert
          tone={pct >= 100 ? "danger" : "warning"}
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate(APP_BILLING)}>
              Get more room
            </Button>
          }
        >
          {pct >= 100 ? "Your storage is full, so new uploads are refused." : "Your storage is nearly full."}
        </Alert>
      )}
    </Card>
  );
}

/** Open a file in a new tab (pictures, PDF, text) or save it, through a fresh signed address. */
async function openFile(projectId: string, env: StorageEnv, file: StoredFile, download: boolean) {
  // A tab opened after an await is treated as a pop-up and blocked, so open it first.
  const tab = download ? null : window.open("", "_blank");
  try {
    const url = await fetchFileUrl(projectId, env, file.key, download);
    if (download) {
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else if (tab) {
      tab.opener = null;
      tab.location.href = url;
    }
  } catch (err) {
    tab?.close();
    toast.error(errorMessage(err, "Couldn't open the file"));
  }
}

const columns =
  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 sm:grid-cols-[auto_minmax(0,1fr)_70px_90px_auto]";

function FileRow({
  file,
  projectId,
  env,
  selected,
  onToggle,
  onDelete,
}: {
  file: StoredFile;
  projectId: string;
  env: StorageEnv;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const Icon = file.contentType.startsWith("image/") ? ImageIcon : FileIcon;
  return (
    <li className={`${columns} min-h-[49px] border-t border-line px-5.5 py-2 transition-colors hover:bg-space-raised/40`}>
      <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${file.key}`} />
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          title={typeLabel(file.contentType, file.key)}
          className="grid size-7 shrink-0 place-items-center rounded-sm border border-line-strong bg-space-overlay text-silver-600"
        >
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p title={file.key} className="truncate font-mono text-[12.5px] text-silver-900">
            {file.key}
          </p>
          <p className="truncate font-mono text-[11px] text-silver-500 sm:hidden">
            {formatSize(file.size)} · {formatAdded(file.createdAt)}
          </p>
        </div>
      </div>
      <span className="hidden text-right font-mono text-[11.5px] text-silver-500 sm:block">{formatSize(file.size)}</span>
      <span className="hidden text-right text-xs text-silver-500 sm:block">{formatAdded(file.createdAt)}</span>
      <div className="flex justify-end gap-0.5">
        {canPreview(file.contentType) && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void openFile(projectId, env, file, false)}
            aria-label={`Preview ${file.key}`}
          >
            <EyeIcon />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void openFile(projectId, env, file, true)}
          aria-label={`Download ${file.key}`}
        >
          <DownloadIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label={`Delete ${file.key}`}
          className="hover:text-red-400"
        >
          <Trash2Icon />
        </Button>
      </div>
    </li>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  action,
  pending,
  onConfirm,
  destructive = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  action: string;
  pending: boolean;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{children}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive-solid" : "primary"}
            disabled={pending}
            onClick={(event: MouseEvent) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending ? `${action}…` : action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const EMPTY_KEYS: Set<string> = new Set();
const ENV_LABEL: Record<StorageEnv, string> = { PREVIEW: "Preview", LIVE: "Production" };

/** Tools → Storage (boards/Workspace-Storage.dc.html): the files this app has
 *  stored, with usage against the allowance. */
export function StoragePane({ projectId }: { projectId: string }) {
  const overview = useProjectStorage(projectId);
  const [params] = useSearchParams();
  const [env, setEnv] = useState<StorageEnv>(() =>
    params.get("storageEnv") === "LIVE" ? "LIVE" : "PREVIEW",
  );
  const [search, setSearch] = useState("");
  const prefix = useDebounced(search.trim(), 300);
  // What is picked belongs to one list; another environment or search is another list.
  const scope = `${env}|${prefix}`;
  const [pick, setPick] = useState<{ scope: string; keys: Set<string> }>({ scope: "", keys: new Set() });
  const selected = pick.scope === scope ? pick.keys : EMPTY_KEYS;
  const setSelected = (update: (s: Set<string>) => Set<string>) =>
    setPick((p) => ({ scope, keys: update(p.scope === scope ? p.keys : EMPTY_KEYS) }));
  const [clearing, setClearing] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<string[] | null>(null);

  const data = overview.data;
  const hasFiles = (data?.environments ?? []).some((e) => e.fileCount > 0);
  // Nothing to browse until the app has turned storage on or has stored something.
  const showFiles = Boolean(data && (data.enabled || hasFiles));
  const files = useStorageFiles(projectId, env, prefix, showFiles);
  const del = useDeleteStorageFiles(projectId, env);
  const clear = useClearPreviewFiles(projectId);
  const rotate = useRotateStorageKey(projectId, env);

  const rows = useMemo(() => files.data?.pages.flatMap((p) => p.files) ?? [], [files.data]);
  const current = data?.environments.find((e) => e.env === env);
  const previewCount = data?.environments.find((e) => e.env === "PREVIEW")?.fileCount ?? 0;

  const remove = (keys: string[]) => {
    del.mutate(keys, {
      onSuccess: () => {
        setSelected((s) => new Set([...s].filter((k) => !keys.includes(k))));
      },
      onSettled: () => setPendingKeys(null),
    });
  };

  const toggle = (key: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.key));

  return (
    <div className="h-full overflow-y-auto bg-space-void [scrollbar-gutter:stable]">
      <ToolPaneContent className="flex flex-col gap-[22px]">
        <PageHeader
          title="Storage"
          description="Files your app keeps for its users."
          actions={
            <>
              {data?.enabled && (
                <Button variant="secondary" onClick={() => setRotating(true)}>
                  <KeyRoundIcon />
                  Replace key
                </Button>
              )}
              {env === "PREVIEW" && previewCount > 0 && (
                <Button variant="destructive" onClick={() => setClearing(true)}>
                  <Trash2Icon />
                  Clear preview files
                </Button>
              )}
            </>
          }
        />

        {overview.isLoading ? (
          <Card className="flex flex-col gap-3 px-5.5 py-4.5" aria-busy="true" aria-label="Loading storage">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-1.5 w-full" />
          </Card>
        ) : overview.isError || !data ? (
          <Alert
            tone="danger"
            action={
              <Button variant="secondary" size="sm" onClick={() => void overview.refetch()}>
                Try again
              </Button>
            }
          >
            Couldn&apos;t load storage.
          </Alert>
        ) : (
          <>
            <Alert tone="info">
              Files your app keeps for its users. They stay when the preview is rebuilt, and only your app&apos;s
              server can read them. Files uploaded while testing in the preview are separate from the ones on your
              deployed app.
            </Alert>

            {data.suspended && (
              <Alert tone="danger">
                Storage for this app has been suspended by tau. Your files are kept, but nothing can be uploaded or
                opened until it is lifted.
              </Alert>
            )}

            <UsageCard used={data.usage.usedBytes} quota={data.usage.quotaBytes} maxFile={data.usage.maxFileBytes} />

            {!showFiles ? (
              <EmptyState
                icon={HardDriveIcon}
                title="This app doesn't store files"
                description="To let people upload pictures or documents, ask tau for it in the chat, for example “let users upload a profile picture”."
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {data.environments.length > 1 ? (
                    <Segmented
                      size="sm"
                      value={env}
                      onValueChange={(v) => setEnv(v as StorageEnv)}
                      aria-label="Environment"
                    >
                      {data.environments.map((e) => (
                        <SegmentedItem key={e.env} value={e.env}>
                          {ENV_LABEL[e.env]}
                        </SegmentedItem>
                      ))}
                    </Segmented>
                  ) : (
                    <span className="lab">{ENV_LABEL[env]}</span>
                  )}
                  {current && (
                    <span className="text-[12.5px] text-silver-500">
                      {current.fileCount} {current.fileCount === 1 ? "file" : "files"} ·{" "}
                      <span className="font-mono">{formatSize(current.usedBytes)}</span>
                    </span>
                  )}
                </div>

                <SearchInput
                  aria-label="Filter files by folder or name prefix"
                  placeholder="Filter by folder, e.g. users/42/"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                {selected.size > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-space-surface py-2 pr-2 pl-4">
                    <span className="text-[13px] text-silver-900">{selected.size} selected</span>
                    <div className="flex items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(() => new Set())}>
                        Clear selection
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setPendingKeys([...selected])}>
                        <Trash2Icon />
                        Delete selected
                      </Button>
                    </div>
                  </div>
                )}

                {files.isLoading ? (
                  <Card className="overflow-hidden" aria-busy="true" aria-label="Loading files">
                    {Array.from({ length: 3 }, (_, i) => (
                      <div key={i} className="flex h-[49px] items-center gap-4 border-t border-line px-5.5 first:border-t-0">
                        <Skeleton className="size-7" />
                        <Skeleton className="h-3 w-56" />
                      </div>
                    ))}
                  </Card>
                ) : files.isError ? (
                  <Alert
                    tone="danger"
                    action={
                      <Button variant="secondary" size="sm" onClick={() => void files.refetch()}>
                        Try again
                      </Button>
                    }
                  >
                    Couldn&apos;t load the files.
                  </Alert>
                ) : rows.length === 0 ? (
                  <EmptyState
                    icon={HardDriveIcon}
                    title={prefix ? "No matching files" : "No files yet"}
                    description={
                      prefix
                        ? "Try a different folder."
                        : env === "PREVIEW"
                          ? "Files uploaded while you test the app will show up here."
                          : "Files uploaded on your deployed app will show up here."
                    }
                  />
                ) : (
                  <Card className="overflow-hidden">
                    <div className={`${columns} h-[38px] bg-space-overlay px-5.5`}>
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() =>
                          setSelected(() => (allSelected ? new Set() : new Set(rows.map((r) => r.key))))
                        }
                        aria-label="Select all files shown"
                      />
                      <span className="lab pl-[42px]">Name</span>
                      <span className="lab hidden text-right sm:block">Size</span>
                      <span className="lab hidden text-right sm:block">Added</span>
                      <span />
                    </div>
                    <ul aria-label="Files">
                      {rows.map((f) => (
                        <FileRow
                          key={f.id}
                          file={f}
                          projectId={projectId}
                          env={env}
                          selected={selected.has(f.key)}
                          onToggle={() => toggle(f.key)}
                          onDelete={() => setPendingKeys([f.key])}
                        />
                      ))}
                    </ul>
                    {files.hasNextPage && (
                      <div className="flex justify-center border-t border-line p-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={files.isFetchingNextPage}
                          onClick={() => void files.fetchNextPage()}
                        >
                          Show more
                        </Button>
                      </div>
                    )}
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </ToolPaneContent>

      <ConfirmDialog
        open={pendingKeys !== null}
        onOpenChange={(open) => !open && setPendingKeys(null)}
        title={pendingKeys?.length === 1 ? "Delete file?" : `Delete ${pendingKeys?.length ?? 0} files?`}
        action="Delete"
        pending={del.isPending}
        onConfirm={() => pendingKeys && remove(pendingKeys)}
      >
        {pendingKeys?.length === 1 ? (
          <>
            <span className="font-mono text-silver-900">{pendingKeys[0]}</span> is deleted from{" "}
            {ENV_LABEL[env].toLowerCase()} storage. This can&apos;t be undone.
          </>
        ) : (
          <>The selected files are deleted from {ENV_LABEL[env].toLowerCase()} storage. This can&apos;t be undone.</>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title="Clear preview files?"
        action="Clear files"
        pending={clear.isPending}
        onConfirm={() => clear.mutate(undefined, { onSettled: () => setClearing(false) })}
      >
        {previewCount === 1 ? "The 1 file" : `All ${previewCount} files`} uploaded while testing the app in the
        preview will be permanently deleted. Files on your deployed app are not touched.
      </ConfirmDialog>

      <ConfirmDialog
        open={rotating}
        onOpenChange={setRotating}
        title="Replace the storage key?"
        action="Replace key"
        destructive={false}
        pending={rotate.isPending}
        onConfirm={() => rotate.mutate(undefined, { onSettled: () => setRotating(false) })}
      >
        {env === "LIVE"
          ? "Your deployed app gets a new key within a few seconds, without being rebuilt. "
          : "Your app gets a new key and its server restarts to pick it up. "}
        The old key keeps working for 24 hours, then stops. Do this if you think the key has leaked. Your files are
        not touched.
      </ConfirmDialog>
    </div>
  );
}
