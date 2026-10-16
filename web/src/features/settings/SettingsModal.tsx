import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Switch } from "@/src/components/ui/switch";
import { SettingsRow } from "@/src/features/settings/SettingsRow";
import { useSettings } from "@/src/hooks/useSettings";
import {
  DefaultLookCard,
  StandingInstructionsCard,
} from "@/src/features/settings/BuildDefaults";
import { TOUR_IDS, TOUR_INFO } from "@/src/features/tour/tours";
import { useSettingsStore } from "@/src/stores/useSettingsStore";
import {
  browserNotificationsSupported,
  requestReadyNotificationPermission,
} from "@/src/features/project/useReadyNotification";
import {
  playNotificationSound,
  primeNotificationSound,
} from "@/src/features/project/notificationSound";

/** Global Settings modal: open it from anywhere via useSettingsStore.openSettings(). */
export function SettingsModal() {
  const open = useSettingsStore((s) => s.settingsOpen);
  const close = useSettingsStore((s) => s.closeSettings);
  const requestTour = useSettingsStore((s) => s.requestTour);
  const {
    reduceMotion,
    setReduceMotion,
    notifyWhenReady,
    setNotifyWhenReady,
    notificationSound,
    setNotificationSound,
  } = useSettings();

  const changeSound = async (enabled: boolean) => {
    setNotificationSound(enabled);
    if (!enabled) return;
    // Let them hear what they just turned on, at the volume they'll hear most.
    await primeNotificationSound();
    playNotificationSound("soft");
  };
  // Tours point at the project workspace, so they can only replay there.
  const inProject = useLocation().pathname.startsWith("/project/");
  const notificationsSupported = browserNotificationsSupported();
  const notificationPermission = notificationsSupported
    ? Notification.permission
    : "denied";

  const changeReadyNotifications = async (enabled: boolean) => {
    if (!enabled) {
      setNotifyWhenReady(false);
      return;
    }

    if (!(await requestReadyNotificationPermission())) {
      toast.error("Allow browser notifications to enable this setting");
      return;
    }

    setNotifyWhenReady(true);
    toast.success("Ready notifications enabled");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="scrollbar-thin sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="max-w-[420px] text-[13px] text-silver-500">
            Saved to your account, except notifications, which are set per
            device.
          </DialogDescription>
        </DialogHeader>

        <div className="-mt-1">
          <StandingInstructionsCard />
          <DefaultLookCard />

          <SettingsRow
            title="Reduce motion"
            htmlFor="reduce-motion"
            help="Turn off animated effects like the lightning border and glitch stars for a calmer interface."
            control={
              <Switch
                id="reduce-motion"
                checked={reduceMotion}
                onCheckedChange={setReduceMotion}
              />
            }
          />

          <SettingsRow
            title="Desktop notifications"
            htmlFor="notify-when-ready"
            help="Get a system notification when a build finishes or needs you while Tau is in the background. Keep Tau open in a tab."
            warning={
              !notificationsSupported
                ? "Browser notifications are not supported here."
                : notificationPermission === "denied"
                  ? "Notifications are blocked in browser settings."
                  : notifyWhenReady && notificationPermission === "default"
                    ? "Browser permission needs to be granted again."
                    : undefined
            }
            control={
              <Switch
                id="notify-when-ready"
                checked={
                  notifyWhenReady &&
                  notificationsSupported &&
                  notificationPermission === "granted"
                }
                disabled={!notificationsSupported}
                onCheckedChange={(enabled) =>
                  void changeReadyNotifications(enabled)
                }
              />
            }
          />

          <SettingsRow
            title="Sound"
            htmlFor="notification-sound"
            help={
              <>
                A soft chime when a build finishes or needs you; louder when
                you&rsquo;re in another tab.
              </>
            }
            control={
              <Switch
                id="notification-sound"
                checked={notificationSound}
                onCheckedChange={(enabled) => void changeSound(enabled)}
              />
            }
          />

          <SettingsRow
            title="Product tours"
            help={
              inProject
                ? "Replay a quick walkthrough of the project workspace."
                : "Open a project to replay its walkthroughs."
            }
            className="pb-0"
            control={TOUR_IDS.map((id) => (
              <Button
                key={id}
                variant="secondary"
                size="sm"
                disabled={!inProject}
                title={TOUR_INFO[id].summary}
                onClick={() => requestTour(id)}
              >
                {TOUR_INFO[id].short}
              </Button>
            ))}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
