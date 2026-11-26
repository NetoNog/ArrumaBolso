"use client";

import { useState } from "react";

import { QuickAddBar } from "@/components/app/quick-add-bar";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMonthLabel } from "@/lib/dates";
import { transactionsOfMonth } from "@/lib/finance/metrics";
import { useFinance } from "@/lib/store/finance-store";

type Scope = "month" | "all";

export function TransactionsView() {
  const { state, selectedMonth } = useFinance();
  const [scope, setScope] = useState<Scope>("month");
  const rows = scope === "month" ? transactionsOfMonth(state, selectedMonth) : state.transactions;

  return (
    <div className="grid gap-4">
      <QuickAddBar />
      <Tabs value={scope} onValueChange={(value) => setScope(value as Scope)}>
        <TabsList>
          <TabsTrigger value="month" className="px-3">
            Fatura {formatMonthLabel(selectedMonth)}
          </TabsTrigger>
          <TabsTrigger value="all" className="px-3">
            Todas as faturas
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <TransactionsTable
        key={scope}
        title={scope === "month" ? `Lançamentos • ${formatMonthLabel(selectedMonth)}` : "Todos os lançamentos"}
        description="Filtros combinados, edição inline de categoria, ações em lote e auditoria de origem (CSV, Manual, Editado, Previsto)"
        transactions={rows}
        showMonth={scope === "all"}
        advancedFilters
      />
    </div>
  );
}
