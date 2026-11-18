"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { AuthField } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Sets a new password for the session opened by the recovery link. */
export function ResetPasswordForm() {
  const client = getSupabaseBrowserClient();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client) return;
    if (password.length < 8) return setError("A senha precisa ter ao menos 8 caracteres.");
    if (password !== confirmation) return setError("As senhas não conferem.");

    setLoading(true);
    setError(null);
    const { error: updateError } = await client.auth.updateUser({ password });
    setLoading(false);
    if (updateError) return setError(updateError.message);
    window.location.assign(new URL("/", window.location.origin));
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Nova senha</h1>
      <p className="mt-2 text-sm text-muted-foreground">Escolha uma nova senha para acessar sua conta.</p>

      <form onSubmit={submit} className="mt-8 grid gap-6" noValidate>
        <AuthField
          id="new-password"
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          disabled={!client}
          value={password}
          onChange={setPassword}
        />
        <AuthField
          id="confirm-password"
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          disabled={!client}
          value={confirmation}
          onChange={setConfirmation}
        />

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="h-11 bg-brand text-white hover:bg-brand/90" disabled={!client || loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          {loading ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}
