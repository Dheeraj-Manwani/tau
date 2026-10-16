import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { MailCheckIcon, MailXIcon, RotateCwIcon } from "lucide-react";
import toast from "react-hot-toast";

import { TauMark } from "@/src/components/motion/TauMark";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { SplashScreen } from "@/src/components/SplashScreen";
import { useDocumentMeta } from "@/src/components/useDocumentMeta";
import { ApiError } from "@/src/lib/api-client";
import { APP_HOME } from "@/src/lib/routes";
import { AuthLayout, AuthTile } from "@/src/features/auth/AuthLayout";
import { useMe } from "@/src/features/auth/queries";
import {
  useResendVerification,
  useVerifyEmail,
} from "@/src/features/auth/mutations";

/**
 * Landing page for the link in the verification email
 * (`/verify-email?token=…`). Three states: verifying, confirmed (Continue)
 * and failed (resend, or log in to resend). Someone already verified who
 * reopens the link goes straight home.
 */
function VerifyEmail() {
  useDocumentMeta({ title: "Verify email", noIndex: true });

  const [params] = useSearchParams();
  const token = params.get("token");
  const { data: user, isLoading } = useMe();
  const verify = useVerifyEmail();
  const resend = useResendVerification();

  // The outcome comes from the promise, not the mutation's observer: StrictMode
  // remounts the effect in dev, which detaches the observer from a mutation
  // already in flight, and the page would wait on "Verifying" forever.
  const [outcome, setOutcome] = useState<{ ok: true } | { ok: false; error: unknown } | null>(null);

  // StrictMode mounts effects twice in dev; guard so we POST only once.
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current || !token || user?.emailVerifiedAt) return;
    firedRef.current = true;
    verify.mutateAsync(token).then(
      () => setOutcome({ ok: true }),
      (error: unknown) => setOutcome({ ok: false, error }),
    );
  }, [token, user, verify]);

  if (outcome?.ok) {
    return (
      <AuthLayout
        icon={
          <AuthTile>
            <MailCheckIcon className="text-green-400" />
          </AuthTile>
        }
        title="Email confirmed"
      >
        <Alert tone="success" className="mb-5">
          Your email is verified. You can start building.
        </Alert>
        <Button asChild size="lg" className="w-full">
          <Link to={APP_HOME} replace>
            Continue
          </Link>
        </Button>
      </AuthLayout>
    );
  }

  // Already verified before this visit (a reload, an old link): go home.
  if (user?.emailVerifiedAt) return <Navigate to={APP_HOME} replace />;

  // Don't flash an error while we're still resolving auth state.
  if (!token && isLoading) return <SplashScreen />;

  if (!token || outcome?.ok === false) {
    const failure = outcome && !outcome.ok ? outcome.error : null;
    const message = !token
      ? "This verification link is missing its token."
      : failure instanceof ApiError
        ? failure.message
        : "We couldn't verify your email. The link may have expired.";
    const onResend = () =>
      resend.mutate(undefined, {
        onSuccess: () => toast.success("A new link is on its way"),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Couldn't send the email"),
      });
    return (
      <AuthLayout
        icon={
          <AuthTile>
            <MailXIcon className="text-red-400" />
          </AuthTile>
        }
        title="Link didn't work"
      >
        <Alert tone="danger" className="mb-5">
          {message}
        </Alert>
        {user ? (
          // Signed in on this device: a fresh link is one click away.
          <Button size="lg" className="w-full" onClick={onResend} loading={resend.isPending} disabled={resend.isSuccess}>
            {!resend.isPending && <RotateCwIcon />}
            {resend.isSuccess ? "Sent: check your email" : "Send a new link"}
          </Button>
        ) : (
          <Button asChild size="lg" className="w-full">
            <Link to="/login">Log in to get a new link</Link>
          </Button>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={<TauMark size={40} label="Verifying" />}
      title="Verifying your email"
      subtitle="This takes a moment."
    />
  );
}

export default VerifyEmail;
