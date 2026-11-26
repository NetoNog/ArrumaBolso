import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o ArrumaBolso coleta, protege e permite que você controle e exporte seus dados financeiros conforme a LGPD.",
};

const UPDATED_AT = "Novembro de 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="ArrumaBolso — página inicial" className="rounded-md">
            <BrandLogo height={24} />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar ao início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
          <ShieldCheck className="size-3.5" />
          Conformidade LGPD (Lei nº 13.709/2018)
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {UPDATED_AT}</p>

        <div className="mt-8 grid gap-8 text-sm leading-relaxed text-muted-foreground">
          <section className="grid gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">1. Nosso compromisso</h2>
            <p>
              O <strong className="text-foreground">ArrumaBolso</strong> foi construído para ajudar você a organizar suas
              finanças pessoais com privacidade total. Seus lançamentos, faturas, cartões, contas, metas e dados de pets
              pertencem exclusivamente a você — nunca vendemos, compartilhamos ou exibimos anúncios com base nos seus
              registros financeiros.
            </p>
          </section>

          <section className="grid gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">2. Quais dados coletamos</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">Dados de conta e autenticação:</strong> endereço de e-mail, apelido e
                identificador de login (por e-mail/senha ou conta Google via OAuth).
              </li>
              <li>
                <strong className="text-foreground">Dados financeiros inseridos por você:</strong> lançamentos manuais,
                extratos/faturas importados voluntariamente em CSV ou OFX, categorias, tetos de orçamento, assinaturas,
                metas, cartões, contas, comprovantes anexados e registros do módulo Meu Pet.
              </li>
              <li>
                <strong className="text-foreground">Preferências locais do navegador:</strong> tema visual (claro/escuro),
                cor de destaque, estilo de animação, modo privacidade, preferências de notificação e cache local de
                carregamento rápido (<code className="rounded bg-muted px-1 py-0.5 text-xs">localStorage</code> /{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">sessionStorage</code>).
              </li>
            </ul>
            <p>
              <strong className="text-foreground">Não solicitamos nem armazenamos senhas bancárias, números completos de
              cartão ou códigos CVV.</strong>
            </p>
          </section>

          <section className="grid gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">3. Isolamento e segurança</h2>
            <p>
              Todos os dados armazenados em nuvem utilizam infraestrutura PostgreSQL/Supabase com criptografia em trânsito
              (HTTPS/TLS) e políticas estritas de <strong className="text-foreground">Row Level Security (RLS)</strong>. Cada
              registro é vinculado ao identificador da sua conta autenticada, impedindo que outros usuários acessem suas
              informações. Comprovantes enviados são armazenados em bucket privado acessível apenas pelo titular.
            </p>
          </section>

          <section className="grid gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">4. Uso das informações</h2>
            <p>Usamos seus dados exclusivamente para:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Exibir seus painéis, gráficos, projeções de 12 meses, alertas financeiros e relatórios;</li>
              <li>Sincronizar suas informações entre celular e computador quando você está conectado;</li>
              <li>Enviar e-mails estritamente transacionais (confirmação de cadastro e redefinição de senha).</li>
            </ul>
          </section>

          <section className="grid gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">5. Seus direitos (LGPD)</h2>
            <p>A qualquer momento, diretamente em <strong className="text-foreground">Configurações</strong>, você pode:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">Portabilidade e acesso:</strong> exportar 100% dos seus dados em
                formato JSON estruturado ou CSV;
              </li>
              <li>
                <strong className="text-foreground">Correção:</strong> editar ou excluir qualquer lançamento, categoria,
                cartão, conta ou meta;
              </li>
              <li>
                <strong className="text-foreground">Eliminação:</strong> zerar todos os dados financeiros da conta ou
                encerrar o uso da plataforma.
              </li>
            </ul>
          </section>

          <section className="grid gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">6. Cookies e armazenamento local</h2>
            <p>
              Utilizamos cookies estritamente necessários para manter sua sessão autenticada com segurança. Não utilizamos
              cookies de rastreamento publicitário de terceiros.
            </p>
          </section>

          <section className="grid gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">7. Atualizações desta política</h2>
            <p>
              Esta política pode ser atualizada periodicamente para refletir novos recursos do aplicativo. A data de revisão
              no topo desta página sempre indica a versão vigente.
            </p>
          </section>
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-xs text-muted-foreground">
          <span>ArrumaBolso — Cada centavo no lugar.</span>
          <div className="flex items-center gap-4">
            <Link href="/termos" className="font-medium text-brand hover:underline">
              Termos de Uso
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Entrar
            </Link>
            <Link href="/cadastro" className="hover:text-foreground">
              Criar conta
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

