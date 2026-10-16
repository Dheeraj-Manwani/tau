import { useState } from "react";
import { KeyRoundIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

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
import { EmptyState } from "@/src/components/ui/empty-state";
import { Field } from "@/src/components/ui/field";
import { Input, SearchInput } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { Skeleton } from "@/src/components/ui/skeleton";
import { ToolPaneContent } from "./ToolPaneContent";
import {
  useDeleteProjectSecret,
  useProjectSecrets,
  useSetProjectSecret,
  type ProjectSecretSummary,
} from "@/src/features/project/secrets";

/** "2d ago", "just now": the Updated column is narrow and mono. */
function formatUpdated(iso: string): string {
  const ts = Date.parse(iso);
  if (!ts) return "";
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

/** Password managers must not offer to fill or save these fields. */
const noAutofill = {
  autoComplete: "off",
  spellCheck: false,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

const columns = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 sm:grid-cols-[minmax(0,250px)_minmax(0,1fr)_96px_60px]";

/**
 * One saved key. The value is never fetched (the server doesn't send it), so
 * "edit" means "replace": the field starts empty and saving overwrites.
 */
function KeyRow({
  projectId,
  secret,
  onDelete,
}: {
  projectId: string;
  secret: ProjectSecretSummary;
  onDelete: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const save = useSetProjectSecret(projectId);

  const commit = () => {
    if (!value.trim() || save.isPending) return;
    save.mutate(
      { name: secret.name, value },
      {
        onSuccess: () => {
          setValue("");
          setEditing(false);
        },
      },
    );
  };

  const cancel = () => {
    setValue("");
    setEditing(false);
  };

  return (
    <li className="border-t border-line transition-colors hover:bg-space-raised/40">
      <div className={`${columns} min-h-[49px] px-5.5 py-2`}>
        <span title={secret.name} className="truncate font-mono text-[12.5px] text-silver-900">
          {secret.name}
        </span>
        <span aria-label="Value hidden" className="hidden font-mono text-[12.5px] tracking-[0.14em] text-silver-500 sm:block">
          ••••••••••••••••
        </span>
        <span className="hidden text-right text-xs text-silver-500 sm:block">{formatUpdated(secret.updatedAt)}</span>
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label={`Replace ${secret.name}`} onClick={() => setEditing(true)}>
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${secret.name}`}
            onClick={() => onDelete(secret.name)}
            className="hover:text-red-400"
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      {editing && (
        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
          className="flex flex-wrap items-center gap-2 px-5.5 pb-3.5"
        >
          <Input
            autoFocus
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
            }}
            disabled={save.isPending}
            aria-label={`New value for ${secret.name}`}
            placeholder={`New value for ${secret.name}`}
            className="min-w-48 flex-1 font-mono text-[12.5px] placeholder:font-sans"
            {...noAutofill}
          />
          <Button type="button" variant="ghost" disabled={save.isPending} onClick={cancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!value.trim()} loading={save.isPending}>
            Replace value
          </Button>
        </form>
      )}
    </li>
  );
}

function NewSecretForm({
  projectId,
  existingNames,
  onClose,
}: {
  projectId: string;
  existingNames: string[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const save = useSetProjectSecret(projectId);
  const duplicate = existingNames.includes(name.trim());

  return (
    <Card className="p-5.5">
      <form
        autoComplete="off"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (duplicate || !name.trim() || !value.trim() || save.isPending) return;
          save.mutate({ name: name.trim(), value }, { onSuccess: onClose });
        }}
      >
        <h3 className="text-[15px] font-semibold">New secret</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Name"
            htmlFor="secret-name"
            error={duplicate ? "This secret already exists. Use Replace to update its value." : undefined}
            help="Uppercase letters, numbers and underscores."
          >
            <Input
              id="secret-name"
              autoFocus
              required
              pattern="[A-Z][A-Z0-9_]{1,63}"
              maxLength={64}
              title="Use 2–64 characters: uppercase letters, numbers and underscores, starting with a letter."
              placeholder="STRIPE_SECRET_KEY"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={save.isPending}
              aria-invalid={duplicate || undefined}
              className="font-mono text-[12.5px]"
              {...noAutofill}
            />
          </Field>
          <Field label="Value" htmlFor="secret-value">
            <Input
              id="secret-value"
              required
              type="password"
              maxLength={16384}
              placeholder="Enter secret value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={save.isPending}
              className="font-mono text-[12.5px] placeholder:font-sans"
              {...noAutofill}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={save.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={duplicate || !name.trim() || !value.trim()} loading={save.isPending}>
            Save secret
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Secrets management inside the Tools workspace (boards/Workspace-Secrets.dc.html).
 *  Values are never fetched. */
export function KeysPane({ projectId }: { projectId: string }) {
  const { data: secrets, isLoading, isError, refetch } = useProjectSecrets(projectId);
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const remove = useDeleteProjectSecret(projectId);
  const filteredSecrets = (secrets ?? []).filter((secret) =>
    secret.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const count = secrets?.length ?? 0;

  return (
    <div className="h-full overflow-y-auto bg-space-void [scrollbar-gutter:stable]">
      <ToolPaneContent className="flex flex-col gap-[22px]">
        <PageHeader
          title="Secrets"
          description="Keys and credentials your app needs at runtime."
          actions={
            <Button onClick={() => setAdding(true)} disabled={adding || isLoading || isError}>
              <PlusIcon />
              New secret
            </Button>
          }
        />
        <Alert tone="info">
          Encrypted and given only to your app&apos;s server. They are never saved in your code, shown in the chat, or
          pushed to GitHub. Changes apply to the running app right away.
        </Alert>

        {adding && (
          <NewSecretForm
            projectId={projectId}
            existingNames={(secrets ?? []).map((s) => s.name)}
            onClose={() => setAdding(false)}
          />
        )}

        {isLoading ? (
          <Card className="overflow-hidden" aria-busy="true" aria-label="Loading secrets">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex h-[49px] items-center gap-6 border-t border-line px-5.5 first:border-t-0">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </Card>
        ) : isError ? (
          <Alert
            tone="danger"
            action={
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          >
            Couldn&apos;t load secrets.
          </Alert>
        ) : count === 0 ? (
          !adding && (
            <EmptyState
              icon={KeyRoundIcon}
              title="No secrets yet"
              description="Add API keys and credentials for your app here."
              action={
                <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                  New secret
                </Button>
              }
            />
          )
        ) : (
          <>
            <SearchInput
              aria-label="Filter secrets by name"
              placeholder="Filter secrets by name"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {filteredSecrets.length === 0 ? (
              <EmptyState description="No secrets match that name." />
            ) : (
              <Card className="overflow-hidden">
                <div className={`${columns} h-[38px] bg-space-overlay px-5.5`} aria-hidden="true">
                  <span className="lab">Name</span>
                  <span className="lab hidden sm:block">Value</span>
                  <span className="lab hidden text-right sm:block">Updated</span>
                  <span />
                </div>
                <ul aria-label="Secrets">
                  {filteredSecrets.map((s) => (
                    <KeyRow key={s.name} projectId={projectId} secret={s} onDelete={setPendingDelete} />
                  ))}
                </ul>
              </Card>
            )}
            <p className="text-[12.5px] text-silver-500">
              {count} secret{count === 1 ? "" : "s"}. Values are write-only: once saved they can be replaced, never
              read back.
            </p>
          </>
        )}
      </ToolPaneContent>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete secret?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-silver-900">{pendingDelete}</span> is removed from your app&apos;s server
              right away. Anything in your app that reads it will stop working until you add it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-solid"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!pendingDelete) return;
                remove.mutate(pendingDelete, { onSuccess: () => setPendingDelete(null) });
              }}
            >
              <Trash2Icon />
              Delete secret
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
