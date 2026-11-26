"use client";

import { FileSpreadsheet, Lock, ShieldCheck, TrendingUp, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "cn";

interface Slide {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Content of the phone screen. */
  screen: "password" | "invoice" | "chart";
}

const SLIDES: readonly Slide[] = [
  {
    title: "Seus dados protegidos",
    description: "Cada conta é isolada com Row Level Security. Só você vê seus lançamentos.",
    icon: ShieldCheck,
    screen: "password",
  },
  {
    title: "Importe sua fatura",
    description: "Envie o CSV do Nubank e a conciliação evita lançamentos duplicados.",
    icon: FileSpreadsheet,
    screen: "invoice",
  },
  {
    title: "Enxergue o futuro",
    description: "Parcelas e assinaturas projetadas nos próximos 12 meses.",
    icon: TrendingUp,
    screen: "chart",
  },
];

const INTERVAL_MS = 6000;

export function AuthShowcase() {
  const [active, setActive] = useState(0);
  const slide = SLIDES[active];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setActive((index) => (index + 1) % SLIDES.length), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Recursos do ArrumaBolso"
      className="flex h-full flex-col items-center justify-center gap-10 rounded-2xl bg-muted px-10 py-12"
    >
      <PhoneIllustration slide={slide} key={active} />

      <div className="max-w-sm text-center" aria-live="polite">
        <h2 className="text-lg font-semibold text-foreground">{slide.title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{slide.description}</p>
      </div>

      <div className="flex gap-2">
        {SLIDES.map((item, index) => (
          <button
            key={item.title}
            type="button"
            aria-label={`Mostrar: ${item.title}`}
            aria-current={index === active}
            onClick={() => setActive(index)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              index === active ? "w-6 bg-brand" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
            )}
          />
        ))}
      </div>
    </section>
  );
}

function PhoneIllustration({ slide }: { slide: Slide }) {
  const Badge = slide.icon;
  return (
    <div className="relative motion-safe:animate-[ab-fade-up_500ms_both]">
      <div className="flex h-72 w-44 flex-col rounded-[2rem] border-[6px] border-slate-800 bg-card p-4 shadow-2xl shadow-blue-900/20 dark:border-border">
        <span className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-muted" />
        <PhoneScreen screen={slide.screen} />
      </div>
      <span className="absolute -top-6 -left-10 flex size-20 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-blue-600/30">
        <Badge className="size-10" strokeWidth={1.75} />
      </span>
    </div>
  );
}

function PhoneScreen({ screen }: { screen: Slide["screen"] }) {
  if (screen === "password") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Lock className="size-8" />
        </span>
        <div className="flex gap-2 rounded-lg border border-brand/30 px-3 py-2">
          {[0, 1, 2, 3].map((dot) => (
            <span key={dot} className="size-2.5 rounded-full bg-brand" />
          ))}
        </div>
      </div>
    );
  }

  if (screen === "invoice") {
    return (
      <div className="grid gap-2.5">
        {[70, 45, 85, 55, 65].map((width, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="size-5 shrink-0 rounded-md bg-brand-soft" />
            <span className="h-2 rounded-full bg-muted" style={{ width: `${width}%` }} />
          </div>
        ))}
        <span className="mt-3 h-7 rounded-lg bg-brand" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-end justify-between gap-1.5 pb-2">
      {[35, 50, 42, 64, 58, 78, 90].map((height, index) => (
        <span key={index} className="flex-1 rounded-t-md bg-brand" style={{ height: `${height}%`, opacity: 0.35 + index * 0.1 }} />
      ))}
    </div>
  );
}
