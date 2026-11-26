"use client";

import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AuthField } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "sign_up" | "forgot";
type Message = { tone: "error" | "info"; text: string };

const COPY: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  sign_in: { title: "Entrar", subtitle: "Acesse sua conta ArrumaBolso.", submit: "Entrar" },
  sign_up: {
    title: "Criar conta",
    subtitle: "Sua conta começa vazia: cadastre seus próprios lançamentos e faturas.",
    submit: "Criar conta",
  },
  forgot: {
    title: "Recuperar senha",
    subtitle: "Informe seu e-mail e enviaremos um link para criar uma nova senha.",
    submit: "Enviar link",
  },
};

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

function callbackUrl(next: string): string {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", next);
  return url.toString();
}

export function LoginForm({ initialMode = "sign_in" }: { initialMode?: Exclude<Mode, "forgot"> }) {
  const client = getSupabaseBrowserClient();
  const callbackError = useSearchParams().get("error");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"form" | "google" | null>(null);
  const [message, setMessage] = useState<Message | null>(callbackError ? { tone: "error", text: callbackError } : null);
  const copy = COPY[mode];
  const disabled = !client || loading !== null;

  function changeMode(next: Mode) {
    setMode(next);
    setMessage(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client) return;
    if (!EMAIL_PATTERN.test(email)) return setMessage({ tone: "error", text: "Informe um e-mail válido." });
    if (mode !== "forgot" && password.length < 8) {
      return setMessage({ tone: "error", text: "A senha precisa ter ao menos 8 caracteres." });
    }

    setLoading("form");
    setMessage(null);

    if (mode === "forgot") {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl("/redefinir-senha") });
      setLoading(null);
      return setMessage(
        error
          ? { tone: "error", text: error.message }
          : { tone: "info", text: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." },
      );
    }

    const { data, error } =
      mode === "sign_in"
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl("/") } });
    setLoading(null);

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

  async function signInWithGoogle() {
    if (!client) return;
    setLoading("google");
    setMessage(null);
    const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl("/") } });
    // On success the browser is already navigating to Google.
    if (error) {
      setLoading(null);
      setMessage({ tone: "error", text: `Não foi possível entrar com o Google: ${error.message}` });
    }
  }

  return (
    <div>
      {mode === "forgot" ? (
        <button
          type="button"
          onClick={() => changeMode("sign_in")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar para o login
        </button>
      ) : null}

      <h1 className="text-3xl font-semibold tracking-tight text-foreground">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{copy.subtitle}</p>

      {!client ? (
        <p role="alert" className="mt-6 flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-relaxed text-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>
            Autenticação indisponível: defina <code className="num">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
            <code className="num">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> no ambiente.
          </span>
        </p>
      ) : null}

      <form onSubmit={submit} className="mt-8 grid gap-6" noValidate>
        <AuthField
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          disabled={!client}
          value={email}
          onChange={setEmail}
        />

        {mode !== "forgot" ? (
          <div className="grid gap-3">
            <AuthField
              id="password"
              label="Senha"
              type="password"
              autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              placeholder={mode === "sign_up" ? "Mínimo de 8 caracteres" : undefined}
              disabled={!client}
              value={password}
              onChange={setPassword}
            />
            {mode === "sign_in" ? (
              <button
                type="button"
                onClick={() => changeMode("forgot")}
                className="justify-self-end text-sm font-medium text-brand transition-colors hover:text-brand/80"
              >
                Esqueci minha senha
              </button>
            ) : null}
          </div>
        ) : null}

        {message ? (
          <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {message.text}
          </p>
        ) : null}

        <Button type="submit" className="h-11 bg-brand text-white hover:bg-brand/90" disabled={disabled}>
          {loading === "form" ? <Loader2 className="animate-spin" /> : null}
          {loading === "form" ? "Aguarde..." : copy.submit}
        </Button>
      </form>

      {client && mode !== "forgot" ? (
        <>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "sign_in" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
            <button
              type="button"
              onClick={() => changeMode(mode === "sign_in" ? "sign_up" : "sign_in")}
              className="font-medium text-brand transition-colors hover:text-brand/80"
            >
              {mode === "sign_in" ? "Criar conta" : "Entrar"}
            </button>
          </p>

          <div className="my-7 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou entre com
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full border-brand/40 text-foreground hover:border-brand"
            disabled={disabled}
            onClick={signInWithGoogle}
          >
            {loading === "google" ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
            Continuar com Google
          </Button>
        </>
      ) : null}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}
