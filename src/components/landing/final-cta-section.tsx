import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand/logo";
import { SIGN_IN_HREF, SIGN_UP_HREF } from "@/components/landing/landing-navbar";
import { Button } from "@/components/ui/button";

export function FinalCtaSection() {
  return (
    <section aria-labelledby="cta-title" className="dark relative isolate overflow-hidden bg-night py-24 text-foreground">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_120%,rgba(37,99,235,0.55),transparent_70%)]"
      />
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 id="cta-title" className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Organize suas finanças hoje.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-blue-100/80">
          Leva menos de um minuto para começar. Na primeira fatura importada, você já sabe para onde foi cada centavo.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
            render={<Link href={SIGN_IN_HREF} />}
            className="h-12 w-full border-white/20 bg-white/5 px-6 text-base hover:bg-white/10 sm:w-auto"
          >
            Já tenho conta
          </Button>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="dark border-t border-white/10 bg-night pb-[env(safe-area-inset-bottom,0px)] text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-10 sm:flex-row sm:justify-between sm:px-6">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <BrandLogo height={22} />
          <p className="text-sm text-muted-foreground">Cada centavo no seu lugar.</p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href={SIGN_IN_HREF} className="transition-colors hover:text-foreground">
            Entrar
          </Link>
          <Link href={SIGN_UP_HREF} className="transition-colors hover:text-foreground">
            Criar conta
          </Link>
        </nav>
      </div>
    </footer>
  );
}
