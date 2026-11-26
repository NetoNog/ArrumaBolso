"use client";

import {
  ArrowLeftRight,
  BarChart3,
  BellRing,
  CalendarRange,
  ClipboardCheck,
  CreditCard,
  Palette,
  PawPrint,
  Repeat,
  Smartphone,
  Sparkles,
  SunMoon,
  Upload,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "cn";

export const OPEN_HERO_NEWS_EVENT = "arrumabolso:open-hero-news";

type HeroTab = "overview" | "news";

const HIGHLIGHTS: readonly { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Upload,
    title: "Envie sua fatura em segundos",
    description: "Mande o arquivo da fatura ou do extrato do seu banco. O app ignora gastos repetidos e mantém tudo o que você já arrumou.",
  },
  {
    icon: ArrowLeftRight,
    title: "Quanto realmente pode gastar hoje",
    description: "Veja o que entrou, o que saiu e quanto sobra de verdade na conta depois de separar contas e faturas.",
  },
  {
    icon: CreditCard,
    title: "Todos os seus cartões e parcelas",
    description: "Acompanhe seus cartões num só lugar e veja cada compra parcelada até a última parcela, mês por mês.",
  },
  {
    icon: CalendarRange,
    title: "Veja os próximos 12 meses",
    description: "Antes de parcelar uma compra nova, teste no “Cabe no bolso?” e descubra se a parcela cabe nos próximos meses.",
  },
  {
    icon: Wallet,
    title: "Salário, assinaturas e limites",
    description: "Anote salário, 13º, streaming, academia, defina limites mensais de gasto e crie metas para juntar dinheiro.",
  },
  {
    icon: BarChart3,
    title: "Descubra onde o dinheiro escapa",
    description: "Veja os dias em que mais gasta, os pequenos gastos do dia a dia que pesam no mês e as lojas onde mais compra.",
  },
  {
    icon: ClipboardCheck,
    title: "Feche o mês sem dor de cabeça",
    description: "Um passo a passo simples no fim do mês para conferir suas faturas, organizar o que faltou e acompanhar suas metas.",
  },
  {
    icon: PawPrint,
    title: "Espaço exclusivo para seu Pet",
    description: "Cadastre seus pets, defina um valor mensal e acompanhe gastos com ração, veterinário, banho e remédios.",
  },
  {
    icon: Repeat,
    title: "Organização automática",
    description: "O app limpa nomes confusos da fatura e separa seus gastos por categoria sozinho, para você não perder tempo.",
  },
];

interface NewsRelease {
  icon: LucideIcon;
  tag: string;
  tagClass: string;
  date: string;
  title: string;
  description: string;
  bullets: readonly string[];
}

const NEWS_RELEASES: readonly NewsRelease[] = [
  {
    icon: Palette,
    tag: "Visual",
    tagClass: "bg-blue-500/20 text-blue-200 ring-blue-400/30",
    date: "Novidade",
    title: "Novo Modo Escuro + 4 cores para deixar o app com a sua cara",
    description:
      "Agora você escolhe se prefere a tela clara, escura ou seguindo o horário do seu celular — tudo pensado para uma leitura super confortável.",
    bullets: [
      "4 opções de cor para personalizar o app: Azul, Verde, Roxo e Grafite",
      "Cores mais nítidas e fáceis de ler tanto de dia quanto à noite",
    ],
  },
  {
    icon: SunMoon,
    tag: "Conforto",
    tagClass: "bg-violet-500/20 text-violet-200 ring-violet-400/30",
    date: "Novidade",
    title: "Troca de claro para escuro suave, sem incomodar os olhos",
    description:
      "Mudar entre o modo claro e escuro agora acontece na hora e de forma leve, sem aquele clarão forte no rosto quando você usa o app à noite.",
    bullets: [
      "3 estilos de animação para escolher nas Configurações: Círculo suave, Nascer do sol ou Dissolver",
      "Ícone de Sol e Lua animado no menu, respondendo na hora do clique",
    ],
  },
  {
    icon: BellRing,
    tag: "Avisos",
    tagClass: "bg-amber-500/20 text-amber-200 ring-amber-400/30",
    date: "Novidade",
    title: "Nova Central de Avisos para você nunca mais ser pego de surpresa",
    description:
      "O ArrumaBolso agora te avisa antes do aperto chegar — dentro do app e, se você quiser, com notificações direto no celular ou computador.",
    bullets: [
      "Avisa quando o limite de gasto estoura, quando o saldo fica apertado, quando uma assinatura vai vencer ou quando o salário atrasa",
      "Você escolhe quais avisos quer receber e pode esconder os valores se estiver perto de outras pessoas",
    ],
  },
  {
    icon: Smartphone,
    tag: "Celular e PC",
    tagClass: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/30",
    date: "Novidade",
    title: "Instale no celular em 1 toque e use o novo painel no computador",
    description:
      "Agora dá para colocar o ArrumaBolso direto na tela inicial do celular como um aplicativo, e o visual do computador ficou tão bonito e prático quanto o do celular.",
    bullets: [
      "Novo cartão de resumo no topo com seus cartões e atalhos rápidos em 1 clique",
      "Botão de olhinho para esconder seus valores em público e aviso quando estiver sem internet",
    ],
  },
  {
    icon: Zap,
    tag: "Rapidez",
    tagClass: "bg-cyan-500/20 text-cyan-200 ring-cyan-400/30",
    date: "Novidade",
    title: "Tudo muito mais rápido e leve para abrir",
    description:
      "Deixamos o aplicativo bem mais ágil para abrir suas informações na hora, sem ficar travando ou esperando telas carregarem.",
    bullets: [
      "Abre quase na hora tanto no celular quanto no computador",
      "Troca de meses, gráficos e listas deslizam de forma super fluida",
    ],
  },
];

