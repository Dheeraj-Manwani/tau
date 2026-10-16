import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircleIcon, SparklesIcon, UploadIcon } from "lucide-react";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";
import toast from "react-hot-toast";
import TextareaAutosize from "react-textarea-autosize";
import { AppLogo } from "./AppLogo";

import { cn } from "@/src/lib/utils";
import { APP_BILLING } from "@/src/lib/routes";
import { useBalance } from "@/src/features/billing/api";
import { useUpgradeModalStore } from "@/src/features/billing/useUpgradeModalStore";
import {
  cleanAddressInput,
  useNameCheck,
  useGenerateLogo,
  useIdentity,
  useSaveIdentity,
  initialTitle,
  isScaffoldTitle,
  type IdentityView,
  type SaveIdentityInput,
} from "@/src/features/project/deploy";
import {
  LOGO_ACCEPT,
  logoFromSource,
  type LogoDraft,
} from "@/src/features/project/logoImage";

/** Same limits as the server's (`appIdentity.ts`); the API refuses anything over. */
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

/** `1,000` style is not needed here: prices are small whole numbers. */
const credits = (n: number) => `${n} credit${n === 1 ? "" : "s"}`;

/**
 * The app's name, description and logo, written into the project when saved.
 *
 * A mechanical edit by tau's server, not a chat turn, so nothing here waits on
 * the agent. Every price is printed on the control that spends it, with the
 * balance beside it, and a control the balance cannot cover is disabled and
 * points at buying credits (doc/PUBLISHING.md D7).
 */
