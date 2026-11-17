import type { Metadata } from "next";

import { OverviewView } from "@/components/views/overview-view";

// Renders from browser-held data (localStorage / Supabase client session), so
// navigations into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Visão Geral • ArrumaBolso" };

export default function Page() {
  return <OverviewView />;
}
