import type { Metadata } from "next";

import { ImportView } from "@/components/views/import-view";

// Renders from browser-held data (localStorage / Supabase client session), so
// navigations into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Importar CSV • ArrumaBolso" };

export default function Page() {
  return <ImportView />;
}
