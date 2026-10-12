import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircleIcon, SparklesIcon, UploadIcon } from "lucide-react";
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
      <div role="status" className="py-4 text-xs text-silver-600">
        {query.isError ? (
          <>
            Couldn't load name and logo.{" "}
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="text-blue-500 underline"
            >
              Try again
            </button>
          </>
        ) : (
          <span className="flex items-center gap-2">
            <LoaderCircleIcon className="size-4 animate-spin" />
            Loading name and logo…
          </span>
        )}
      </div>
    );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium">Name & logo</h2>
        <p className="mt-1 text-xs leading-relaxed text-silver-600">
          Choose how your app appears in browser tabs, search results and shared
          links.
        </p>
      </div>
      {saved && (
        <p
          role="status"
          className="rounded-lg bg-emerald-400/10 p-3 text-xs text-emerald-300"
        >
          Saved. Deploy changes to update the live site.
        </p>
      )}
      {blocked && (
        <p role="status" className="text-xs text-silver-600">
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <fieldset
        disabled={blocked || save.isPending}
        className="min-w-0 space-y-5"
      >
        <label className="block">
          <span className="mb-1 flex justify-between text-[11px] text-silver-600">
            Name
            <span>
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
            className="w-full rounded-md border border-silver-400/30 bg-space-surface px-2 py-1.5 text-xs text-silver-900 outline-none focus:border-brand"
          />
          <span className="mt-1 block text-[10px] leading-snug text-silver-600">
            The title in a browser tab and a shared link. Your address doesn't
            change.
          </span>
        </label>

        <label className="block">
          <span className="mb-1 flex justify-between text-[11px] text-silver-600">
            Description
            <span>
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
            className="w-full resize-none rounded-md border border-silver-400/30 bg-space-surface px-2 py-1.5 text-xs text-silver-900 outline-none focus:border-brand"
          />
        </label>

        <div>
          <span className="mb-1 block text-[11px] text-silver-600">Logo</span>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-silver-400/30 bg-space-surface">
              <AppLogo
                projectId={projectId}
                icon={identity.icon}
                draftUrl={draft?.previewUrl}
              />
            </div>
            <div className="min-w-0 flex-1 text-[11px] leading-snug text-silver-600">
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
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={busy || save.isPending}
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-0.5 rounded-md border border-silver-400/30 px-2 py-1.5 text-[11px] font-medium text-silver-900 transition-colors hover:bg-space-overlay disabled:opacity-50"
            >
              <span className="flex items-center gap-1">
                {busy ? (
                  <LoaderCircleIcon className="size-3 animate-spin" />
                ) : (
                  <UploadIcon className="size-3" />
                )}
                Upload logo
              </span>
              <span className="text-[10px] font-normal text-silver-600">
                {credits(prices.logoUpload)}
              </span>
            </button>

            {(identity.canGenerate || !isPro) && (
              <button
                type="button"
                disabled={
                  generate.isPending ||
                  save.isPending ||
                  generateShort ||
                  (isPro && identity.generationsLeftToday === 0)
                }
                onClick={() => void onGenerate()}
                className="flex flex-col items-center gap-0.5 rounded-md border border-silver-400/30 px-2 py-1.5 text-[11px] font-medium text-silver-900 transition-colors hover:bg-space-overlay disabled:opacity-50"
              >
                <span className="flex items-center gap-1">
                  {generate.isPending ? (
                    <LoaderCircleIcon className="size-3 animate-spin" />
                  ) : (
                    <SparklesIcon className="size-3" />
                  )}
                  {draft?.generationId ? "Regenerate" : "Generate logo"}
                  {!isPro && (
                    <span className="rounded-full bg-brand/10 px-1.5 py-px text-[10px] font-semibold text-brand">
                      PRO
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-normal text-silver-600">
                  {credits(prices.logoGeneration)} · balance{" "}
                  {Math.floor(available)}
                </span>
              </button>
            )}
          </div>
          {generateShort && (
            <BuyCredits>
              Generating a logo needs {credits(prices.logoGeneration)}.
            </BuyCredits>
          )}
          {problem && (
            <p className="mt-1.5 text-[11px] leading-snug text-red-300">
              {problem}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={
            !dirty || save.isPending || cantAfford || busy || generate.isPending
          }
          onClick={onSave}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-silver-400/30 px-3 py-1.5 text-xs font-medium text-silver-900 transition-colors hover:bg-space-overlay disabled:cursor-not-allowed disabled:opacity-50"
        >
          {save.isPending && (
            <LoaderCircleIcon className="size-3.5 animate-spin" />
          )}
          {save.isPending
            ? "Saving…"
            : saveCost > 0
              ? `Save changes · ${credits(saveCost)}`
              : "Save changes"}
        </button>
        {cantAfford && (
          <BuyCredits>Saving this logo needs {credits(saveCost)}.</BuyCredits>
        )}
        <p className="text-[10px] leading-snug text-silver-600">
          Name and description are free. Uploaded logos are charged when you
          save. Deploy after saving to update the live site.
        </p>
      </fieldset>
      <aside className="min-w-0 space-y-4 rounded-xl border border-silver-200 bg-space-void/40 p-4 self-start">
        <h3 className="text-xs font-medium text-silver-600">
          Appearance preview
        </h3>
        <div className="rounded-lg border border-silver-200 bg-space-surface p-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded">
              <AppLogo
                projectId={projectId}
                icon={identity.icon}
                draftUrl={draft?.previewUrl}
              />
            </span>
            <span className="truncate">{title.trim() || "Your app name"}</span>
          </div>
          <p className="mt-3 truncate border-t border-silver-200 pt-2 text-[11px] text-silver-600">
            {url ?? "Your address is set on first deploy"}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] text-silver-600">Search & shared link</p>
          <p className="break-words text-sm text-blue-400">
            {title.trim() || "Your app name"}
          </p>
          <p className="break-words text-xs leading-relaxed text-silver-600">
            {description.trim() ||
              "Add a description to help visitors understand your app."}
          </p>
        </div>
        <p className="text-[11px] leading-relaxed text-silver-600">
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
    <div className="rounded-lg border border-silver-400/20 bg-space-void/40 p-3">
      <label className="block">
        <span className="mb-1 block text-[11px] text-silver-600">
          Address{" "}
          <span className="text-silver-600">· fixed after you deploy</span>
        </span>
        <span className="flex items-center overflow-hidden rounded-md border border-silver-400/30 bg-space-surface focus-within:border-brand">
          <input
            value={shown}
            maxLength={40}
            spellCheck={false}
            autoCapitalize="none"
            aria-label="Address"
            onChange={(e) => onChange(cleanAddressInput(e.target.value))}
            className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-xs text-silver-900 outline-none"
          />
          <span className="shrink-0 pr-2 text-[11px] text-silver-600">
            {domain ? `.${domain}` : ""}
          </span>
        </span>
      </label>
      <p
        className={cn(
          "mt-1.5 min-h-[14px] text-[11px] leading-snug",
          stale || !result
            ? "text-silver-600"
            : result.available
              ? "text-green-400"
              : "text-red-300",
        )}
        aria-live="polite"
      >
        {check.isError && !stale ? (
          <>
            Couldn't check this address.{" "}
            <button
              type="button"
              onClick={() => void check.retry()}
              className="text-blue-500 underline"
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
    <p className="mt-1.5 text-[11px] leading-snug text-amber-200">
      {children}{" "}
      <Link
        to={`${APP_BILLING}#buy-credits`}
        onClick={() => toast.dismiss()}
        className="font-medium underline underline-offset-2"
      >
        Buy credits
      </Link>
    </p>
  );
}
