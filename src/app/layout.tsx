import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/app/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

// Figtree, the typeface of the Astryx design system (Meta). Variable font: one
// file covers every weight, and it ships tabular figures for money columns.
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "ArrumaBolso — Seu dinheiro no controle. Cada centavo no lugar.",
    template: "%s | ArrumaBolso",
  },
  description:
    "Importe faturas e extratos em CSV ou OFX sem duplicidade, veja seu Saldo Livre Real, projete 12 meses e controle cartões, metas e pets no celular ou desktop.",
  appleWebApp: { capable: true, title: "ArrumaBolso", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ArrumaBolso",
    title: "ArrumaBolso — Seu dinheiro no controle. Cada centavo no lugar.",
    description:
      "Abandone as planilhas: importe faturas CSV/OFX sem duplicidade, veja seu Saldo Livre Real, projete 12 meses e use como app no celular ou desktop.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ArrumaBolso — Cada centavo no lugar.",
    description:
      "Controle financeiro pessoal com CSV/OFX multi-bancos, Saldo Livre Real, projeção de 12 meses, alertas inteligentes e PWA instalável.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Paint under the notch/home indicator; fixed bars pad themselves with env(safe-area-inset-*).
  viewportFit: "cover",
  // Android: the keyboard shrinks the layout so bottom-pinned UI stays visible.
  interactiveWidget: "resizes-content",
  // Matches --background so the status bar blends into the header.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1d" },
  ],
};

const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("arrumabolso.theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);var a=localStorage.getItem("arrumabolso.accent");if(a==="emerald"||a==="violet"||a==="slate"){document.documentElement.setAttribute("data-accent",a);}}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${figtree.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster
              position="bottom-right"
              richColors
              closeButton
              // Above the mobile bottom navigation and the home indicator.
              mobileOffset={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
