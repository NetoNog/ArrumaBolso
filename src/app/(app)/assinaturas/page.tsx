import type { Metadata } from "next";

import { SubscriptionsView } from "@/components/views/subscriptions-view";

// Renders from browser-held data (localStorage / Supabase client session), so
// navigations into this page intentionally wait for that data to load.
export const instant = false;

export const metadata: Metadata = { title: "Assinaturas Fixas • ArrumaBolso" };

export default function Page() {
  return <SubscriptionsView />;
}
