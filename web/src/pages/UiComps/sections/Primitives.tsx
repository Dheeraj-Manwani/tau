/**
 * Every primitive in every state (doc/REDESIGN_PLAN.md, Phase 2), to compare
 * against boards/Controls.dc.html and boards/Surfaces.dc.html. Was `/_kit`.
 */
import { useId, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowRightIcon,
  CodeIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  HardDriveIcon,
  HomeIcon,
  KeyRoundIcon,
  LockIcon,
  MonitorIcon,
  PencilIcon,
  RefreshCwIcon,
  RocketIcon,
  SettingsIcon,
  SmartphoneIcon,
  TabletIcon,
  TrashIcon,
  TvMinimalIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";

import { Alert } from "@/src/components/ui/alert";
import { GithubMark as GithubIcon } from "@/src/components/ui/github-mark";
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";
import { Badge, StatusDot } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardHeader, CardRow, InsetWell, MetaLine, StatTile } from "@/src/components/ui/card";
import { Checkbox, ChoiceCard, RadioGroup, RadioGroupItem } from "@/src/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/src/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Field } from "@/src/components/ui/field";
import { FileDrop } from "@/src/components/ui/file-drop";
import { Input, InputGroup, SearchInput } from "@/src/components/ui/input";
import { Kbd } from "@/src/components/ui/kbd";
import { PageHeader } from "@/src/components/ui/page-header";
import { Pagination } from "@/src/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { CreditMeter, Progress } from "@/src/components/ui/progress";
import { Rating } from "@/src/components/ui/rating";
import { Segmented, SegmentedItem } from "@/src/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { SideNavItem, SideNavSection } from "@/src/components/ui/side-nav";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Switch } from "@/src/components/ui/switch";
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/src/components/ui/tooltip";
import { ComposerSettings } from "@/src/features/composer/ComposerSettings";
import { PromptComposer } from "@/src/features/composer/PromptComposer";
import type { Effort } from "@/src/features/project/types";

import { Row, Section, Spec } from "../frame";

