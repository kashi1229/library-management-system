"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/features/auth/auth-layout";
import { TextField, AUTH_ICONS } from "@/components/features/auth/text-field";
import { PasswordInput } from "@/components/features/auth/password-input";
import { FormAlert } from "@/components/common/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMotionVariants } from "@/hooks/use-motion-variants";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { authApi, toErrorMessage, ApiRequestError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fadeUp, stagger } = useMotionVariants();

  const [serverError, setServerError] = React.useState<string | null>(null);
  const [alertTone, setAlertTone] = React.useState<"danger" | "warning">("danger");

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);

    try {
      const { user, redirectTo } = await authApi.login(values);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);

      // Only same-origin paths are honoured, so `?next=` cannot be used to
      // bounce a signed-in user to an attacker's site.
      router.replace(safeInternalPath(searchParams.get("next")) ?? redirectTo);
      router.refresh();
    } catch (error) {
      // Rate limiting is expected and actionable, so it gets its own tone.
      if (error instanceof ApiRequestError && error.code === "RATE_LIMITED") {
        setAlertTone("warning");
      }
      setServerError(toErrorMessage(error, "We could not sign you in. Please try again."));
    }
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to borrow books, track reservations and manage your account."
      footer={
        <p>
          By signing in you agree to the library&rsquo;s borrowing policy.{" "}
          <Link href={ROUTES.landing} className="text-primary underline-offset-4 hover:underline">
            Back to the catalog
          </Link>
        </p>
      }
    >
      <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
        <FormAlert message={serverError} tone={alertTone} />

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <motion.div variants={fadeUp} className="space-y-5">
            <TextField
              name="email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@university.edu"
              icon={AUTH_ICONS.email}
              error={form.formState.errors.email}
              register={form.register}
              required
              autoFocus
            />

            <TextField
              name="password"
              label="Password"
              autoComplete="current-password"
              placeholder="••••••••"
              icon={AUTH_ICONS.password}
              error={form.formState.errors.password}
              register={form.register}
              required
              control={PasswordInput}
            />
          </motion.div>

          {/* The session cookie already lasts 7 days, so this is informational. */}
          <motion.div variants={fadeUp} className="flex items-center gap-2.5">
            <Checkbox id="remember" defaultChecked aria-describedby="remember-hint" />
            <div className="space-y-0.5">
              <Label htmlFor="remember">Keep me signed in</Label>
              <p id="remember-hint" className="text-caption text-muted-foreground">
                Sessions last 7 days.
              </p>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </motion.div>
        </form>

        <motion.p variants={fadeUp} className="text-center text-small text-muted-foreground">
          New to the library?{" "}
          <Link
            href={ROUTES.register}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </motion.p>
      </motion.div>
    </AuthLayout>
  );
}

/**
 * Accept only same-origin absolute paths. Rejects protocol-relative URLs
 * (`//evil.com`), absolute URLs, backslashes, and anything without a leading
 * slash — so `?next=` can never bounce a user off-site.
 */
export function safeInternalPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  return value;
}
