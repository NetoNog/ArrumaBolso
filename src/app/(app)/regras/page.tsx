import type { Metadata } from "next";

import { RulesView } from "@/components/views/rules-view";

// Renders from browser-held data (localStorage / Supabase client session), so
// navigations into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Regras de Limpeza • ArrumaBolso" };

export default function Page() {
  return <RulesView />;
}
