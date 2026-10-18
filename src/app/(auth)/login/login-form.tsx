"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/features/auth/auth-layout";
import { TextField, AUTH_ICONS } from "@/components/features/auth/text-field";
import { PasswordInput } from "@/components/features/auth/password-input";
import { AuthSubmitButton } from "@/components/features/auth/auth-submit-button";
import { AuthPendingOverlay } from "@/components/features/auth/auth-pending-overlay";
import { FormAlert } from "@/components/common/form-alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMotionVariants } from "@/hooks/use-motion-variants";
import { useSubmitPending } from "@/hooks/use-submit-pending";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { authApi, toErrorMessage, ApiRequestError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const { fadeUp, stagger } = useMotionVariants();

  const [serverError, setServerError] = React.useState<string | null>(null);
  const [alertTone, setAlertTone] = React.useState<"danger" | "warning">("danger");

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  /**
   * The destination is fetched *after* the cookie exists, so the sign-in is not over when
   * the promise resolves. Wrapping both router calls in a transition keeps `isPending` true
   * until that fetch has committed, which is what the overlay covers.
   */
  const [isNavigating, startNavigation] = React.useTransition();

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);

    try {
      const { user, redirectTo } = await authApi.login(values);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);

      // Only same-origin paths are honoured, so `?next=` cannot be used to
      // bounce a signed-in user to an attacker's site. `next` arrives as a prop
      // from the server rather than from `useSearchParams`, which keeps the form
      // out of Next's static-shell bailout — see the note on `LoginPage`.
      startNavigation(() => {
        router.replace(safeInternalPath(next) ?? redirectTo);
        router.refresh();
      });
    } catch (error) {
      // Rate limiting is expected and actionable, so it gets its own tone.
      if (error instanceof ApiRequestError && error.code === "RATE_LIMITED") {
        setAlertTone("warning");
      }
      setServerError(toErrorMessage(error, "We could not sign you in. Please try again."));
    }
  });

  const { isPending, onSubmit: handleFormSubmit } = useSubmitPending({
    handleSubmit: onSubmit,
    isSettling: isNavigating,
  });

  return (
    <>
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

          <form onSubmit={handleFormSubmit} noValidate aria-busy={isPending} className="space-y-5">
            {/* One fieldset, so every control goes inert for the duration. A pending form
              whose fields still accept typing is telling the user it is working while
              letting them change an answer it has already sent. */}
            <fieldset disabled={isPending} className="min-w-0 space-y-5">
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
            </fieldset>

            {/* Always mounted, empty at rest: a live region added to the DOM at the same
              moment it gains text is unreliable, so the region has to exist first. */}
            <p role="status" aria-live="polite" className="sr-only">
              {isNavigating ? "Signed in. Opening your library." : isPending ? "Signing in." : ""}
            </p>

            <motion.div variants={fadeUp}>
              <AuthSubmitButton
                pending={isPending}
                idleLabel="Sign in"
                pendingLabel="Signing in…"
              />
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

      {isNavigating ? (
        <AuthPendingOverlay title="Welcome in" description="Opening your library…" />
      ) : null}
    </>
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
