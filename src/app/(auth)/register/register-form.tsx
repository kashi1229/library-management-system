"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/features/auth/auth-layout";
import { TextField, AUTH_ICONS } from "@/components/features/auth/text-field";
import { PasswordInput } from "@/components/features/auth/password-input";
import { PasswordStrength } from "@/components/features/auth/password-strength";
import { FormAlert } from "@/components/common/form-alert";
import { Button } from "@/components/ui/button";
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
      router.replace(ROUTES.member.dashboard);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        applyServerFieldErrors(error.fields);
        if (!error.fields) setServerError(error.message);
      } else {
        setServerError(toErrorMessage(error, "We could not create your account."));
      }
    }
  });

  return (
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

        <form onSubmit={onSubmit} noValidate className="space-y-5">
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
              placeholder="+91 98765 43210"
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

          <motion.div variants={fadeUp}>
            <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </AuthLayout>
  );
}
