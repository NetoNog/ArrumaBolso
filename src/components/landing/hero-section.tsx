import { ArrowRight, ChevronDown, FileSpreadsheet, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import Link from "next/link";

import { HeroBackground } from "@/components/landing/hero-background";
import { HeroHeadline } from "@/components/landing/hero-headline";
import { HeroHighlights, HeroNewsTriggerBadge } from "@/components/landing/hero-highlights";
import { HeroMockup } from "@/components/landing/hero-mockup";
import { SIGN_UP_HREF } from "@/components/landing/landing-navbar";
import { Button } from "@/components/ui/button";

const TRUST = [
  { icon: Sparkles, label: "100% gratuito" },
  { icon: FileSpreadsheet, label: "Funciona com vários bancos" },
  { icon: ShieldCheck, label: "Só você vê seus gastos" },
  { icon: Smartphone, label: "Instale no celular como app" },
] as const;

/** Above the fold: promise, how it works in one sentence, two CTAs and a live-feeling preview. */
export function HeroSection() {
  return (
    <section aria-labelledby="hero-title" className="dark relative isolate overflow-hidden bg-night text-foreground">
      <HeroBackground />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-[calc(6rem+env(safe-area-inset-top,0px))] pb-14 sm:px-6 lg:pt-[calc(8rem+env(safe-area-inset-top,0px))] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10">
        <div className="text-center lg:text-left">
          <HeroNewsTriggerBadge />

          <div id="hero-title" className="mt-6">
            <HeroHeadline />
          </div>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-blue-100/85 lg:mx-0">
            Chega de montar planilha à mão ou descobrir tarde demais quanto gastou no cartão. Com o ArrumaBolso, você envia a
            fatura do seu banco sem repetir gastos, descobre <strong className="font-semibold text-white">quanto ainda pode gastar hoje</strong>{" "}
            e acompanha parcelas, contas fixas, metas e até os gastos do seu pet — direto no celular ou no computador.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Button
              nativeButton={false}
              render={<Link href={SIGN_UP_HREF} />}
              className="group h-12 w-full bg-[#2563EB] px-6 text-base text-white shadow-lg shadow-blue-600/30 hover:bg-[#1D4ED8] sm:w-auto"
            >
              Criar conta grátis
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href="#funcionalidades" />}
              className="h-12 w-full border-white/20 bg-white/5 px-6 text-base hover:bg-white/10 sm:w-auto"
            >
              Ver o que o app faz
              <ChevronDown />
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-blue-100/75 lg:justify-start">
            {TRUST.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5">
                <Icon className="size-4 text-[#60A5FA]" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          {/* Soft brand glow behind the preview. */}
          <div aria-hidden="true" className="absolute -inset-8 rounded-full bg-[#2563EB]/15 blur-3xl" />
          <HeroMockup />
          <p className="relative mt-4 text-center text-xs text-blue-100/55">Exemplo de como fica o seu painel</p>
        </div>
      </div>

      <HeroHighlights />
    </section>
  );
}
