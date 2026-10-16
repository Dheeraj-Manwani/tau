import { useState } from "react";
import {
  CopyIcon,
  GlobeIcon,
  InfoIcon,
  LockIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import toast from "react-hot-toast";

import { cn } from "@/src/lib/utils";
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
import { Badge, StatusDot } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Input, InputGroup } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { Skeleton } from "@/src/components/ui/skeleton";
import { ToolPaneContent } from "./ToolPaneContent";
import { useDeployStatus } from "@/src/features/project/deploy";
import { useProjectToolNavigation } from "@/src/features/project/toolNavigation";
import {
  domainStatusLabel,
  isWaiting,
  recordCheck,
  recordsInPlace,
  useAddDomain,
  useCheckDomain,
  useDomains,
  useRemoveDomain,
  useSetPrimary,
  type DnsRecord,
  type DomainView,
} from "@/src/features/project/domains";

const description = (
  <>
    Show your app at a domain you own, like <span className="font-mono text-[13px]">www.example.com</span>. Tau gives
    you two records to add where you bought the domain, then watches for them.
  </>
);

/**
 * Tools -> Domains (boards/Workspace-Domains.dc.html): connect a domain bought
 * somewhere else.
 *
 * The owner types a name and is shown two records to add at their registrar.
 * Tau watches for them and moves the domain along; this pane shows where it
 * is, record by record, and what to do when it is stuck.
 */
export function DomainsPane({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch } = useDomains(projectId);
  const { data: deploy, isLoading: deployLoading } = useDeployStatus(projectId);
  const [input, setInput] = useState("");
  const add = useAddDomain(projectId);
  const navigateToTool = useProjectToolNavigation();

  const deployed = !!deploy?.live;
  const connect = () => {
    const hostname = input.trim();
    if (!deployed || !hostname || add.isPending) return;
    add.mutate(hostname, { onSuccess: () => setInput("") });
  };

  return (
    <div className="h-full overflow-y-auto bg-space-void [scrollbar-gutter:stable]">
      <ToolPaneContent className="flex flex-col gap-[22px]">
        <PageHeader title="Domains" description={description} />

        {deployLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : !deployed ? (
          <EmptyState
            icon={LockIcon}
            title="Deploy your app to attach domains"
            description="Custom domains unlock once your site is live. Your tau address keeps working either way."
            action={
              <Button variant="secondary" size="sm" onClick={() => navigateToTool("deploy", "overview")}>
                Open Deploy
              </Button>
            }
          />
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                connect();
              }}
            >
              <InputGroup className="gap-2.5">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="www.example.com"
                  aria-label="Domain"
                  spellCheck={false}
                  autoCapitalize="none"
                  className="h-10 font-mono"
                />
                <Button type="submit" disabled={!input.trim()} loading={add.isPending} className="h-10 px-5">
                  Connect
                </Button>
              </InputGroup>
            </form>

            {isLoading ? (
              <Card className="flex items-center gap-3 px-5.5 py-4.5" aria-busy="true" aria-label="Loading domains">
                <Skeleton className="size-9" />
                <Skeleton className="h-3.5 w-48" />
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
                Couldn&apos;t load your domains.
              </Alert>
            ) : data && data.domains.length > 0 ? (
              <ul className="flex flex-col gap-[22px]">
                {data.domains.map((domain) => (
                  <DomainCard key={domain.id} projectId={projectId} domain={domain} />
                ))}
              </ul>
            ) : (
              <EmptyState description="No domains connected yet." />
            )}
          </>
        )}

        <Guidance />
      </ToolPaneContent>
    </div>
  );
}

function StatusBadge({ status }: { status: DomainView["status"] }) {
  if (status === "ACTIVE")
    return (
      <Badge tone="green" dot>
        Live
      </Badge>
    );
  if (status === "FAILED") return <Badge tone="red">{domainStatusLabel(status)}</Badge>;
  return (
    <Badge tone="orange">
      <StatusDot tone="deploying" className="size-3 text-current" />
      {domainStatusLabel(status)}
    </Badge>
  );
}

/** "Checked 20s ago", from the last DNS look. */
function checkedAgo(iso: string | null): string | null {
  const ts = iso ? Date.parse(iso) : NaN;
  if (!ts) return null;
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return `Checked ${sec}s ago`;
  const min = Math.round(sec / 60);
  return `Checked ${min}m ago`;
}

