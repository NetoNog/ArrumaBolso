"use client";

import { Bell, CalendarDays, ChevronLeft, ChevronRight, Menu, Plus, Upload } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { findNavItem } from "@/components/app/navigation";
import { Pill } from "@/components/common/pill";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addMonths, formatMonthLabel } from "@/lib/dates";
import { duplicateCandidates } from "@/lib/finance/metrics";
import { formatBRL } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const item = findNavItem(pathname);
  const { openCreate, openImport } = useDialogs();
  const { status } = useFinance();

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={onOpenMenu}>
          <Menu />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">{item.title}</h1>
          <p className="hidden truncate text-sm text-slate-500 sm:block dark:text-zinc-400">{item.subtitle}</p>
        </div>
        <div className={cn("flex w-full flex-wrap items-center gap-2 sm:w-auto", status !== "ready" && "invisible")}>
          <MonthSwitcher />
          <Button variant="outline" onClick={() => openCreate()} className="h-9">
            <Plus /> <span className="hidden sm:inline">Novo Gasto</span>
          </Button>
          <AlertsBell />
          <Button onClick={openImport} className="h-9 bg-blue-600 font-medium text-white hover:bg-blue-700">
            <Upload /> <span className="hidden sm:inline">Importar CSV</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

function MonthSwitcher() {
  const { selectedMonth, setSelectedMonth, currentMonth } = useFinance();
  const isCurrent = selectedMonth === currentMonth;
  return (
    <div className="flex h-9 items-center rounded-lg border bg-card shadow-panel">
      <Button variant="ghost" size="icon-sm" aria-label="Fatura anterior" onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))}>
        <ChevronLeft />
      </Button>
      <button
        type="button"
        onClick={() => setSelectedMonth(currentMonth)}
        title="Voltar para a fatura atual"
        className="flex items-center gap-1.5 px-1.5 text-[13px] font-medium"
      >
        <CalendarDays className="size-3.5 text-muted-foreground" />
        <span className="num">Fatura {formatMonthLabel(selectedMonth)}</span>
        {!isCurrent ? <span className={cn("size-1.5 rounded-full bg-blue-500")} aria-label="não é a fatura atual" /> : null}
      </button>
      <Button variant="ghost" size="icon-sm" aria-label="Próxima fatura" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
        <ChevronRight />
      </Button>
    </div>
  );
}

function AlertsBell() {
  const { state, selectedMonth } = useFinance();
  const { openEdit } = useDialogs();
  const dismissed = new Set(state.settings.dismissed_alerts);
  const groups = duplicateCandidates(state, selectedMonth).filter(
    (group) => !dismissed.has(`duplicate:${group.map((tx) => tx.id).sort().join(",")}`),
  );

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="icon" className="relative h-9 w-9" aria-label={`${groups.length} alertas pendentes`} />}
      >
        <Bell />
        {groups.length > 0 ? (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">
            {groups.length}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Pendentes de revisão</p>
          <Pill tone={groups.length ? "rose" : "emerald"}>{groups.length ? `${groups.length} ativo(s)` : "Tudo certo"}</Pill>
        </div>
        <div className="grid gap-1 p-2">
          {groups.length === 0 ? (
            <p className="px-1 py-3 text-center text-xs text-muted-foreground">Nenhuma duplicidade na fatura {formatMonthLabel(selectedMonth)}.</p>
          ) : (
            groups.map((group) => (
              <button
                key={group[0].id}
                type="button"
                onClick={() => openEdit(group[group.length - 1].id)}
                className="rounded-lg px-2 py-2 text-left hover:bg-muted"
              >
                <p className="text-[13px] font-medium">
                  {group[0].clean_title} ({group.length}x <span className="num">{formatBRL(group[0].amount)}</span>)
                </p>
                <p className="text-xs text-muted-foreground">Mesmo valor no mesmo dia • clique para revisar</p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
