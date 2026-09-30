import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/components/providers/query-provider';
import { PeriodProvider } from '@/components/providers/period-provider';
import { PrivacyProvider } from '@/components/providers/privacy-provider';
import { AuthGuard } from '@/components/auth/auth-guard';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#090d16',
};

export const metadata: Metadata = {
  title: 'ArrumaBolso — Suas Finanças nos Trinques',
  description: 'ArrumaBolso: Gestão financeira com foco em previsibilidade, visão escura relaxante para os olhos, faturas Nubank, controle de despesas e metas.',
  applicationName: 'ArrumaBolso',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ArrumaBolso',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/favicon.svg',
    apple: [
      { url: '/arrumabolso-icon.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`dark ${inter.variable}`} style={{ colorScheme: 'dark' }}>
      <body className={`min-h-screen bg-background font-sans text-foreground selection:bg-primary/20 selection:text-primary overflow-x-hidden ${inter.className}`}>
        <QueryProvider>
          <PeriodProvider>
            <PrivacyProvider>
              <AuthGuard>
                {children}
              </AuthGuard>
            </PrivacyProvider>
          </PeriodProvider>
          <Toaster 
            position="top-right" 
            richColors 
            closeButton
            toastOptions={{
              style: {
                borderRadius: '0.85rem',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))'
              }
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
