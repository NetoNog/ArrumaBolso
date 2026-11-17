import type { Metadata } from "next";

import { TransactionsView } from "@/components/views/transactions-view";

// Renders from browser-held data (localStorage / Supabase client session), so
// navigations into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Lançamentos • ArrumaBolso" };

export default function Page() {
  return <TransactionsView />;
}