/** Clickable launch pill placed at the top of the Hero that jumps straight into the Novidades tab. */
export function HeroNewsTriggerBadge() {
  function openNews() {
    window.dispatchEvent(new Event(OPEN_HERO_NEWS_EVENT));
    document.getElementById("hero-showcase-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <button
      type="button"
      onClick={openNews}
      className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-blue-100 backdrop-blur transition-colors hover:border-blue-300/40 hover:bg-white/12"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#60A5FA] opacity-75 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-[#60A5FA]" />
      </span>
      <span className="rounded-full bg-[#2563EB]/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-blue-100 uppercase">
        Novidades
      </span>
      <span>Novo visual escuro, avisos de contas e app no celular</span>
      <span aria-hidden className="text-[#93C5FD] transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </button>
  );
}

/** Hero lower showcase with interactive tabs: product overview highlights vs. user-friendly changelog (Novidades). */
export function HeroHighlights() {
  const [tab, setTab] = useState<HeroTab>("overview");

  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === "#novidades") {
        setTab("news");
      }
    };
    const openNews = () => setTab("news");
    const rafId = requestAnimationFrame(syncFromHash);

    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener(OPEN_HERO_NEWS_EVENT, openNews);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener(OPEN_HERO_NEWS_EVENT, openNews);
    };
  }, []);

  return (
    <div id="hero-showcase-tabs" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 pb-20 sm:px-6">
      <div id="novidades" className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="text-center sm:text-left">
          <h2 className="text-sm font-semibold tracking-wide text-blue-100/80 uppercase">
            {tab === "overview" ? "Tudo o que você acompanha no ArrumaBolso" : "Novidades que acabaram de chegar"}
          </h2>
          <p className="mt-1 text-xs text-blue-100/60">
            {tab === "overview"
              ? "Feito para qualquer pessoa organizar o dinheiro em poucos minutos."
              : "Veja tudo o que deixamos mais bonito, rápido e fácil de usar para você."}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Ver recursos ou novidades"
          className="inline-flex rounded-full border border-white/15 bg-white/[0.05] p-1 backdrop-blur"
        >
          <button
            type="button"
            role="tab"
            id="tab-hero-overview"
            aria-selected={tab === "overview"}
            aria-controls="panel-hero-overview"
            onClick={() => setTab("overview")}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
              tab === "overview"
                ? "bg-[#2563EB] text-white shadow-sm shadow-blue-600/40"
                : "text-blue-100/75 hover:text-white",
            )}
          >
            O que você faz aqui
          </button>
          <button
            type="button"
            role="tab"
            id="tab-hero-news"
            aria-selected={tab === "news"}
            aria-controls="panel-hero-news"
            onClick={() => setTab("news")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
              tab === "news"
                ? "bg-[#2563EB] text-white shadow-sm shadow-blue-600/40"
                : "text-blue-100/75 hover:text-white",
            )}
          >
            <Sparkles className="size-3.5" />
            <span>Novidades</span>
            <span
              className={cn(
                "num rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold",
                tab === "news" ? "bg-white/20 text-white" : "bg-[#2563EB]/35 text-blue-100",
              )}
            >
              {NEWS_RELEASES.length}
            </span>
          </button>
        </div>
      </div>

      {tab === "overview" ? (
        <div
          id="panel-hero-overview"
          role="tabpanel"
          aria-labelledby="tab-hero-overview"
          className="motion-safe:animate-[ab-fade-in_180ms_ease-out]"
        >
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
              <li
                key={title}
                className="flex gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.07]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB]/20 text-[#60A5FA] ring-1 ring-[#60A5FA]/25">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-blue-100/75">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          id="panel-hero-news"
          role="tabpanel"
          aria-labelledby="tab-hero-news"
          className="motion-safe:animate-[ab-fade-in_180ms_ease-out]"
        >
          <ul className="mt-6 grid gap-3.5 md:grid-cols-2">
            {NEWS_RELEASES.map(({ icon: Icon, tag, tagClass, date, title, description, bullets }, idx) => (
              <li
                key={title}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border border-white/12 bg-white/[0.05] p-5 backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/[0.08]",
                  idx === 0 && "md:col-span-2 bg-gradient-to-br from-[#2563EB]/18 via-white/[0.05] to-white/[0.03] border-blue-400/25",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#2563EB]/25 text-[#93C5FD] ring-1 ring-[#60A5FA]/30">
                      <Icon className="size-4" />
                    </span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1", tagClass)}>
                      {tag}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-blue-100/60">{date}</span>
                </div>

                <div>
                  <h3 className="text-base font-semibold tracking-tight text-white">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-blue-100/80">{description}</p>
                </div>

                <ul className="mt-auto grid gap-1.5 border-t border-white/10 pt-3 text-xs text-blue-100/80">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#60A5FA]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
