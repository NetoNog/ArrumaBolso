import type { Metadata } from "next";

import { InvoicesView } from "@/components/views/invoices-view";

// Renders from browser-held data (localStorage / Supabase client session), so
// navigations into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Faturas & Parcelas • ArrumaBolso" };

export default function Page() {
  return <InvoicesView />;
}
