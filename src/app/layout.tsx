import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/app/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Figtree, the typeface of the Astryx design system (Meta). Variable font: one
// file covers every weight, and it ships tabular figures for money columns.
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  title: "ArrumaBolso — Inteligência Financeira Pessoal",
  description: "Faturas, parcelas, assinaturas e projeção de 12 meses em um painel só.",
  appleWebApp: { capable: true, title: "ArrumaBolso", statusBarStyle: "default" },
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
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
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
