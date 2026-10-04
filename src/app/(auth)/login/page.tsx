import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthLayout } from "@/components/features/auth/auth-layout";
import { Spinner } from "@/components/common/spinner";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Athenaeum library account.",
  robots: { index: false, follow: false },
};

/** Form shell shown while `useSearchParams` resolves — mirrors the real layout. */
function LoginFallback() {
  return (
    <AuthLayout title="Welcome back" subtitle="Checking your session…">
      <div className="flex justify-center py-10">
        <Spinner size="lg" label="Loading sign in" />
      </div>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    // `useSearchParams` needs a Suspense boundary for static rendering.
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
