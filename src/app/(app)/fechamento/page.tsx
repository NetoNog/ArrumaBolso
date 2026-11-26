import type { Metadata } from "next";

import { MonthlyCloseView } from "@/components/views/monthly-close-view";

// Renders from browser-held data (Supabase client session), so navigations
// into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Fechamento do Mês • ArrumaBolso" };

export default function Page() {
  return <MonthlyCloseView />;
}

