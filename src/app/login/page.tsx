import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

import { LoginForm } from "@/components/app/login-form";
import { BrandLogo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Entrar • ArrumaBolso" };

const HIGHLIGHTS = [
  "Importe as faturas do Nubank em CSV sem duplicar lançamentos",
  "Acompanhe parcelas, assinaturas e orçamento por categoria",
  "Projete seus gastos dos próximos 12 meses",
] as const;

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="hidden flex-col justify-between bg-[#0B1022] p-12 text-white lg:flex">
        <BrandLogo height={28} monochrome className="text-white" />

        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">Suas finanças pessoais, organizadas em um só lugar.</h2>
          <ul className="mt-8 grid gap-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed text-zinc-300">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#60A5FA]" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-zinc-500">Dados isolados por usuário com Row Level Security.</p>
      </section>

      <section className="flex flex-col items-center justify-center px-6 py-12">
        <LoginForm />
      </section>
    </main>
  );
}
