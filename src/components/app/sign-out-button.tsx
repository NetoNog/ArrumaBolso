"use client";

import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Ends the Supabase session and returns to the login screen. */
export function SignOutButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [pending, setPending] = useState(false);

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setPending(true);
    const { error } = await client.auth.signOut();
    if (error) {
      setPending(false);
      toast.error("Falha ao sair", { description: error.message });
      return;
    }
    // Full navigation: drops every in-memory copy of the user's data.
    window.location.assign(new URL("/login", window.location.origin));
  }

  return (
    <Button
      variant="outline"
      onClick={signOut}
      disabled={pending}
      aria-label="Sair da conta"
      className={cn(
        "h-9 border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/40 dark:text-rose-400 dark:hover:bg-rose-500/10",
        compact && "w-9 px-0",
        className,
      )}
    >
      {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
      {compact ? null : <span>Sair</span>}
    </Button>
  );
}
