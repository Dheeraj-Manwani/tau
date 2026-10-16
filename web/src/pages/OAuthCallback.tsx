import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { TriangleAlertIcon } from "lucide-react";

import { TauMark } from "@/src/components/motion/TauMark";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { useDocumentMeta } from "@/src/components/useDocumentMeta";
import { setAccessToken } from "@/src/lib/api-client";
import { APP_HOME } from "@/src/lib/routes";
import { AuthLayout, AuthTile } from "@/src/features/auth/AuthLayout";
import { authKeys } from "@/src/features/auth/queries";

/**
 * Landing route for Google OAuth. The API redirects here with the access token
 * in the URL *fragment* (`#access_token=…`): which never reaches a server. We
 * read it, store it in memory, scrub it from history, then resolve `me`.
 */
function OAuthCallback() {
  useDocumentMeta({ title: "Signing you in…", exactTitle: true, noIndex: true });

  const navigate = useNavigate();
  const qc = useQueryClient();
  // Read once, before the effect scrubs it from the address bar.
  const [token] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get("access_token"),
  );

  useEffect(() => {
    if (!token) return;
    setAccessToken(token);
    window.history.replaceState(null, "", "/auth/callback"); // drop token from URL
    qc.invalidateQueries({ queryKey: authKeys.me }).finally(() =>
      navigate(APP_HOME, { replace: true }),
    );
  }, [token, navigate, qc]);

  if (!token) {
    return (
      <AuthLayout
        icon={
          <AuthTile>
            <TriangleAlertIcon className="text-red-400" />
          </AuthTile>
        }
        title="Sign-in didn't finish"
      >
        <Alert tone="danger" className="mb-5">
          Google didn't hand back a session. Nothing was changed; try again.
        </Alert>
        <Button asChild size="lg" className="w-full">
          <Link to="/login" replace>
            Back to login
          </Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={<TauMark size={40} label="Signing in" />}
      title="Signing you in"
      subtitle="One moment while tau opens your projects."
    />
  );
}

export default OAuthCallback;