export function IdentitySection({
  projectId,
  blocked = false,
  onDirtyChange,
  url,
}: {
  projectId: string | null;
  blocked?: boolean;
  onDirtyChange: (dirty: boolean) => void;
  url?: string | null;
}) {
  const query = useIdentity(projectId, true);
  const [saved, setSaved] = useState(false);
  const identity = query.data;
  if (!identity)
    return (
      <div role="status">
        {query.isError ? (
          <Alert
            tone="danger"
            action={
              <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          >
            Couldn&apos;t load name and logo.
          </Alert>
        ) : (
          <div className="flex flex-col gap-3" aria-label="Loading name and logo">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
      </div>
    );
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[15px] font-semibold">Name & logo</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-silver-500">
          Choose how your app appears in browser tabs, search results and shared
          links.
        </p>
      </div>
      {saved && (
        <Alert tone="success">Saved. Deploy changes to update the live site.</Alert>
      )}
      {blocked && (
        <p role="status" className="text-[13px] text-silver-500">
          Editing is available when the current project operation finishes and
          the site is not suspended.
        </p>
      )}
      <IdentityForm
        key={`${identity.title}|${identity.description}|${identity.icon}`}
        projectId={projectId}
        identity={identity}
        blocked={blocked || query.isError}
        onDirtyChange={onDirtyChange}
        onSaved={() => setSaved(true)}
        onEdit={() => setSaved(false)}
        url={url}
      />
    </div>
  );
}

function IdentityForm({
  projectId,
  identity,
  blocked,
  onDirtyChange,
  onSaved,
  onEdit,
  url,
}: {
  projectId: string | null;
  identity: IdentityView;
  blocked: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
  onEdit: () => void;
  url?: string | null;
}) {
  const startTitle = initialTitle(identity);
  const startDescription = identity.description ?? "";
  const [title, setTitle] = useState(startTitle);
  const [description, setDescription] = useState(startDescription);
  const [draft, setDraft] = useState<LogoDraft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: balance } = useBalance();
  const available = balance?.credits.available ?? 0;
  const openUpgrade = useUpgradeModalStore((s) => s.openModal);
  const save = useSaveIdentity(projectId);
  const generate = useGenerateLogo(projectId);

  const { prices } = identity;
  const isPro = identity.plan === "PRO";

  const titleChanged = title.trim() !== startTitle;
  const descriptionChanged = description.trim() !== startDescription;
  const dirty =
    (titleChanged && title.trim() !== "") ||
    descriptionChanged ||
    draft !== null;

  useEffect(() => {
    onDirtyChange(dirty || busy || save.isPending || generate.isPending);
  }, [dirty, busy, save.isPending, generate.isPending, onDirtyChange]);
  const draftUrl = draft?.previewUrl;
  useEffect(
    () => () => {
      if (draftUrl) URL.revokeObjectURL(draftUrl);
    },
    [draftUrl],
  );

  // A logo that came from the generator is already paid for.
  const saveCost = draft && !draft.generationId ? prices.logoUpload : 0;
  const cantAfford = saveCost > available;
  const generateShort = isPro && prices.logoGeneration > available;

  const take = (next: LogoDraft | null) => {
    if (next) onEdit();
    setDraft((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return next;
    });
  };

  const onFile = async (file: File | undefined) => {
    if (!file || blocked || save.isPending) return;
    setProblem(null);
    setBusy(true);
    try {
      take(await logoFromSource(file));
    } catch (err) {
      setProblem(
        err instanceof Error ? err.message : "Couldn't read that file.",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onGenerate = async () => {
    if (blocked || busy || save.isPending || generate.isPending) return;
    if (!isPro) {
      openUpgrade("Generate a logo with AI on the Pro plan");
      return;
    }
    setProblem(null);
    try {
      const made = await generate.mutateAsync();
      take(
        await logoFromSource(
          `data:${made.mimeType};base64,${made.image}`,
          made.generationId,
        ),
      );
    } catch (err) {
      // The request failure is already a toast; this is a picture that would not decode.
      if (err instanceof Error && !("status" in err)) setProblem(err.message);
    }
  };

  const onSave = () => {
    if (
      blocked ||
      !dirty ||
      save.isPending ||
      busy ||
      generate.isPending ||
      cantAfford
    )
      return;
    const input: SaveIdentityInput = {};
    if ((titleChanged || isScaffoldTitle(identity.title)) && title.trim())
      input.title = title.trim();
    if (descriptionChanged) input.description = description.trim();
    if (draft) {
      input.logo = {
        favicon: draft.favicon,
        icon512: draft.icon512,
        ...(draft.generationId ? { generationId: draft.generationId } : {}),
      };
    }
    save.mutate(input, {
      onSuccess: () => {
        take(null);
        onSaved();
      },
      onError: () => {},
    });
  };

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <fieldset
        disabled={blocked || save.isPending}
        className="min-w-0 space-y-5"
      >
        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium text-silver-900">
            Name
            <span className="font-mono text-[11px] font-normal text-silver-500">
              {title.length}/{TITLE_MAX}
            </span>
          </span>
          <input
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => {
              setTitle(e.target.value);
              onEdit();
            }}
            className="w-full rounded-md border border-line-strong bg-space-void text-[13px] text-silver-900 outline-none transition-[border-color,box-shadow] duration-150 hover:border-line-hover focus-visible:border-blue-500 focus-visible:shadow-[0_0_0_3px_rgb(96_165_250/0.2)] h-9 px-3"
          />
          <span className="mt-1.5 block text-xs leading-normal text-silver-500">
            The title in a browser tab and a shared link. Your address doesn't
            change.
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium text-silver-900">
            Description
            <span className="font-mono text-[11px] font-normal text-silver-500">
              {description.length}/{DESCRIPTION_MAX}
            </span>
          </span>
          <TextareaAutosize
            value={description}
            maxLength={DESCRIPTION_MAX}
            minRows={2}
            maxRows={6}
            onChange={(e) => {
              setDescription(e.target.value);
              onEdit();
            }}
            className="w-full rounded-md border border-line-strong bg-space-void text-[13px] text-silver-900 outline-none transition-[border-color,box-shadow] duration-150 hover:border-line-hover focus-visible:border-blue-500 focus-visible:shadow-[0_0_0_3px_rgb(96_165_250/0.2)] resize-none px-3 py-2.5 leading-[1.55]"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-silver-900">Logo</span>
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line-strong bg-space-surface">
              <AppLogo
                projectId={projectId}
                icon={identity.icon}
                draftUrl={draft?.previewUrl}
              />
            </div>
            <div className="min-w-0 flex-1 text-[13px] leading-snug text-silver-500">
              {draft ? (
                <>
                  New logo. Shown here at tab size:
                  <img
                    src={draft.previewUrl}
                    alt=""
                    aria-hidden
                    className="ml-1.5 inline-block size-4 align-middle"
                  />
                </>
              ) : identity.icon === "custom" ? (
                "Your own logo"
              ) : (
                "Tau's icon, until you choose one"
              )}
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={LOGO_ACCEPT}
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy || save.isPending}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? (
                <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
              ) : (
                <UploadIcon />
              )}
              Upload logo
              <span className="font-mono text-[11px] font-normal text-silver-500">
                {credits(prices.logoUpload)}
              </span>
            </Button>

            {(identity.canGenerate || !isPro) && (
              <Button
                variant="secondary"
                disabled={
                  generate.isPending ||
                  save.isPending ||
                  generateShort ||
                  (isPro && identity.generationsLeftToday === 0)
                }
                onClick={() => void onGenerate()}
              >
                {generate.isPending ? (
                  <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <SparklesIcon />
                )}
                {draft?.generationId ? "Regenerate" : "Generate logo"}
                {!isPro && <Badge tone="pro">PRO</Badge>}
                <span className="font-mono text-[11px] font-normal text-silver-500">
                  {credits(prices.logoGeneration)} · balance {Math.floor(available)}
                </span>
              </Button>
            )}
          </div>
          {generateShort && (
            <BuyCredits>
              Generating a logo needs {credits(prices.logoGeneration)}.
            </BuyCredits>
          )}
          {problem && (
            <p role="alert" className="mt-2 text-xs leading-snug text-red-400">
              {problem}
            </p>
          )}
        </div>

        <Button
          disabled={!dirty || cantAfford || busy || generate.isPending}
          loading={save.isPending}
          onClick={onSave}
        >
          {save.isPending
            ? "Saving…"
            : saveCost > 0
              ? `Save changes · ${credits(saveCost)}`
              : "Save changes"}
        </Button>
        {cantAfford && (
          <BuyCredits>Saving this logo needs {credits(saveCost)}.</BuyCredits>
        )}
        <p className="text-xs leading-normal text-silver-500">
          Name and description are free. Uploaded logos are charged when you
          save. Deploy after saving to update the live site.
        </p>
      </fieldset>
      <aside className="min-w-0 space-y-4 self-start rounded-lg border border-line bg-space-void p-4.5">
        <h3 className="lab">Appearance preview</h3>
        <div className="rounded-md border border-line bg-space-surface p-3">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded">
              <AppLogo
                projectId={projectId}
                icon={identity.icon}
                draftUrl={draft?.previewUrl}
              />
            </span>
            <span className="truncate">{title.trim() || "Your app name"}</span>
          </div>
          <p className="mt-3 truncate border-t border-line pt-2 font-mono text-[11px] text-silver-500">
            {url ?? "Your address is set on first deploy"}
          </p>
        </div>
        <div className="space-y-2">
          <p className="lab">Search & shared link</p>
          <p className="text-sm break-words text-blue-500">
            {title.trim() || "Your app name"}
          </p>
          <p className="text-xs leading-relaxed break-words text-silver-600">
            {description.trim() ||
              "Add a description to help visitors understand your app."}
          </p>
        </div>
        <p className="text-xs leading-relaxed text-silver-500">
          Preview of your saved or draft appearance. Search engines may take
          time to pick up a deployment.
        </p>
      </aside>
    </div>
  );
}

