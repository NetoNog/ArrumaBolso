import { ArrowLeft, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Condições gerais de utilização do ArrumaBolso para organização financeira pessoal.",
};

const UPDATED_AT = "Novembro de 2026";

export default function TermsOfUsePage() {
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
          <FileText className="size-3.5" />
          Condições de Uso
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Termos de Uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {UPDATED_AT}</p>

        <div className="mt-8 grid gap-8 text-sm leading-relaxed text-muted-foreground">
          <section className="grid gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">1. Aceitação dos termos</h2>
            <p>
              Ao criar uma conta ou utilizar o <strong className="text-foreground">ArrumaBolso</strong>, você concorda com
              estes Termos de Uso e com a nossa{" "}
              <Link href="/privacidade" className="font-medium text-brand hover:underline">
                Política de Privacidade
              </Link>
              . Caso não concorde com algum ponto, basta interromper o uso da plataforma.
            </p>
          </section>

          <section className="grid gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">2. Finalidade da plataforma</h2>
            <p>
              O ArrumaBolso é uma ferramenta digital de organização e planejamento financeiro pessoal (controle de despesas,
              receitas, faturas, parcelamentos, orçamento, projeções e despesas de pets).
            </p>
            <p>
              <strong className="text-foreground">Aviso importante:</strong> os cálculos, projeções de 12 meses, simuladores
              e alertas exibidos têm caráter exclusivamente informativo e educacional, não constituindo consultoria
              financeira, contábil, jurídica ou recomendação de investimentos.
            </p>
          </section>

          <section className="grid gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">3. Conta e responsabilidade do usuário</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Você é responsável pela confidencialidade das suas credenciais de acesso e pelas ações realizadas na conta.</li>
              <li>
                Os arquivos CSV/OFX importados e lançamentos digitados são de responsabilidade do usuário; recomendamos
                sempre conferir valores e datas oficiais junto à sua instituição financeira antes de realizar pagamentos.
              </li>
              <li>
                É proibido utilizar o serviço para atividades ilícitas, tentar acessar dados de terceiros ou comprometer a
                disponibilidade da infraestrutura.
              </li>
            </ul>
          </section>

          <section className="grid gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">4. Disponibilidade e backup</h2>
            <p>
              Empenhamos esforços contínuos para manter o ArrumaBolso disponível, rápido e seguro, porém o serviço é
              fornecido &ldquo;no estado em que se encontra&rdquo; e pode passar por manutenções ou atualizações. Você pode
              baixar uma cópia de segurança completa dos seus dados a qualquer momento em{" "}
              <strong className="text-foreground">Configurações → Exportar backup</strong>.
            </p>
          </section>

          <section className="grid gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">5. Propriedade intelectual</h2>
            <p>
              A marca, o design, os textos e o código do ArrumaBolso pertencem aos seus respectivos titulares. Os dados
              financeiros inseridos por você permanecem 100% sob sua titularidade.
            </p>
          </section>

          <section className="grid gap-2.5">
            <h2 className="text-lg font-semibold text-foreground">6. Alterações nos termos</h2>
            <p>
              Estes termos podem ser atualizados conforme o produto evolui. O uso contínuo após atualizações representa
              ciência e concordância com a versão vigente.
            </p>
          </section>
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-xs text-muted-foreground">
          <span>ArrumaBolso — Cada centavo no lugar.</span>
          <div className="flex items-center gap-4">
            <Link href="/privacidade" className="font-medium text-brand hover:underline">
              Política de Privacidade
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

