import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useDocumentMeta } from "@/src/components/useDocumentMeta";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Field } from "@/src/components/ui/field";
import { Input } from "@/src/components/ui/input";
import { PasswordInput } from "@/src/components/ui/password-input";
import { ApiError } from "@/src/lib/api-client";
import { APP_HOME, LANDING_PRIVACY, LANDING_TERMS } from "@/src/lib/routes";
import { AuthDivider, AuthLayout, AuthTerms } from "@/src/features/auth/AuthLayout";
import { GoogleButton } from "@/src/features/auth/GoogleButton";
import { useLogin } from "@/src/features/auth/mutations";
import { loginSchema, type LoginValues } from "@/src/features/auth/schemas";

function Login() {
  useDocumentMeta({ title: "Log in", noIndex: true });

  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  // A refused login is said once, at the top of the card, not in a toast that
  // disappears before it is read.
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    try {
      const { user } = await login.mutateAsync(values);
      toast.success(`Welcome back, ${user.email}`);
      const from = (location.state as { from?: Location } | null)?.from;
      navigate(from?.pathname ?? APP_HOME, { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  };

  return (
    <AuthLayout
      title="Log in"
      subtitle="Welcome back. Pick up where you left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-medium text-blue-500 hover:text-blue-hi hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      {serverError && (
        <Alert tone="danger" className="mb-5">
          {serverError}
        </Alert>
      )}

      <GoogleButton label="Continue with Google" />
      <AuthDivider />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Your password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
        </Field>

        <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
          Log in
        </Button>
      </form>

      <AuthTerms terms={LANDING_TERMS} privacy={LANDING_PRIVACY} />
    </AuthLayout>
  );
}

export default Login;
