import { ArrowLeft, Check, Download, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { BrandPattern } from "@/components/brand/brand-pattern";
import { BrandLogo, BrandMark, BrandWordmark } from "@/components/brand/logo";
import { SYMBOL_PATH } from "@/components/brand/brand-paths";

export const metadata: Metadata = {
  title: "Identidade Visual • ArrumaBolso",
  description: "Logo, cores, tipografia, padrão gráfico e regras de uso da marca ArrumaBolso.",
};

const CORE_COLORS = [
  { name: "Azul Bolso", hex: "#2563EB", rgb: "37 99 235", role: "Cor da marca. Símbolo, “Bolso”, ações primárias.", contrast: "5,2:1 sobre branco (AA)", dark: false },
  { name: "Tinta", hex: "#0F172A", rgb: "15 23 42", role: "Texto principal e “Arruma” no logo.", contrast: "17,9:1 sobre branco (AAA)", dark: true },
  { name: "Noite", hex: "#0B1B4D", rgb: "11 27 77", role: "Fundos de marca (login, capas).", contrast: "Branco sobre ela: 16,4:1", dark: true },
  { name: "Névoa", hex: "#F8FAFC", rgb: "248 250 252", role: "Canvas do app.", contrast: "—", dark: false },
  { name: "Borda", hex: "#E2E8F0", rgb: "226 232 240", role: "Linhas, divisores e contornos de cards.", contrast: "—", dark: false },
];

const SEMANTIC_COLORS = [
  { name: "Alívio", hex: "#10B981", role: "Dentro da meta, parcela encerrando, entradas" },
  { name: "Atenção", hex: "#F59E0B", role: "75–95% do teto, duplicidade a revisar" },
  { name: "Alerta", hex: "#E11D48", role: "Acima de 95% do teto, exclusões" },
  { name: "Recorrência", hex: "#8B5CF6", role: "Assinaturas e itens previstos" },
];

const VERSIONS = [
  { label: "Horizontal (principal)", file: "lockup-horizontal.svg", node: <BrandLogo height={40} />, dark: false },
  { label: "Horizontal sobre escuro", file: "lockup-horizontal-on-dark.svg", node: <OnDarkLockup />, dark: true },
  { label: "Símbolo", file: "symbol.svg", node: <BrandMark size={72} />, dark: false },
  { label: "Ícone de app", file: "app-icon.svg", node: <BrandMark size={72} variant="tile" />, dark: false },
  { label: "Wordmark", file: "wordmark.svg", node: <BrandWordmark height={30} />, dark: false },
  { label: "Uma cor (preto)", file: "lockup-horizontal-black.svg", node: <BrandLogo height={40} monochrome className="text-black" />, dark: false },
];

function OnDarkLockup() {
  return (
    <span className="[--brand:#60A5FA] [--foreground:#FFFFFF]">
      <BrandLogo height={40} />
    </span>
  );
}

export default function BrandGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Voltar ao app
          </Link>
          <nav className="hidden gap-5 text-sm text-muted-foreground md:flex" aria-label="Seções">
            {["conceito", "versoes", "uso", "cores", "tipografia", "padrao", "voz"].map((id) => (
              <a key={id} href={`#${id}`} className="capitalize hover:text-foreground">
                {id === "versoes" ? "Versões" : id === "padrao" ? "Padrão" : id === "uso" ? "Uso" : id === "voz" ? "Voz" : id}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-20 px-6 py-12">
        <section className="relative overflow-hidden rounded-3xl bg-[#0B1B4D] px-8 py-16 text-white sm:px-14">
          <div className="absolute inset-0 bg-[radial-gradient(90%_90%_at_100%_0%,#2563EB_0%,transparent_60%)]" />
          <BrandPattern id="ab-bars-hero" className="text-white" opacity={0.05} />
          <div className="relative grid gap-6">
            <span className="w-fit rounded-full border border-white/20 px-3 py-1 text-xs text-blue-100">Identidade Visual • v1.0</span>
            <OnDarkLockup />
            <p className="max-w-xl text-lg text-blue-50/90">
              Um bolso com as contas em ordem. O símbolo junta o nome — <strong className="font-semibold text-white">arruma</strong> +{" "}
              <strong className="font-semibold text-white">bolso</strong> — à promessa do produto: barras organizadas que sobem, como a
              projeção dos próximos meses.
            </p>
          </div>
        </section>

        <Section id="conceito" eyebrow="01" title="Conceito e construção">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="relative aspect-square rounded-2xl border bg-card p-6 shadow-panel">
              <ConstructionDiagram />
            </div>
            <div className="grid content-center gap-5 text-sm">
              <Fact title="O bolso">Um “U” de fundo reto com cantos arredondados, como o bolso de uma calça. Abertura no topo: o que está dentro é visível.</Fact>
              <Fact title="As barras">Três barras alinhadas pela base, em ordem crescente: o que estava bagunçado agora está arrumado — e o próximo mês já está à vista.</Fact>
              <Fact title="A grade">Construído em módulos de 4 px num quadro de 256. Bolso com traço 22, barras de 26 com intervalo de 10 e raio de canto 5.</Fact>
              <Fact title="Abaixo de 32 px">Uma versão reduzida usa duas barras mais largas e traço mais pesado, para não embolar em favicons e abas.</Fact>
            </div>
          </div>
        </Section>

        <Section id="versoes" eyebrow="02" title="Versões do logo">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VERSIONS.map((version) => (
              <figure key={version.label} className="overflow-hidden rounded-2xl border bg-card shadow-panel">
                <div className={`flex h-40 items-center justify-center ${version.dark ? "bg-[#0B1B4D]" : "bg-card"}`}>{version.node}</div>
                <figcaption className="flex items-center justify-between border-t px-4 py-3 text-sm">
                  <span className="font-medium">{version.label}</span>
                  <a href={`/brand/${version.file}`} download className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <Download className="size-3.5" /> SVG
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Todos os arquivos — empilhado, branco, ícones PNG e favicon — estão em <code className="num">public/brand</code> e{" "}
            <code className="num">design/logo</code>.
          </p>
        </Section>

        <Section id="uso" eyebrow="03" title="Área de proteção, tamanhos e usos">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6 shadow-panel">
              <p className="text-sm font-medium">Área de proteção = 1 barra (x)</p>
              <p className="mt-1 text-xs text-muted-foreground">Nenhum outro elemento entra no espaço igual à largura de uma barra + intervalo ao redor do logo.</p>
              <div className="mt-6 flex justify-center">
                <div className="relative border border-dashed border-rose-400 p-5">
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-rose-500">x</span>
                  <span className="absolute top-1/2 -left-4 -translate-y-1/2 text-[10px] font-semibold text-rose-500">x</span>
                  <BrandLogo height={36} />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-panel">
              <p className="text-sm font-medium">Tamanhos mínimos</p>
              <div className="mt-5 grid gap-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <BrandLogo height={16} />
                  <span className="text-xs text-muted-foreground">Horizontal: 88 px de largura</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <BrandMark size={24} />
                  <span className="text-xs text-muted-foreground">Símbolo: 24 px (versão completa)</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <BrandMark size={16} variant="tile" />
                  <span className="text-xs text-muted-foreground">16 px: usar versão reduzida (2 barras)</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Misuse ok label="Original, sobre fundo claro">
              <BrandMark size={64} />
            </Misuse>
            <Misuse label="Não distorcer">
              <span className="inline-block scale-x-150">
                <BrandMark size={64} />
              </span>
            </Misuse>
            <Misuse label="Não girar">
              <span className="inline-block rotate-[20deg]">
                <BrandMark size={64} />
              </span>
            </Misuse>
            <Misuse label="Não trocar cores nem aplicar efeitos">
              <span className="[--brand:#F97316] drop-shadow-[4px_4px_0_#000]">
                <BrandMark size={64} />
              </span>
            </Misuse>
          </div>
        </Section>

        <Section id="cores" eyebrow="04" title="Cores">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {CORE_COLORS.map((color) => (
              <div key={color.hex} className="overflow-hidden rounded-2xl border bg-card shadow-panel">
                <div className="flex h-28 items-end p-3" style={{ backgroundColor: color.hex }}>
                  <span className={`text-sm font-semibold ${color.dark || color.hex === "#2563EB" ? "text-white" : "text-slate-900"}`}>{color.name}</span>
                </div>
                <div className="grid gap-1 p-3 text-xs">
                  <span className="num font-medium">{color.hex}</span>
                  <span className="num text-muted-foreground">RGB {color.rgb}</span>
                  <span className="text-muted-foreground">{color.role}</span>
                  <span className="text-[11px] text-muted-foreground">{color.contrast}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SEMANTIC_COLORS.map((color) => (
              <div key={color.hex} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-panel">
                <span className="size-9 shrink-0 rounded-lg" style={{ backgroundColor: color.hex }} />
                <div className="text-xs">
                  <p className="font-medium">
                    {color.name} <span className="num text-muted-foreground">{color.hex}</span>
                  </p>
                  <p className="text-muted-foreground">{color.role}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Regra de proporção: 80% neutros (Névoa, branco, Tinta), 15% Azul Bolso, até 5% cores semânticas — elas sinalizam estado, nunca decoram.
          </p>
        </Section>

        <Section id="tipografia" eyebrow="05" title="Tipografia">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6 shadow-panel">
              <p className="text-xs text-muted-foreground">Interface e títulos</p>
              <p className="mt-2 text-5xl font-bold tracking-tight">Inter</p>
              <p className="mt-4 text-2xl font-semibold tracking-tight">Visão Geral Financeira</p>
              <p className="text-sm text-muted-foreground">Métricas de faturas, recorrências e previsibilidade futura</p>
              <p className="mt-4 text-xs text-muted-foreground">Bold 700 no logo • Semibold 600 títulos • Medium 500 rótulos • Regular 400 texto</p>
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-panel">
              <p className="text-xs text-muted-foreground">Valores, datas e percentuais</p>
              <p className="num mt-2 text-5xl font-semibold">JetBrains Mono</p>
              <p className="num mt-4 text-2xl font-semibold">R$ 1.154,97</p>
              <p className="num text-sm text-muted-foreground">07/11/2026 • 61,5% • Parcela 1/2</p>
              <p className="mt-4 text-xs text-muted-foreground">Sempre com algarismos tabulares, para colunas de valores alinhadas.</p>
            </div>
          </div>
        </Section>

        <Section id="padrao" eyebrow="06" title="Padrão gráfico">
          <div className="relative h-56 overflow-hidden rounded-2xl bg-brand-soft text-brand">
            <BrandPattern id="ab-bars-sample" opacity={0.18} />
            <div className="relative flex h-full items-center justify-center">
              <span className="rounded-xl bg-card px-4 py-2 shadow-panel">
                <BrandLogo height={30} />
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            As três barras do símbolo se repetem num ritmo calmo. Use em capas, fundos de login e materiais — sempre em baixa opacidade, nunca
            atrás de números ou tabelas.
          </p>
        </Section>

        <Section id="voz" eyebrow="07" title="Voz e tom">
          <div className="grid gap-4 md:grid-cols-3">
            <Voice title="Claro, não técnico" yes="Esta compra já estava na sua fatura." no="Hash duplicado detectado no lote." />
            <Voice title="Calmo, não alarmista" yes="R$ 39,86 de alívio no próximo mês." no="ATENÇÃO!!! Gastos fora de controle!" />
            <Voice title="Respeita o controle do usuário" yes="Sua edição está protegida." no="Seus dados foram atualizados automaticamente." />
          </div>
        </Section>
      </main>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">ArrumaBolso • Identidade Visual v1.0</footer>
    </div>
  );
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-6">
      <div>
        <p className="num text-xs font-semibold text-brand">{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Fact({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

function Misuse({ ok = false, label, children }: { ok?: boolean; label: string; children: ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-2xl border bg-card shadow-panel">
      <div className="flex h-32 items-center justify-center">{children}</div>
      <figcaption className="flex items-center gap-2 border-t px-4 py-3 text-xs">
        {ok ? <Check className="size-4 text-emerald-600" /> : <X className="size-4 text-rose-600" />}
        {label}
      </figcaption>
    </figure>
  );
}

function Voice({ title, yes, no }: { title: string; yes: string; no: string }) {
  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-5 shadow-panel text-sm">
      <p className="font-semibold">{title}</p>
      <p className="flex gap-2 text-emerald-700 dark:text-emerald-400">
        <Check className="mt-0.5 size-4 shrink-0" /> “{yes}”
      </p>
      <p className="flex gap-2 text-rose-700 dark:text-rose-400">
        <X className="mt-0.5 size-4 shrink-0" /> “{no}”
      </p>
    </div>
  );
}

/** Symbol on its 4-unit construction grid with the key dimensions called out. */
function ConstructionDiagram() {
  return (
    <svg viewBox="0 0 256 256" className="h-full w-full" role="img" aria-label="Construção do símbolo em grade">
      <defs>
        <pattern id="grid8" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0H0V8" fill="none" stroke="currentColor" strokeWidth="0.4" className="text-border" />
        </pattern>
      </defs>
      <rect width="256" height="256" fill="url(#grid8)" />
      <path d={SYMBOL_PATH} fillRule="evenodd" className="fill-brand" opacity="0.9" />
      <g className="text-rose-500" stroke="currentColor" strokeWidth="1" fill="none" strokeDasharray="3 2">
        <line x1="40" y1="24" x2="216" y2="24" />
        <line x1="40" y1="20" x2="40" y2="232" />
        <line x1="216" y1="20" x2="216" y2="232" />
        <line x1="28" y1="170" x2="228" y2="170" />
      </g>
      <g className="fill-rose-500" fontSize="9" fontFamily="var(--font-mono)">
        <text x="128" y="18" textAnchor="middle">176</text>
        <text x="222" y="166">base</text>
        <text x="64" y="90">22</text>
        <text x="87" y="102">26</text>
      </g>
    </svg>
  );
}
