"use client";

import Link from "next/link";
import { cn } from "cn";

import { CategoryIcon } from "@/components/common/category-icon";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryBreakdown } from "@/lib/finance/metrics";
import { formatBRL, formatPercent } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

export function ratioTone(ratio: number): { bar: string; text: string } {
  if (ratio > 0.95) return { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" };
  if (ratio >= 0.75) return { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
  return { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
}

export function CategoryBreakdown() {
  const { state, selectedMonth } = useFinance();
  const rows = categoryBreakdown(state, selectedMonth);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Distribuição por Categoria vs. Teto</CardTitle>
        <CardDescription>Verde abaixo de 75%, âmbar até 95%, vermelho acima</CardDescription>
        <CardAction>
          <Link href="/orcamento" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
            Editar tetos
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-x-10 gap-y-3.5 md:grid-cols-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Crie categorias em Orçamento & Metas.</p> : null}
        {rows.map((row) => {
          const tone = ratioTone(row.ratio);
          return (
            <div key={row.category?.id ?? "none"} className="grid gap-1.5">
              <div className="flex items-center gap-2 text-[13px]">
                {row.category ? <CategoryIcon icon={row.category.icon} color={row.category.color} /> : <CategoryIcon icon="tag" color="#64748B" />}
                <span className="flex-1 truncate font-medium">{row.category?.name ?? "Sem categoria"}</span>
                <span className="num text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{formatBRL(row.spent)}</span>
                  {row.limit > 0 ? ` / ${formatBRL(row.limit)}` : ""}
                </span>
                {row.limit > 0 ? (
                  <span className={cn("num w-14 text-right text-xs font-semibold", tone.text)}>{formatPercent(row.ratio)}</span>
                ) : (
                  <span className="w-14" />
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(row.ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className={cn("h-full rounded-full transition-[width]", row.limit > 0 ? tone.bar : "bg-slate-400")} style={{ width: `${Math.min(row.ratio, 1) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
