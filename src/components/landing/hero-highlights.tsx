import { ArrowLeftRight, CalendarRange, CreditCard, Repeat, Upload, Wallet, type LucideIcon } from "lucide-react";

/** The real modules of the app, one line each: what the visitor gets after signing up. */
const HIGHLIGHTS: readonly { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Upload,
    title: "Importação do CSV do Nubank",
    description: "Conciliação automática: duplicados ignorados e suas edições protegidas em cada reimportação.",
  },
  {
    icon: ArrowLeftRight,
    title: "Entradas e saídas",
    description: "Saldo do mês dia a dia, saídas por forma de pagamento e taxa de poupança.",
  },
  {
    icon: Wallet,
    title: "Salário e renda",
    description: "Cadastre suas fontes de renda e o dia do pagamento; o app avisa quando atrasar.",
  },
  {
    icon: CreditCard,
    title: "Faturas e parcelas",
    description: "Cada compra parcelada projetada até a última parcela, fatura por fatura.",
  },
  {
    icon: Repeat,
    title: "Assinaturas fixas",
    description: "Streaming, academia e planos que já comprometem os próximos meses, num só lugar.",
  },
  {
    icon: CalendarRange,
    title: "Projeção de 12 meses",
    description: "Quanto vai sobrar em cada mês, somando parcelas, assinaturas e renda esperada.",
  },
];

export function HeroHighlights() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <h2 className="text-center text-sm font-semibold tracking-wide text-blue-100/70 uppercase lg:text-left">
        Tudo o que você controla no ArrumaBolso
      </h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <p className="mt-1 text-sm leading-relaxed text-blue-100/70">{description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
