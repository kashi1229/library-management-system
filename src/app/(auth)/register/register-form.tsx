"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/features/auth/auth-layout";
import { TextField, AUTH_ICONS } from "@/components/features/auth/text-field";
import { PasswordInput } from "@/components/features/auth/password-input";
import { PasswordStrength } from "@/components/features/auth/password-strength";
import { AuthSubmitButton } from "@/components/features/auth/auth-submit-button";
import { AuthPendingOverlay } from "@/components/features/auth/auth-pending-overlay";
import { FormAlert } from "@/components/common/form-alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMotionVariants } from "@/hooks/use-motion-variants";
import { useSubmitPending } from "@/hooks/use-submit-pending";
import { registerSchema, PASSWORD_RULE_HINTS, type RegisterInput } from "@/lib/validators/auth";
import { authApi, toErrorMessage, ApiRequestError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import { DEPARTMENTS } from "@/lib/constants";

const OTHER = "__other__";

export function RegisterForm() {
  const router = useRouter();
  const { fadeUp, stagger } = useMotionVariants();

  const [serverError, setServerError] = React.useState<string | null>(null);
  const [department, setDepartment] = React.useState<string>(DEPARTMENTS[0].value);
  const [customDepartment, setCustomDepartment] = React.useState("");

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: undefined,
      department: undefined,
    },
  });

  // `useWatch` is the memo-safe way to read one field (plain `form.watch`
  // opts the whole component out of React Compiler memoisation).
  const password = useWatch({ control: form.control, name: "password" });

  /**
   * As on the sign-in form: the account exists as soon as the promise resolves, but the
   * destination has not rendered yet. The transition keeps the pending state honest across
   * that window.
   */
  const [isNavigating, startNavigation] = React.useTransition();

  /** Push a server-side field error onto the matching react-hook-form field. */
  const applyServerFieldErrors = (fields: Record<string, string> | undefined) => {
    if (!fields) return;
    for (const [name, message] of Object.entries(fields)) {
      form.setError(name as FieldPath<RegisterInput>, { type: "server", message });
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);

    try {
      const resolvedDepartment =
        department === OTHER ? customDepartment.trim() || undefined : department;

      await authApi.register({
        name: values.name,
        email: values.email,
        password: values.password,
        confirmPassword: values.confirmPassword,
        phone: values.phone,
        department: resolvedDepartment,
      });

      toast.success("Account created", {
        description: "Your membership ID is ready on your profile.",
      });

      // Unit 05 replaces this with the real member app shell.
      startNavigation(() => {
        router.replace(ROUTES.member.dashboard);
        router.refresh();
      });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        applyServerFieldErrors(error.fields);
        if (!error.fields) setServerError(error.message);
      } else {
        setServerError(toErrorMessage(error, "We could not create your account."));
      }
    }
  });

  const { isPending, onSubmit: handleFormSubmit } = useSubmitPending({
    handleSubmit: onSubmit,
    isSettling: isNavigating,
  });

  return (
    <>
      <AuthLayout
        title="Join the library"
        subtitle="Create a free account to borrow, reserve and review books."
        footer={
          <p>
            Already have an account?{" "}
            <Link
              href={ROUTES.login}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        }
      >
        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
          <FormAlert message={serverError} />

          <form onSubmit={handleFormSubmit} noValidate aria-busy={isPending} className="space-y-5">
            {/* Everything the member could change once their answer has been sent, in one
              `disabled` — the department select and the password reveal included. */}
            <fieldset disabled={isPending} className="min-w-0 space-y-5">
              <motion.div variants={fadeUp} className="space-y-5">
                <TextField
                  name="name"
                  label="Full name"
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  icon={AUTH_ICONS.name}
                  error={form.formState.errors.name}
                  register={form.register}
                  required
                  autoFocus
                />

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
                />

                <TextField
                  name="phone"
                  label="Phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+92 32765 43210"
                  icon={AUTH_ICONS.phone}
                  hint="Optional — used only for overdue reminders."
                  error={form.formState.errors.phone}
                  register={form.register}
                />

                <Field label="Department" helper="Optional — helps us tailor recommendations.">
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger aria-label="Department">
                      <SelectValue placeholder="Select your department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER}>Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {department === OTHER ? (
                  <Field label="Your department" required>
                    <Input
                      autoComplete="organization"
                      placeholder="e.g. Marine Biology"
                      value={customDepartment}
                      onChange={(event) => setCustomDepartment(event.target.value)}
                    />
                  </Field>
                ) : null}
              </motion.div>

              <motion.div variants={fadeUp} className="space-y-5">
                <div className="space-y-2">
                  <TextField
                    name="password"
                    label="Password"
                    autoComplete="new-password"
                    placeholder="Create a password"
                    icon={AUTH_ICONS.password}
                    error={form.formState.errors.password}
                    register={form.register}
                    required
                    control={PasswordInput}
                  />
                  <PasswordStrength password={password ?? ""} />
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
                    {PASSWORD_RULE_HINTS.map((hint) => (
                      <li key={hint} className="flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="size-1 rounded-full bg-muted-foreground/50"
                        />
                        {hint}
                      </li>
                    ))}
                  </ul>
                </div>

                <TextField
                  name="confirmPassword"
                  label="Confirm password"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  icon={AUTH_ICONS.confirmPassword}
                  error={form.formState.errors.confirmPassword}
                  register={form.register}
                  required
                  control={PasswordInput}
                />
              </motion.div>
            </fieldset>

            {/* Always mounted, empty at rest: a live region created at the same moment it
              gains text is not reliably announced, so the region has to come first. */}
            <p role="status" aria-live="polite" className="sr-only">
              {isNavigating
                ? "Account created. Opening your library."
                : isPending
                  ? "Creating your account."
                  : ""}
            </p>

            <motion.div variants={fadeUp}>
              <AuthSubmitButton
                pending={isPending}
                idleLabel="Create account"
                pendingLabel="Creating account…"
              />
            </motion.div>
          </form>
        </motion.div>
      </AuthLayout>

      {isNavigating ? (
        <AuthPendingOverlay title="Account created" description="Opening your library…" />
      ) : null}
    </>
  );
}
