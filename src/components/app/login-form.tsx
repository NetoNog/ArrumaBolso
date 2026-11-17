"use client";

import { ArrowRight, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { cn } from "cn";

import { BrandLogo } from "@/components/brand/logo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "sign_up";

const COPY: Record<Mode, { title: string; subtitle: string; submit: string; switchLabel: string }> = {
  sign_in: {
    title: "Entrar",
    subtitle: "Sua fatura, parcelas e projeção dos próximos 12 meses.",
    submit: "Entrar",
    switchLabel: "Ainda não tem conta? Criar conta",
  },
  sign_up: {
    title: "Criar conta",
    subtitle: "Sincronize seus lançamentos na nuvem, isolados por usuário.",
    submit: "Criar conta",
    switchLabel: "Já tem conta? Entrar",
  },
};

const EASE = "cubic-bezier(0.22,1,0.36,1)";

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
    // Full reload so the data layer boots against the Supabase repository.
    window.location.assign(new URL("/", window.location.origin));
  }

  return (
    <div
      className="relative z-10 w-full max-w-90 motion-safe:animate-[ab-fade-up_700ms_150ms_both]"
      style={{ animationTimingFunction: EASE }}
    >
      <Link href="/" aria-label="ArrumaBolso" className="inline-block rounded-md">
        <BrandLogo height={30} />
      </Link>

      <h1 className="mt-10 text-[28px] leading-tight font-semibold tracking-tight text-white">{copy.title}</h1>
      <p className="mt-1.5 text-sm text-zinc-400">{copy.subtitle}</p>

      {!client ? (
        <p className="mt-6 flex gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs leading-relaxed text-zinc-300">
          <Info className="mt-0.5 size-4 shrink-0 text-[#60A5FA]" />
          <span>
            Login em nuvem não configurado (defina as variáveis do Supabase no <code className="num">.env.local</code>). Use o modo local
            abaixo: tudo funciona e fica salvo neste navegador.
          </span>
        </p>
      ) : null}

      <form onSubmit={submit} className="mt-8 grid gap-7" noValidate>
        <UnderlineField
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          disabled={!client}
          value={email}
          onChange={setEmail}
        />
        <UnderlineField
          id="password"
          label="Senha"
          type={showPassword ? "text" : "password"}
          autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
          disabled={!client}
          value={password}
          onChange={setPassword}
          trailing={
            <button
              type="button"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((value) => !value)}
              disabled={!client}
              className="rounded p-1 text-zinc-400 transition-colors hover:text-white disabled:opacity-40"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />

        {message ? (
          <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "-mt-3 text-xs text-rose-400" : "-mt-3 text-xs text-zinc-300"}>
            {message.text}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !client}
          className="group flex h-11 items-center justify-center gap-2 rounded-md bg-[#2563EB] text-sm font-medium text-white transition-[background-color,transform] hover:bg-[#1D4ED8] focus-visible:ring-3 focus-visible:ring-[#60A5FA]/60 focus-visible:outline-none active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {loading ? "Aguarde..." : copy.submit}
          {!loading ? <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /> : null}
        </button>
      </form>

      {client ? (
        <button
          type="button"
          className="mt-4 text-xs text-zinc-400 transition-colors hover:text-white"
          onClick={() => {
            setMode(mode === "sign_in" ? "sign_up" : "sign_in");
            setMessage(null);
          }}
        >
          {copy.switchLabel}
        </button>
      ) : null}

      <div className="my-7 flex items-center gap-3 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
        <span className="h-px flex-1 bg-white/10" />
        ou
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <Link
        href="/"
        className="flex h-11 items-center justify-center rounded-md border border-white/15 text-sm font-medium text-zinc-100 transition-colors hover:border-white/30 hover:bg-white/[0.04] focus-visible:ring-3 focus-visible:ring-[#60A5FA]/60 focus-visible:outline-none"
      >
        Continuar no modo local
      </Link>
      <p className="mt-2 text-center text-[11px] text-zinc-500">Sem conta: os dados ficam apenas neste navegador.</p>
    </div>
  );
}

/** Underlined input with a floating label and a focus line that grows from the centre. */
function UnderlineField({
  id,
  label,
  type,
  autoComplete,
  disabled,
  value,
  onChange,
  trailing,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder=" "
        className={cn(
          "peer block h-12 w-full border-0 border-b border-zinc-600 bg-transparent px-0 pt-4 pb-1.5 text-[15px] text-white outline-none",
          "transition-colors hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50",
          "[&:-webkit-autofill]:[-webkit-text-fill-color:#fff] [&:-webkit-autofill]:[transition:background-color_9999s]",
          trailing && "pr-9",
        )}
      />
      <label
        htmlFor={id}
        className={cn(
          "pointer-events-none absolute top-1/2 left-0 origin-left -translate-y-1/2 text-[15px] text-zinc-400 transition-all duration-200",
          "peer-focus:top-1 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-[#93C5FD]",
          "peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs",
          "peer-disabled:opacity-50",
        )}
      >
        {label}
      </label>
      <span className="pointer-events-none absolute right-0 bottom-0 left-0 h-0.5 origin-center scale-x-0 bg-[#3B82F6] transition-transform duration-300 peer-focus:scale-x-100" />
      {trailing ? <span className="absolute right-0 bottom-1.5">{trailing}</span> : null}
    </div>
  );
}