export function Primitives() {
  const [view, setView] = useState("tools");
  const [effort, setEffort] = useState("high");
  const [device, setDevice] = useState("desktop");
  const [filter, setFilter] = useState("all");
  const [pack, setPack] = useState("500");
  const [rating, setRating] = useState(4);
  const [motion, setMotion] = useState(false);
  const [sound, setSound] = useState(true);
  const [page, setPage] = useState(1);
  const [nav, setNav] = useState("deploy");
  const navIndicator = useId();
  const [draft, setDraft] = useState("");
  const [composerEffort, setComposerEffort] = useState<Effort>("MAX");
  const [lookChosen, setLookChosen] = useState(false);

  return (
    <>

      <Section id="primitives-buttons" eyebrow="primitives · 01" title="Buttons">
        <Spec label="Variants">
          <Row>
            <Button>
              <RocketIcon />
              Deploy changes
            </Button>
            <Button variant="secondary">
              Open site
              <ExternalLinkIcon />
            </Button>
            <Button variant="ghost">Cancel</Button>
          </Row>
          <Row>
            <Button variant="destructive">Take site offline</Button>
            <Button variant="destructive-solid">
              <TrashIcon />
              Delete project
            </Button>
            <Button variant="upgrade">
              <ZapIcon />
              Upgrade to Pro
            </Button>
          </Row>
        </Spec>
        <Spec label="Disabled and loading">
          <Row>
            <Button disabled>Deploy</Button>
            <Button loading>Deploying</Button>
          </Row>
          <Row>
            <Button variant="secondary" disabled>
              Refresh
            </Button>
            <Button variant="secondary" loading>
              Refreshing
            </Button>
            <Button variant="destructive" loading>
              Deleting
            </Button>
          </Row>
        </Spec>
        <Spec label="Sizes · icon buttons · links">
          <Row>
            <Button size="sm">Save</Button>
            <Button variant="secondary" size="sm">
              Choose
            </Button>
            <Button>Save</Button>
            <Button size="lg">Start building</Button>
          </Row>
          <Row>
            <Button variant="ghost" size="icon" aria-label="Copy">
              <CopyIcon />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Refresh">
              <RefreshCwIcon />
            </Button>
            <Button variant="secondary" size="icon" aria-label="Settings">
              <SettingsIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Edit">
              <PencilIcon />
            </Button>
            <Button size="icon" aria-label="Send">
              <ArrowRightIcon />
            </Button>
          </Row>
          <Row>
            <Button variant="link">Manage custom domains</Button>
            <a href="#" className="eyebrow">
              ← Back to building
            </a>
          </Row>
        </Spec>
      </Section>

      <Section id="primitives-fields" eyebrow="primitives · 02" title="Fields">
        <Spec label="Text · states">
          <Field label="Name" htmlFor="kit-name" counter="30/60" help="The title in a browser tab and a shared link.">
            <Input id="kit-name" defaultValue="Daybook, a calm daily planner" />
          </Field>
          <Field label="Domain" htmlFor="kit-domain" error="Enter a full domain, like www.example.com.">
            <Input id="kit-domain" defaultValue="daybook" aria-invalid />
          </Field>
          <Field label="Disabled" htmlFor="kit-dis">
            <Input id="kit-dis" disabled defaultValue="end-to-end-todo" />
          </Field>
        </Spec>
        <Spec label="Textarea · select · search">
          <Field label="Description" htmlFor="kit-desc" counter="138/160">
            <Textarea
              id="kit-desc"
              defaultValue="A one-person daily planner that feels like paper: write tasks, cross them off, let the day settle."
            />
          </Field>
          <Field label="Type">
            <Select defaultValue="feedback">
              <SelectTrigger aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feedback">Feedback</SelectItem>
                <SelectItem value="bug">Bug report</SelectItem>
                <SelectItem value="idea">Idea for what's next</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <SearchInput placeholder="Search name or description" aria-label="Search" />
        </Spec>
        <Spec label="Input group · file drop · rating">
          <InputGroup>
            <Input placeholder="www.example.com" aria-label="Domain" />
            <Button>Connect</Button>
          </InputGroup>
          <InputGroup>
            <Input placeholder="PROMO-CODE" aria-label="Code" className="font-mono uppercase" />
            <Button variant="secondary">Apply</Button>
          </InputGroup>
          <FileDrop
            label="Add screenshots or files (optional)"
            caption="Up to 5 files. Images up to 5 MB; documents up to 10 MB."
          />
          <Rating value={rating} onChange={setRating} />
        </Spec>
        <Spec label="Switch · checkbox · radio">
          <label className="flex items-center justify-between gap-6">
            <span>
              <span className="block text-sm font-medium">Reduce motion</span>
              <span className="block text-[13px] text-silver-500">Turn off animated effects.</span>
            </span>
            <Switch checked={motion} onCheckedChange={setMotion} />
          </label>
          <label className="flex items-center justify-between gap-6">
            <span className="text-sm font-medium">Sound</span>
            <Switch checked={sound} onCheckedChange={setSound} />
          </label>
          <Row>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox defaultChecked /> Remember me
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox /> Subscribe
            </label>
            <RadioGroup defaultValue="monthly" className="flex gap-4">
              <label className="flex items-center gap-2 text-[13px]">
                <RadioGroupItem value="monthly" /> Monthly
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <RadioGroupItem value="yearly" /> Yearly
              </label>
            </RadioGroup>
          </Row>
        </Spec>
        <Spec label="Choice cards" wide>
          <RadioGroup value={pack} onValueChange={setPack} className="grid-cols-3 gap-2.5">
            {[
              ["100", "Quick fix", "₹49"],
              ["500", "Most picked", "₹199"],
              ["2,000", "Big ideas", "₹699"],
            ].map(([cr, name, price]) => (
              <ChoiceCard key={cr} value={cr!}>
                <span className={`eyebrow text-[10px] ${pack === cr ? "" : "text-silver-500!"}`}>{name}</span>
                <span className="display-heading text-[26px]">
                  {cr} <span className="font-mono text-[11px] text-silver-500">CR</span>
                </span>
                <span className="font-mono text-xs text-silver-600">{price}</span>
              </ChoiceCard>
            ))}
          </RadioGroup>
        </Spec>
      </Section>

      <Section id="primitives-selection" eyebrow="primitives · 03" title="Selection & navigation">
        <Spec label="Composer · Home, then chat" wide>
          <PromptComposer
            value={draft}
            onChange={setDraft}
            onSubmit={() => toast.success("Build")}
            placeholder="Make a kanban board with drag-and-drop…"
            minRows={2}
            submitLabel="Build"
            onAttach={() => {}}
            controls={
              <ComposerSettings
                effort={composerEffort}
                onEffortChange={setComposerEffort}
                style={{
                  label: lookChosen ? "Brutalist" : "Auto",
                  accent: lookChosen ? "#f97316" : undefined,
                  isAuto: !lookChosen,
                  detail: "Chosen for this project",
                  onAuto: () => setLookChosen(false),
                  onBrowse: () => setLookChosen(true),
                }}
              />
            }
          />
          <div className="max-w-[420px]">
            <PromptComposer
              value=""
              onChange={() => {}}
              onSubmit={() => {}}
              placeholder="Ask tau to change something…"
              compact
              onAttach={() => {}}
              controls={<ComposerSettings effort={composerEffort} onEffortChange={setComposerEffort} compact />}
            />
          </div>
        </Spec>
        <Spec label="Segmented · views">
          <Segmented value={view} onValueChange={setView} aria-label="View">
            <SegmentedItem value="preview">
              <TvMinimalIcon />
              PREVIEW
            </SegmentedItem>
            <SegmentedItem value="code">
              <CodeIcon />
              CODE
            </SegmentedItem>
            <SegmentedItem value="tools">
              <WrenchIcon />
              TOOLS
            </SegmentedItem>
          </Segmented>
          <Segmented value={device} onValueChange={setDevice} iconOnly aria-label="Device">
            <SegmentedItem value="desktop" aria-label="Desktop">
              <MonitorIcon />
            </SegmentedItem>
            <SegmentedItem value="tablet" aria-label="Tablet">
              <TabletIcon />
            </SegmentedItem>
            <SegmentedItem value="phone" aria-label="Phone">
              <SmartphoneIcon />
            </SegmentedItem>
          </Segmented>
          <Row>
            <Segmented value={effort} onValueChange={setEffort} size="sm" aria-label="Effort">
              <SegmentedItem value="low">Low</SegmentedItem>
              <SegmentedItem value="high">High</SegmentedItem>
              <SegmentedItem value="max">Max</SegmentedItem>
            </Segmented>
            <Segmented value={filter} onValueChange={setFilter} size="sm" aria-label="Filter">
              <SegmentedItem value="all">All</SegmentedItem>
              <SegmentedItem value="spent">Spent</SegmentedItem>
              <SegmentedItem value="added">Added</SegmentedItem>
            </Segmented>
          </Row>
        </Spec>
        <Spec label="Underline tabs · sections">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="identity">Name &amp; logo</TabsTrigger>
              <TabsTrigger value="deployments">
                Deployments
                <StatusDot tone="deploying" />
              </TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
            </TabsList>
            {[
              ["overview", "Where the app lives and what is running now."],
              ["identity", "The name and logo people see in the tab and on share cards."],
              ["deployments", "Every build, newest first, with its logs."],
              ["resources", "The database and storage this app uses."],
            ].map(([value, text]) => (
              <TabsContent key={value} value={value!} forceMount className="pt-4 text-[13px] text-silver-600">
                {text}
              </TabsContent>
            ))}
          </Tabs>
          <Tabs defaultValue="prs">
            <TabsList>
              <TabsTrigger value="changes">Changes</TabsTrigger>
              <TabsTrigger value="prs">
                Pull requests <TabsCount>3</TabsCount>
              </TabsTrigger>
              <TabsTrigger value="issues">Issues</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </Tabs>
        </Spec>
        <Spec label="Sidebar nav">
          <nav className="max-w-60">
            <SideNavSection label="Setup">
              <SideNavItem indicator={navIndicator} current={nav === "secrets"} onClick={() => setNav("secrets")}>
                <KeyRoundIcon />
                Secrets
              </SideNavItem>
              <SideNavItem indicator={navIndicator} current={nav === "storage"} onClick={() => setNav("storage")}>
                <HardDriveIcon />
                Storage
              </SideNavItem>
            </SideNavSection>
            <SideNavSection label="Delivery">
              <SideNavItem indicator={navIndicator} current={nav === "github"} onClick={() => setNav("github")}>
                <GithubIcon />
                GitHub
              </SideNavItem>
              <SideNavItem
                indicator={navIndicator}
                current={nav === "deploy"}
                onClick={() => setNav("deploy")}
                trailing={<StatusDot tone="unpublished" size={6} />}
              >
                <RocketIcon />
                Deploy
              </SideNavItem>
              <SideNavItem
                indicator={navIndicator}
                current={nav === "domains"}
                onClick={() => setNav("domains")}
                trailing={<LockIcon className="text-silver-500" />}
              >
                <GlobeIcon />
                Domains
              </SideNavItem>
            </SideNavSection>
          </nav>
        </Spec>
        <Spec label="Toolbar triggers · pagination · status dots">
          <Row>
            <Button variant="ghost" className="px-2.5 text-silver-900">
              end to end todo
            </Button>
          </Row>
          <Row>
            <Button variant="secondary">
              <GithubIcon />
              GitHub
              <StatusDot tone="unpublished" size={6} />
            </Button>
            <Button variant="secondary">
              <StatusDot tone="unpublished" size={6} />
              Deployed
            </Button>
            <Button variant="secondary">
              <StatusDot tone="deploying" />
              Deploying…
            </Button>
          </Row>
          <Pagination page={page} hasNext={page < 3} onPrevious={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />
          <div className="flex flex-col gap-3 text-[13px]">
            {(
              [
                ["live", "Live and current"],
                ["unpublished", "Live, with unpublished changes"],
                ["deploying", "Deploying"],
                ["failed", "Failed"],
                ["offline", "Offline"],
              ] as const
            ).map(([tone, text]) => (
              <span key={tone} className="flex items-center gap-2.5">
                <StatusDot tone={tone} />
                {text}
              </span>
            ))}
          </div>
        </Spec>
      </Section>

      <Section id="primitives-status" eyebrow="primitives · 04" title="Status & feedback">
        <Spec label="Alerts" wide>
          <Alert tone="warning">
            This project has a database, and deploying a database isn't available yet. Deploying will stop and tell you
            so; your preview is unaffected.
          </Alert>
          <Alert tone="info">DNS changes can take from a few minutes to a few hours. This page updates itself while it waits.</Alert>
          <Alert tone="success">Deployment fa300053 is live. Your previous version was replaced.</Alert>
          <Alert
            tone="danger"
            action={
              <Button variant="secondary" size="sm">
                View log
              </Button>
            }
          >
            The build failed at “Build app”. <span className="text-silver-600">Your live site is unchanged.</span>
          </Alert>
        </Spec>
        <Spec label="Badges · toast · tooltip">
          <Row>
            <Badge>Draft</Badge>
            <Badge tone="blue">Latest</Badge>
            <Badge tone="green" dot>
              Live
            </Badge>
            <Badge tone="orange" dot>
              Unpublished
            </Badge>
            <Badge tone="red">Failed</Badge>
            <Badge tone="pro">
              <ZapIcon />
              PRO
            </Badge>
            <Badge tone="mono">Admin</Badge>
          </Row>
          <Row>
            <Button variant="secondary" size="sm" onClick={() => toast.success("Deployment is live")}>
              Show toast
            </Button>
            <Button variant="secondary" size="sm" onClick={() => toast.error("The build failed")}>
              Error toast
            </Button>
          </Row>
          <Row>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="sm">
                  Hover me
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clears the chat, keeps your files</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" aria-label="Send">
                  <ArrowRightIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Send <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd>
              </TooltipContent>
            </Tooltip>
          </Row>
        </Spec>
        <Spec label="Progress · meter · loading">
          <Progress value={62} label="Uploading logo" />
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between text-[13px]">
              <span>Credits</span>
              <span className="font-mono text-xs text-silver-500">47.6 CR</span>
            </div>
            <CreditMeter value={34} />
          </div>
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-[90%]" />
            <Skeleton className="h-3 w-[45%]" />
          </div>
        </Spec>
        <Spec label="Empty · avatar · meta line">
          <EmptyState description="No domains connected yet." />
          <EmptyState
            icon={KeyRoundIcon}
            title="No secrets yet"
            description="Add API keys and credentials for your app here."
            action={
              <Button variant="secondary" size="sm">
                New secret
              </Button>
            }
          />
          <Row>
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px]">MT</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>MT</AvatarFallback>
            </Avatar>
            <Avatar className="size-10">
              <AvatarFallback className="text-[13px]">MT</AvatarFallback>
            </Avatar>
            <Avatar className="shadow-[0_0_0_2px_var(--space-void),0_0_0_4px_var(--blue-500)]">
              <AvatarFallback>MT</AvatarFallback>
            </Avatar>
          </Row>
          <MetaLine items={["Deployed 1d ago", "Version fa300053", "23 files", "1.0 MB"]} />
        </Spec>
      </Section>

      <Section id="primitives-menus" eyebrow="primitives · 05" title="Menus & overlays">
        <Spec label="Dropdown menu">
          <Row>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Open menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuItem>
                  <HomeIcon />
                  Default item
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ZapIcon />
                  With value
                  <DropdownMenuShortcut className="text-orange-400">47.6</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <SettingsIcon />
                    With submenu
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>Workspace tour</DropdownMenuItem>
                    <DropdownMenuItem>Preview tour</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem>
                  <PencilIcon />
                  With hint
                  <DropdownMenuShortcut>
                    <Kbd>⌘K</Kbd>
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <LockIcon />
                  Disabled
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <TrashIcon />
                  Destructive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary">Preview path</Button>
              </PopoverTrigger>
              <PopoverContent align="start">
                <p className="mb-2 text-[13px] font-medium">Preview path</p>
                <InputGroup>
                  <Input defaultValue="/" aria-label="Path" className="font-mono" />
                  <Button>Go</Button>
                </InputGroup>
                <p className="mt-2 text-xs text-silver-500">Enter a path or paste a URL.</p>
              </PopoverContent>
            </Popover>
          </Row>
        </Spec>
        <Spec label="Dialogs">
          <Row>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open dialog</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Help shape tau</DialogTitle>
                  <DialogDescription>Share your experience or an idea for what's next.</DialogDescription>
                </DialogHeader>
                <Field label="Message (optional)" counter="86 / 5,000">
                  <Textarea defaultValue="The deploy page is much clearer now." />
                </Field>
                <DialogFooter>
                  <Button variant="secondary">Cancel</Button>
                  <Button>Send feedback</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete project</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete project?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes <b className="text-silver-900">end to end todo</b>, its code and its chat. Its live site
                    goes offline. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive-solid">
                    <TrashIcon />
                    Delete project
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Row>
        </Spec>
      </Section>

      <Section id="primitives-cards" eyebrow="primitives · 06" title="Cards & rows">
        <Card>
          <CardHeader title="Address & domains" description="Where people can reach your app." />
          <CardRow
            label="Tau address"
            detail={<span className="font-mono text-blue-500">end-to-end-todo-1f748e.bytauai.pro</span>}
            action={
              <Button variant="ghost" size="icon" aria-label="Copy address">
                <CopyIcon />
              </Button>
            }
          />
          <CardRow
            label="Custom domains"
            detail="None connected"
            action={
              <Button variant="secondary" size="sm">
                Manage
              </Button>
            }
          />
        </Card>
        <Card className="p-5.5">
          <InsetWell caption="Production server · last hour · secret values are masked">
            Nothing printed in the last hour.
          </InsetWell>
        </Card>
        <Card className="p-5.5">
          <StatTile label="Available credits" badge={<Badge tone="pro">PRO PLAN</Badge>} value="47.6" unit="CR">
            <CreditMeter value={100} />
            <div className="flex flex-wrap gap-4.5 font-mono text-[11.5px] text-silver-500">
              <span>
                <span className="text-silver-900">0</span> FREE · used first
              </span>
              <span>
                <span className="text-orange-400">47.6</span> BONUS · never expires
              </span>
            </div>
          </StatTile>
        </Card>
        <Card className="col-span-full p-6">
          <PageHeader
            title="Deploy"
            description="Make your app live and manage every deployment."
            actions={
              <>
                <span className="flex items-center gap-2 text-[13px] text-silver-600">
                  <StatusDot tone="live" /> Live
                </span>
                <Button>
                  <RocketIcon />
                  Deploy changes
                </Button>
              </>
            }
          />
        </Card>
      </Section>
    </>
  );
}
