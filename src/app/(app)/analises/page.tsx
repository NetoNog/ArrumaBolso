import type { Metadata } from "next";

import { AnalyticsView } from "@/components/views/analytics-view";

// Renders from browser-held data (Supabase client session), so navigations
// into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Análises & Ranking • ArrumaBolso" };

export default function Page() {
  return <AnalyticsView />;
}