/**
 * The app's address, chosen once before the first deploy.
 *
 * Deliberately not inside the collapsed "Name and logo" section: it is the one
 * choice here that cannot be undone, so it is on view next to the Deploy
 * button. The title in a browser tab (the section below) is a different thing
 * and stays editable. The check runs as the owner types, after a short pause.
 */
export function AddressPicker({
  projectId,
  suggested,
  domain,
  value,
  onChange,
}: {
  projectId: string | null;
  suggested: string;
  domain: string | null;
  /** What was typed, or null while the suggestion is untouched. */
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const shown = value ?? suggested;
  const check = useNameCheck(projectId, shown);
  const stale = check.checking;
  const result =
    check.data && check.data.name === shown.trim().toLowerCase()
      ? check.data
      : null;

  return (
    <div className="rounded-md border border-line bg-space-void p-3.5">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-silver-900">
          Address{" "}
          <span className="font-normal text-silver-500">· fixed after you deploy</span>
        </span>
        <span className="flex h-9 items-center overflow-hidden rounded-md border border-line-strong bg-space-void transition-[border-color,box-shadow] duration-150 focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgb(96_165_250/0.2)] hover:border-line-hover">
          <input
            value={shown}
            maxLength={40}
            spellCheck={false}
            autoCapitalize="none"
            aria-label="Address"
            onChange={(e) => onChange(cleanAddressInput(e.target.value))}
            className="min-w-0 flex-1 bg-transparent px-3 font-mono text-[12.5px] text-silver-900 outline-none focus-visible:outline-none"
          />
          <span className="shrink-0 pr-3 font-mono text-[12px] text-silver-500">
            {domain ? `.${domain}` : ""}
          </span>
        </span>
      </label>
      <p
        className={cn(
          "mt-1.5 min-h-[16px] text-xs leading-snug",
          stale || !result
            ? "text-silver-500"
            : result.available
              ? "text-green-400"
              : "text-red-400",
        )}
        aria-live="polite"
      >
        {check.isError && !stale ? (
          <>
            Couldn't check this address.{" "}
            <button
              type="button"
              onClick={() => void check.retry()}
              className="cursor-pointer text-blue-500 underline-offset-3 hover:underline"
            >
              Try again
            </button>
          </>
        ) : stale || !result ? (
          "Checking…"
        ) : result.available ? (
          "Available."
        ) : (
          (result.message ?? "Not available.")
        )}
      </p>
    </div>
  );
}

/** Shown where a price cannot be paid: says so, and links to where credits are bought. */
export function BuyCredits({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-xs leading-snug text-orange-400">
      {children}{" "}
      <Link
        to={`${APP_BILLING}#buy-credits`}
        onClick={() => toast.dismiss()}
        className="font-medium text-blue-500 underline-offset-3 hover:text-blue-hi hover:underline"
      >
        Buy credits
      </Link>
    </p>
  );
}
