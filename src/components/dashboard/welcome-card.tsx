"use client";

import { Plus, Tags, Upload } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useDialogs } from "@/components/app/dialogs-provider";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/lib/store/finance-store";

/** First-run guidance for an account with no transactions yet. */
export function WelcomeCard() {
  const { state } = useFinance();
  const { openImport, openCreate } = useDialogs();
  const hasCategories = state.categories.length > 0;

  return (
    <section className="rounded-xl border border-l-4 border-l-brand bg-card p-6 shadow-panel">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Vamos arrumar o seu bolso</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Sua conta está vazia. Importe a fatura do seu cartão em CSV ou OFX (Nubank, Inter, Itaú, Bradesco e outros) ou registre um gasto manualmente. Os
            indicadores, alertas e a projeção de 12 meses aparecem assim que houver lançamentos.
          </p>
          <ol className="mt-4 grid gap-1.5 text-sm">
            <Step done={hasCategories} index={1}>
              Crie suas categorias e tetos em{" "}
              <Link href="/orcamento" className="font-medium text-brand hover:underline">
                Orçamento & Metas
              </Link>
            </Step>
            <Step done={false} index={2}>
              Importe a fatura atual (CSV ou OFX)
            </Step>
            <Step done={false} index={3}>
              Marque as assinaturas e revise os alertas
            </Step>
          </ol>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openImport} className="h-10 bg-brand text-white hover:bg-blue-700 dark:hover:bg-blue-500">
            <Upload /> Importar fatura
          </Button>
          <Button variant="outline" className="h-10" onClick={() => openCreate()}>
            <Plus /> Novo gasto
          </Button>
          {!hasCategories ? (
            <Button variant="outline" className="h-10" nativeButton={false} render={<Link href="/orcamento" />}>
              <Tags /> Criar categorias
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Step({ done, index, children }: { done: boolean; index: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={
          done
            ? "num flex size-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-white"
            : "num flex size-5 items-center justify-center rounded-full border text-xs font-semibold text-muted-foreground"
        }
      >
        {done ? "✓" : index}
      </span>
      <span className={done ? "text-muted-foreground line-through" : undefined}>{children}</span>
    </li>
  );
}
