import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangleIcon,
  CoffeeIcon,
  CompassIcon,
  LogOutIcon,
  MessageSquareIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserIcon,
  ZapIcon,
} from "lucide-react";

import { UserAvatar } from "@/src/components/UserAvatar";
import { Badge } from "@/src/components/ui/badge";
import { DataSpinner } from "@/src/components/ui/data-spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { useMe } from "@/src/features/auth/queries";
import { useLogout } from "@/src/features/auth/mutations";
import { useBalance } from "@/src/features/billing/api";
import { useSettingsStore } from "@/src/stores/useSettingsStore";
import { env } from "@/src/lib/env";
import { APP_ACCOUNT, APP_BILLING } from "@/src/lib/routes";
import { nameOf } from "@/src/features/account/identity";
import { TOUR_IDS, TOUR_INFO } from "@/src/features/tour/tours";
import { useFeedbackStore } from "@/src/features/feedback/useFeedbackStore";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { useSupportStore } from "@/src/features/support/useSupportStore";

const LOW_CREDITS = 10;

/**
 * The avatar menu (boards/Overlays.dc.html "Menus in context"): who you are,
 * then credits in orange mono and the admin-only console with a quiet mono
 * badge, then help, then account, settings and log out. The avatar gets a blue ring
 * offset by the page colour while the menu is open.
 */
export function UserMenu() {
  const navigate = useNavigate();
  const { data: user } = useMe();
  const logout = useLogout();
  const { data: balance, isLoading: balanceLoading } = useBalance();

  const openSettings = useSettingsStore((s) => s.openSettings);
  const requestTour = useSettingsStore((s) => s.requestTour);
  const inProject = useLocation().pathname.startsWith("/project/");
  const openFeedback = useFeedbackStore((s) => s.open);
  const openSupport = useSupportStore((s) => s.open);

  if (!user) return null;

  const available = balance?.credits.available;
  const isLow = available !== undefined && available < LOW_CREDITS;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          data-tour="account-menu"
          className="cursor-pointer rounded-full transition-shadow duration-150 hover:shadow-[0_0_0_2px_var(--space-void),0_0_0_4px_var(--blue-500)] data-[state=open]:shadow-[0_0_0_2px_var(--space-void),0_0_0_4px_var(--blue-500)]"
        >
          <UserAvatar user={user} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-[268px]">
        <DropdownMenuItem
          onSelect={() => void navigate(APP_ACCOUNT)}
          className="h-auto gap-3 py-2.5"
        >
          <UserAvatar user={user} className="size-10" fallbackClassName="text-[13px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-silver-900">{nameOf(user)}</p>
            <p className="truncate text-xs text-silver-500">{user.email}</p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void navigate(APP_BILLING)}>
          {isLow ? <AlertTriangleIcon className="text-orange-400" /> : <ZapIcon />}
          Credits
          <DropdownMenuShortcut className="text-orange-400">
            {balanceLoading ? (
              <DataSpinner label="Loading credits" />
            ) : available !== undefined ? (
              available % 1 === 0 ? available.toFixed(0) : available.toFixed(1)
            ) : (
              <span aria-label="Credits unavailable">-</span>
            )}
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        {/* Admins only. Just a link: the ops console lives on its own origin
            and signs in with Google itself. The role check that matters is
            the API's, on every /admin request. */}
        {user.role === "ADMIN" && (
          <DropdownMenuItem asChild>
            <a href={env.ADMIN_URL} target="_blank" rel="noopener noreferrer">
              <ShieldCheckIcon />
              Ops console
              <Badge tone="mono" className="ml-auto">
                Admin
              </Badge>
            </a>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Tours point at the project workspace, so they're only offered there. */}
        {inProject && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <CompassIcon />
              Take a tour
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={6} alignOffset={-6} className="w-60">
              {TOUR_IDS.map((id) => (
                <DropdownMenuItem
                  key={id}
                  onSelect={() => requestTour(id)}
                  className="h-auto flex-col items-start gap-0.5 py-2"
                >
                  <span>{TOUR_INFO[id].label}</span>
                  <span className="text-xs text-silver-500">{TOUR_INFO[id].summary}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuItem
          onSelect={() =>
            openFeedback(
              "account",
              inProject ? (useProjectStore.getState().projectId ?? undefined) : undefined,
            )
          }
        >
          <MessageSquareIcon />
          Feedback &amp; suggestions
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={openSupport}>
          <CoffeeIcon />
          Support tau
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void navigate(APP_ACCOUNT)}>
          <UserIcon />
          Account
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => openSettings()}>
          <SettingsIcon />
          Settings
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => logout.mutate()}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
