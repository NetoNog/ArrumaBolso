import { CalendarRange, FileSpreadsheet, ListChecks, ShieldCheck, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { Pill } from "@/components/common/pill";
import SpotlightCard from "@/components/landing/react-bits/SpotlightCard";

/** SpotlightCard ships its own surface colors; map them onto the app tokens so it follows light/dark. */
const CARD_TOKENS = {
  "--spotlight-card-surface": "var(--card)",
  "--spotlight-card-border": "var(--border)",
  "--spotlight-card-shadow": "0 1px 2px rgb(15 23 42 / 0.04), 0 18px 40px -24px rgb(15 23 42 / 0.25)",
} as CSSProperties;

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  visual: ReactNode;
}

const FEATURES: readonly Feature[] = [
  {
    icon: FileSpreadsheet,
    title: "Importação inteligente do CSV do Nubank",
    description:
      "Envie a fatura e cada linha é conferida: o que já existe é ignorado, o que você editou fica protegido e as parcelas futuras são projetadas sozinhas.",
    visual: (
      <div className="grid gap-1.5 text-xs">
        <Row label="Lançamentos novos" value="23" tone="emerald" />
        <Row label="Duplicados ignorados" value="2" tone="amber" />
        <Row label="Edições suas protegidas" value="1" tone="blue" />
      </div>
    ),
  },
  {
    icon: CalendarRange,
    title: "Previsibilidade de verdade",
    description:
      "Entradas, saídas e saldo do mês dia a dia, mais a projeção de 12 meses com parcelas, assinaturas e salário. Você sabe quanto vai sobrar antes do mês acabar.",
    visual: (
      <div className="flex h-16 items-end gap-1.5" aria-hidden="true">
        {[40, 55, 48, 66, 60, 78, 72, 90].map((height, index) => (
          <span key={index} className="flex-1 rounded-t-md bg-brand" style={{ height: `${height}%`, opacity: 0.35 + index * 0.08 }} />
        ))}
      </div>
    ),
  },
  {
    icon: ListChecks,
    title: "Gestão completa, em poucos toques",
    description:
      "Receitas, despesas fixas e variáveis, categorias com teto de orçamento e regras de auto-categorização. Edite em lote, no computador ou no celular.",
    visual: (
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="emerald">Salário</Pill>
        <Pill tone="violet">Assinatura</Pill>
        <Pill tone="blue">Parcela 2/10</Pill>
        <Pill tone="amber">Mercado</Pill>
        <Pill tone="rose">Lazer</Pill>
      </div>
    ),
  },
];

export function FeaturesSection() {
  return (
    <section id="funcionalidades" aria-labelledby="features-title" className="scroll-mt-20 bg-background py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-brand">Funcionalidades</p>
          <h2 id="features-title" className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Tudo o que a planilha fazia, sem o trabalho de manter a planilha.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Três pilares para você parar de conferir fatura linha por linha e começar a decidir com antecedência.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description, visual }) => (
            <SpotlightCard
              key={title}
              theme="light"
              spotlightColor="rgba(37, 99, 235, 0.55)"
              intensity={0.3}
              spotlightSize={320}
              style={CARD_TOKENS}
              className="flex flex-col gap-5 rounded-2xl p-6"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-5" />
              </span>
              <div className="grid gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
              <div className="mt-auto rounded-xl border bg-muted/40 p-3">{visual}</div>
            </SpotlightCard>
          ))}
        </div>

        <p className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-600" />
          Cada conta é isolada com Row Level Security: só você enxerga seus lançamentos.
        </p>
      </div>
    </section>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "blue" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <Pill tone={tone}>{value}</Pill>
    </div>
  );
}