function DomainCard({ projectId, domain }: { projectId: string; domain: DomainView }) {
  const check = useCheckDomain(projectId);
  const primary = useSetPrimary(projectId);
  const remove = useRemoveDomain(projectId);
  const [confirming, setConfirming] = useState(false);
  const [showRecords, setShowRecords] = useState(false);

  const waiting = isWaiting(domain.status);
  const active = domain.status === "ACTIVE";
  // Active domains need no records on screen; failed and waiting ones do.
  const recordsVisible = !active || showRecords;
  const summary = active
    ? domain.isPrimary
      ? "SSL issued · your tau address redirects here"
      : "SSL issued · serving your app"
    : waiting
      ? recordsInPlace(domain.dns)
        ? "Both records are in place. Waiting for the certificate, which usually takes a few minutes."
        : "Add both records where you bought the domain."
      : "Tau couldn't connect this domain.";

  return (
    <li>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5.5 py-4.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line-strong bg-space-overlay text-silver-600">
              <GlobeIcon className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={`https://${domain.hostname}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate font-mono text-sm font-semibold text-silver-900 underline-offset-3 hover:underline"
                >
                  {domain.hostname}
                </a>
                <StatusBadge status={domain.status} />
                {domain.isPrimary && <Badge>Primary</Badge>}
              </div>
              <p className="mt-0.5 text-[12.5px] text-silver-500">{summary}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {(waiting || domain.status === "FAILED") && (
              <Button variant="secondary" size="sm" loading={check.isPending} onClick={() => check.mutate(domain.id)}>
                {!check.isPending && <RefreshCwIcon />}
                {domain.status === "FAILED" ? "Try again" : "Check now"}
              </Button>
            )}
            {active && (
              <Button variant="secondary" size="sm" onClick={() => setShowRecords((v) => !v)}>
                {showRecords ? "Hide DNS records" : "View DNS records"}
              </Button>
            )}
            {active ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${domain.hostname}`}>
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={primary.isPending}
                    onSelect={() => primary.mutate({ domainId: domain.id, primary: !domain.isPrimary })}
                  >
                    <StarIcon />
                    {domain.isPrimary ? "Stop being primary" : "Make primary"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
                    <Trash2Icon />
                    Remove domain
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${domain.hostname}`}
                onClick={() => setConfirming(true)}
                className="hover:text-red-400"
              >
                <Trash2Icon />
              </Button>
            )}
          </div>
        </div>

        {domain.status === "FAILED" && domain.error && (
          <div className="px-5.5 pb-4">
            <Alert tone="danger">{domain.error}</Alert>
          </div>
        )}

        {recordsVisible && <RecordsTable domain={domain} />}

        {waiting && (
          <div className="flex items-start gap-2.5 border-t border-line px-5.5 py-3.5 text-[12.5px] leading-relaxed text-silver-600">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-orange-400" />
            <p>
              Add the <b className="font-medium text-silver-900">TXT record first</b>. It proves the domain is yours,
              and tau won&apos;t connect it until it sees it.
              {checkedAgo(domain.lastCheckedAt) && <> {checkedAgo(domain.lastCheckedAt)}.</>}
            </p>
          </div>
        )}
      </Card>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove domain?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-silver-900">{domain.hostname}</span>{" "}
              {active
                ? "stops showing your app. Your tau address keeps working."
                : "is no longer watched. You can connect it again later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-solid"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                remove.mutate(domain.id, { onSettled: () => setConfirming(false) });
              }}
            >
              {remove.isPending ? "Removing…" : "Remove domain"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

const recordColumns = "grid grid-cols-[64px_minmax(0,1fr)] gap-x-4 gap-y-1.5 sm:grid-cols-[72px_minmax(0,170px)_minmax(0,1fr)_auto] sm:items-center";

function RecordsTable({ domain }: { domain: DomainView }) {
  return (
    <div className="border-t border-line">
      <div className={cn(recordColumns, "hidden h-9 bg-space-overlay px-5.5 sm:grid")} aria-hidden="true">
        <span className="lab">Type</span>
        <span className="lab">Name</span>
        <span className="lab">Value</span>
        <span className="w-[150px]" />
      </div>
      {domain.records.map((record) => (
        <RecordRow key={`${record.type}-${record.name}`} record={record} dns={domain.dns} />
      ))}
      {domain.kind === "root" && (
        <p className="border-t border-line px-5.5 py-3 text-xs leading-relaxed text-silver-500">
          A root domain can&apos;t use a CNAME. Use an <strong className="text-silver-900">ALIAS</strong> (some
          registrars call it ANAME, or let you put a CNAME on <span className="font-mono">@</span>). If yours has none,
          connect <span className="font-mono">www</span> instead and switch on your registrar&apos;s &ldquo;forward
          root to www&rdquo;.
        </p>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy");
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy ${label}`}
      className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-[7px] border border-line-strong px-2 text-[11px] font-medium text-silver-600 transition-colors hover:bg-space-raised hover:text-silver-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      <CopyIcon className="size-3" />
      Copy
    </button>
  );
}

function RecordRow({ record, dns }: { record: DnsRecord; dns: DomainView["dns"] }) {
  const state = recordCheck(record, dns);
  return (
    <div className={cn(recordColumns, "border-t border-line px-5.5 py-3 text-[12.5px]")}>
      <Badge className="justify-self-start font-mono">{record.type}</Badge>
      <span className="font-mono text-xs break-all text-silver-900">{record.name}</span>
      <span className="col-span-2 font-mono text-xs break-all text-silver-600 sm:col-span-1">{record.value}</span>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:justify-end">
        {state === "found" ? (
          <Badge tone="green" dot>
            Found
          </Badge>
        ) : state === "points elsewhere" ? (
          <Badge tone="red" dot>
            Points elsewhere
          </Badge>
        ) : state === null ? null : (
          <Badge tone="orange" dot>
            Not found yet
          </Badge>
        )}
        <CopyButton text={record.value} label={`${record.type} value`} />
      </div>
    </div>
  );
}

const GUIDANCE = [
  "DNS changes can take from a few minutes to a few hours. This page updates itself while it waits.",
  "Add the TXT record first. It proves the domain is yours, and tau won't connect the domain until it sees it.",
  "If you sign in to your app with a third-party service (Google, GitHub and so on), add the new address to its allowed callback URLs.",
];

function Guidance() {
  return (
    <Card className="flex flex-col gap-3 px-5.5 py-5">
      <h3 className="text-sm font-semibold">Good to know</h3>
      <ol className="flex flex-col gap-3">
        {GUIDANCE.map((text, i) => (
          <li key={i} className="flex gap-3.5 text-[12.5px] leading-relaxed text-silver-600">
            <span className="font-mono text-silver-500">{String(i + 1).padStart(2, "0")}</span>
            <span>{text}</span>
          </li>
        ))}
        <li className="flex gap-3.5 text-[12.5px] leading-relaxed text-silver-600">
          <span className="font-mono text-silver-500">04</span>
          <span>
            With a <b className="font-medium text-silver-900">primary</b> domain, your tau address redirects to it.
          </span>
        </li>
      </ol>
    </Card>
  );
}
