"use client";

import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "sign_up";

const COPY: Record<Mode, { title: string; subtitle: string; submit: string; switchPrompt: string; switchAction: string }> = {
  sign_in: {
    title: "Entrar na sua conta",
    subtitle: "Informe seu e-mail e senha para continuar.",
    submit: "Entrar",
    switchPrompt: "Ainda não tem conta?",
    switchAction: "Criar conta",
  },
  sign_up: {
    title: "Criar conta",
    subtitle: "Sua conta começa vazia: cadastre seus próprios lançamentos e faturas.",
    submit: "Criar conta",
    switchPrompt: "Já tem conta?",
    switchAction: "Entrar",
  },
};

export function LoginForm() {
  const client = getSupabaseBrowserClient();
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const copy = COPY[mode];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMessage({ tone: "error", text: "Informe um e-mail válido." });
    if (password.length < 8) return setMessage({ tone: "error", text: "A senha precisa ter ao menos 8 caracteres." });

    setLoading(true);
    setMessage(null);
    const { data, error } =
      mode === "sign_in"
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      const text = error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message;
      return setMessage({ tone: "error", text });
    }
    if (mode === "sign_up" && !data.session) {
      return setMessage({ tone: "info", text: "Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre." });
    }
    // Full reload so the data layer boots against the signed-in session.
    window.location.assign(new URL("/", window.location.origin));
  }

  function switchMode() {
    setMode(mode === "sign_in" ? "sign_up" : "sign_in");
    setMessage(null);
  }

  return (
    <div className="w-full max-w-sm">
      <BrandLogo height={26} className="mb-10 lg:hidden" />

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{copy.title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{copy.subtitle}</p>

      {!client ? (
        <p role="alert" className="mt-6 flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-relaxed text-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>
            Autenticação indisponível: defina <code className="num">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
            <code className="num">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> no ambiente.
          </span>
        </p>
      ) : null}

      <form onSubmit={submit} className="mt-8 grid gap-5" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            className="h-10"
            disabled={!client}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              placeholder={mode === "sign_up" ? "Mínimo de 8 caracteres" : undefined}
              className="h-10 pr-10"
              disabled={!client}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((value) => !value)}
              disabled={!client}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {message ? (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={message.tone === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
          >
            {message.text}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="h-10" disabled={loading || !client}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          {loading ? "Aguarde..." : copy.submit}
        </Button>
      </form>

      {client ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {copy.switchPrompt}{" "}
          <button type="button" onClick={switchMode} className="font-medium text-foreground underline-offset-4 hover:underline">
            {copy.switchAction}
          </button>
        </p>
      ) : null}
    </div>
  );
}
