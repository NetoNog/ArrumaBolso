import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";

// Served at `/` for visitors without a session (the proxy rewrites the URL).
export const metadata: Metadata = {
  title: "ArrumaBolso — Seu dinheiro organizado, sem planilha e sem susto",
  description:
    "Envie a fatura do seu banco sem repetir gastos, descubra quanto ainda pode gastar hoje, veja os próximos 12 meses e use direto no celular ou no computador.",
};

export default function Page() {
  return <LandingPage />;
}
