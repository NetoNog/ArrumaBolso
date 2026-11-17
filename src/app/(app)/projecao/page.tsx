import type { Metadata } from "next";

import { ProjectionView } from "@/components/views/projection-view";

// Renders from browser-held data (localStorage / Supabase client session), so
// navigations into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Projeção 12 Meses • ArrumaBolso" };

export default function Page() {
  return <ProjectionView />;
}
