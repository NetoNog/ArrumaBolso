import type { Metadata } from "next";

import { BudgetView } from "@/components/views/budget-view";

// Renders from browser-held data (localStorage / Supabase client session), so
// navigations into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Orçamento & Metas • ArrumaBolso" };

export default function Page() {
  return <BudgetView />;
}
