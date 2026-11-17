import type { Metadata } from "next";
import Link from "next/link";

import { LoginBackdrop } from "@/components/app/login-backdrop";
import { LoginForm } from "@/components/app/login-form";

export const metadata: Metadata = { title: "Entrar • ArrumaBolso" };

export default function LoginPage() {
  return (
    // Always dark: the login is the brand's entrance, independent of the app theme.
    <main className="dark relative flex min-h-screen flex-col overflow-hidden bg-[#0B1022] text-white [color-scheme:dark]">
      <LoginBackdrop />
      <div className="relative flex flex-1 items-center justify-center px-6 py-16">
        <LoginForm />
      </div>
      <footer className="relative z-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 px-6 pb-6 text-[11px] text-zinc-500">
        <span>Dados isolados por usuário com Row Level Security</span>
        <Link href="/marca" className="transition-colors hover:text-zinc-300">
          Identidade visual
        </Link>
      </footer>
    </main>
  );
}
