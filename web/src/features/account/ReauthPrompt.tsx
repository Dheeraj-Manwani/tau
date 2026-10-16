import { useEffect, useRef, useState } from "react";
import { ShieldCheckIcon } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { DataSpinner } from "@/src/components/ui/data-spinner";
import { ApiError } from "@/src/lib/api-client";
import { useReauth, useReauthChallenge, useReauthMethod } from "./api";

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * "Confirm it's you" before an API key is revealed or rotated.
 *
 * Password accounts re-enter their password. Google-only accounts have no
 * password to re-enter, so they get a code by email: which proves control of
 * the address the account is bound to, without a full OAuth redirect round trip.
 */
export function ReauthPrompt({
  action,
  onConfirmed,
  onCancel,
}: {
  /** What the token will be spent on. Shown so the prompt isn't context-free. */
  action: string;
  onConfirmed: (token: string) => void;
  onCancel: () => void;
}) {
  const { data: method, isLoading } = useReauthMethod(true);
  const challenge = useReauthChallenge();
  const reauth = useReauth();

  const [value, setValue] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guarded: React 18 StrictMode mounts effects twice in dev, and sending two
  // confirmation emails for one click looks broken to the person receiving them.
  const requested = useRef(false);
  useEffect(() => {
    if (method !== "email_code" || requested.current) return;
    requested.current = true;
    challenge.mutate(undefined, {
      onSuccess: (r) => setSentTo(r.sentTo),
      onError: (e) => setError(errMessage(e, "Could not send a code")),
    });
  }, [method, challenge]);

  if (isLoading) {
    return (
      <div className="flex min-h-12 items-center justify-center rounded-lg border border-line bg-space-void p-3">
        <DataSpinner label="Loading verification method" />
      </div>
    );
  }

  const isCode = method === "email_code";

  const submit = () => {
    setError(null);
    reauth.mutate(isCode ? { code: value } : { password: value }, {
      onSuccess: (r) => {
        setValue("");
        onConfirmed(r.token);
      },
      onError: (e) => setError(errMessage(e, "That didn't work. Try again.")),
    });
  };

  return (
    <div className="space-y-2.5 rounded-lg border border-line bg-space-void p-3.5">
      <div className="flex items-center gap-1.5">
        <ShieldCheckIcon className="size-4 text-silver-600" />
        <span className="text-[13px] font-medium">Confirm it's you to {action}</span>
      </div>

      <p className="text-xs leading-normal text-silver-500">
        {isCode
          ? sentTo
            ? `We emailed a 6-digit code to ${sentTo}. It expires in 10 minutes.`
            : "Sending a code to your email…"
          : "Enter your password. This is a live spend credential, so a signed-in session alone isn't enough."}
      </p>

      <div className="flex gap-2">
        <Input
          autoFocus
          type={isCode ? "text" : "password"}
          inputMode={isCode ? "numeric" : undefined}
          autoComplete={isCode ? "one-time-code" : "current-password"}
          placeholder={isCode ? "123456" : "Your password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim() !== "") submit();
          }}
          className={isCode ? "font-mono tracking-widest" : undefined}
        />
        <Button
          disabled={value.trim() === ""}
          loading={reauth.isPending}
          onClick={submit}
        >
          {reauth.isPending ? "Checking…" : "Confirm"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
