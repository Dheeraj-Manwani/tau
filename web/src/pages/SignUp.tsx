import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
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
import { useRegister } from "@/src/features/auth/mutations";
import { signUpSchema, type SignUpValues } from "@/src/features/auth/schemas";

function SignUp() {
  useDocumentMeta({ title: "Sign up", noIndex: true });

  const navigate = useNavigate();
  const registerMutation = useRegister();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: SignUpValues) => {
    setServerError(null);
    try {
      const { user } = await registerMutation.mutateAsync({
        email: values.email,
        password: values.password,
      });
      toast.success(`Welcome to tau, ${user.email}`);
      navigate(APP_HOME, { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Describe an app, and tau builds it."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-blue-500 hover:text-blue-hi hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {serverError && (
        <Alert tone="danger" className="mb-5">
          {serverError}
        </Alert>
      )}

      <GoogleButton label="Sign up with Google" />
      <AuthDivider />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            {...field("email")}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          help="At least 8 characters."
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="Choose a password"
            aria-invalid={!!errors.password}
            {...field("password")}
          />
        </Field>

        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="Type it again"
            aria-invalid={!!errors.confirmPassword}
            {...field("confirmPassword")}
          />
        </Field>

        <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <AuthTerms terms={LANDING_TERMS} privacy={LANDING_PRIVACY} />
    </AuthLayout>
  );
}

export default SignUp;
