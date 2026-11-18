import type { Metadata } from "next";

import { CashFlowView } from "@/components/views/cash-flow-view";

// Renders from browser-held data (Supabase client session), so navigations
// into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Entradas & Saídas • ArrumaBolso" };

export default function Page() {
  return <CashFlowView />;
}
