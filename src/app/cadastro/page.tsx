import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Criar conta • ArrumaBolso" };

export default function SignUpPage() {
  return (
    <AuthShell>
      {/* The form reads `?error=` from the auth callback, which is only known at request time. */}
      <Suspense>
        <LoginForm initialMode="sign_up" />
      </Suspense>
    </AuthShell>
  );
}
