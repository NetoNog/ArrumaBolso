import type { Metadata } from "next";

import { SettingsView } from "@/components/views/settings-view";

// Renders from browser-held data (localStorage / Supabase client session), so
// navigations into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Configurações • ArrumaBolso" };

export default function Page() {
  return <SettingsView />;
}
