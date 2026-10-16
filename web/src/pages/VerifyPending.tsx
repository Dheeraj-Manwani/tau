import { useEffect, useState } from "react";
import { MailIcon, RotateCwIcon } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/src/components/ui/button";
import { useDocumentMeta } from "@/src/components/useDocumentMeta";
import { ApiError } from "@/src/lib/api-client";
import { AuthLayout, AuthTile } from "@/src/features/auth/AuthLayout";
import { useMe } from "@/src/features/auth/queries";
import {
  useLogout,
  useResendVerification,
} from "@/src/features/auth/mutations";
import { formatElapsed } from "@/src/features/project/chatLoaderState";

/** How long Resend waits after a send, so one click is one email. */
const RESEND_COOLDOWN_S = 60;

/**
 * Holding screen for authenticated users who haven't verified their email. They
 * can't reach the platform until they confirm via the email link (which lands on
 * /verify-email and redirects home). From here they can resend, or log out to
 * use a different address.
 */
function VerifyPending() {
  useDocumentMeta({ title: "Verify email", noIndex: true });

  const { data: user } = useMe();
  const resend = useResendVerification();
  const logout = useLogout();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const onResend = async () => {
    try {
      await resend.mutateAsync();
      toast.success("Verification email sent");
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Couldn't send the email",
      );
    }
  };

  return (
    <AuthLayout
      icon={
        <AuthTile>
          <MailIcon />
        </AuthTile>
      }
      title="Check your email"
      subtitle={
        <>
          We sent a verification link to{" "}
          {user ? (
            <span className="font-medium text-silver-900">{user.email}</span>
          ) : (
            "your email"
          )}
          . Open it to start building.
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={onResend}
          loading={resend.isPending}
          disabled={cooldown > 0}
        >
          {!resend.isPending && <RotateCwIcon />}
          {cooldown > 0 ? (
            <>
              Resend in <span className="font-mono tabular-nums">{formatElapsed(cooldown)}</span>
            </>
          ) : (
            "Resend email"
          )}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          Use a different email
        </Button>
      </div>
      <p className="mt-5 text-center text-xs leading-relaxed text-silver-500">
        Nothing yet? Check your spam folder, or resend in a minute.
      </p>
    </AuthLayout>
  );
}

export default VerifyPending;
