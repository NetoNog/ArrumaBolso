import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Entrar • ArrumaBolso" };

export default function LoginPage() {
  return (
    <AuthShell>
      {/* The form reads `?error=` from the auth callback, which is only known at request time. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
