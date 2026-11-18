import type { Metadata } from "next";

import { IncomeView } from "@/components/views/income-view";

// Renders from browser-held data (Supabase client session), so navigations
// into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Salário & Renda • ArrumaBolso" };

export default function Page() {
  return <IncomeView />;
}
