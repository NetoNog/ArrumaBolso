import Link from "next/link";
import type { ReactNode } from "react";

import { AuthShowcase } from "@/components/auth/auth-showcase";
import { BrandLogo } from "@/components/brand/logo";

/** Shared frame for the auth screens: form on the left, illustrated carousel on the right. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4 sm:p-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl bg-card shadow-xl shadow-slate-900/5 ring-1 ring-border lg:min-h-[640px] lg:grid-cols-2">
        <div className="flex flex-col px-6 py-8 sm:px-12 sm:py-10">
          <Link href="/login" aria-label="ArrumaBolso" className="self-start rounded-md">
            <BrandLogo height={28} />
          </Link>
          <div className="flex flex-1 items-center py-10">
            <div className="w-full max-w-md">{children}</div>
          </div>
        </div>
        <div className="hidden p-4 lg:block">
          <AuthShowcase />
        </div>
      </div>
    </main>
  );
}
