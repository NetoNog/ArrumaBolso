import Link from "next/link";

import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const SIGN_IN_HREF = "/login";
export const SIGN_UP_HREF = "/cadastro";

/** Fixed glass navbar. Always on the dark "Noite" surface so the logo and buttons keep their contrast while scrolling. */
export function LandingNavbar() {
  return (
    <header className="dark fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-night/70 pt-[env(safe-area-inset-top,0px)] text-foreground backdrop-blur-xl supports-[backdrop-filter]:bg-night/55">
      <nav aria-label="Principal" className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="ArrumaBolso — início" className="rounded-md">
          <BrandLogo height={26} />
        </Link>
        <div className="ml-6 hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#funcionalidades" className="transition-colors hover:text-foreground">
            Funcionalidades
          </a>
          <a href="#como-funciona" className="transition-colors hover:text-foreground">
            Como funciona
          </a>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href={SIGN_IN_HREF} />} className="h-9 border-white/20 bg-transparent px-3.5 hover:bg-white/10">
            Entrar
          </Button>
          <Button nativeButton={false} render={<Link href={SIGN_UP_HREF} />} className="h-9 bg-[#2563EB] px-3.5 text-white hover:bg-[#1D4ED8]">
            Cadastrar
          </Button>
        </div>
      </nav>
    </header>
  );
}
