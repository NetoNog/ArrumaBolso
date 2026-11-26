"use client";

import Link from "next/link";
import { useMemo } from "react";
import { cn } from "cn";

import { usePrivacy } from "@/components/app/privacy-provider";
import { CategoryIcon } from "@/components/common/category-icon";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryBreakdown } from "@/lib/finance/metrics";
import { formatBRL, formatPercent } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

export function ratioTone(ratio: number): { bar: string; text: string } {
  if (ratio > 0.95) return { bar: "bg-negative", text: "text-negative" };
  if (ratio >= 0.75) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-positive", text: "text-positive" };
}

export function CategoryBreakdown() {
  const { state, selectedMonth, selectedCardId } = useFinance();
  const { mask } = usePrivacy();
  const rows = useMemo(
    () => categoryBreakdown(state, selectedMonth, selectedCardId),
    [state, selectedMonth, selectedCardId],
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Distribuição por Categoria vs. Teto</CardTitle>
        <CardDescription>Verde abaixo de 75%, âmbar até 95%, vermelho acima</CardDescription>
        <CardAction>
          <Link href="/orcamento" className="text-xs font-medium text-brand hover:underline">
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
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {row.category ? <CategoryIcon icon={row.category.icon} color={row.category.color} /> : <CategoryIcon icon="tag" color="#64748B" />}
                  <span className="truncate font-medium">{row.category?.name ?? "Sem categoria"}</span>
                </div>
                <div className="flex shrink-0 items-baseline gap-2">
                  <span className="num hidden text-xs text-muted-foreground sm:inline">
                    <span className="font-medium text-foreground">{mask(formatBRL(row.spent))}</span>
                    {row.limit > 0 ? ` / ${mask(formatBRL(row.limit))}` : ""}
                  </span>
                  {row.limit > 0 ? (
                    <span className={cn("num text-right text-xs font-semibold sm:w-12", tone.text)}>{formatPercent(row.ratio)}</span>
                  ) : (
                    <span className="num text-xs font-medium text-foreground sm:hidden">{mask(formatBRL(row.spent))}</span>
                  )}
                </div>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`Uso do orçamento de ${row.category?.name ?? "Sem categoria"}`}
                aria-valuenow={Math.round(row.ratio * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className={cn("h-full rounded-full transition-[width]", row.limit > 0 ? tone.bar : "bg-slate-400")} style={{ width: `${Math.min(row.ratio, 1) * 100}%` }} />
              </div>
              {row.limit > 0 ? (
                <div className="num flex items-center justify-between text-[11px] text-muted-foreground sm:hidden">
                  <span className="font-medium text-foreground">{mask(formatBRL(row.spent))}</span>
                  <span>teto {mask(formatBRL(row.limit))}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
