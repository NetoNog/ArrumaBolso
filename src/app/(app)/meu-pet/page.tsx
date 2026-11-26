import type { Metadata } from "next";

import { MeuPetView } from "@/components/views/meu-pet-view";

// Renders from browser-held data (Supabase client session), so navigations
// into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Meu Pet • ArrumaBolso" };

export default function Page() {
  return <MeuPetView />;
}

