import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";

// Served at `/` for visitors without a session (the proxy rewrites the URL).
export const metadata: Metadata = {
  title: "ArrumaBolso — Cada centavo no seu lugar",
  description:
    "Troque a planilha por um painel que se organiza sozinho: importe a fatura do Nubank em CSV sem duplicidade, acompanhe entradas e saídas e saiba quanto vai sobrar no mês.",
};

export default function Page() {
  return <LandingPage />;
}
