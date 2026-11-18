"use client";

import { Bell, CalendarDays, ChevronLeft, ChevronRight, Plus, Upload } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { SignOutButton } from "@/components/app/sign-out-button";
import { findNavItem } from "@/components/app/navigation";
import { Pill } from "@/components/common/pill";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addMonths, formatMonthLabel } from "@/lib/dates";
import { duplicateCandidates } from "@/lib/finance/metrics";
import { formatBRL } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

export function Header() {
  const pathname = usePathname();
  const item = findNavItem(pathname);
  const { openCreate, openImport } = useDialogs();
  const { status } = useFinance();
  const ready = status === "ready";

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl dark:text-zinc-50">{item.title}</h1>
          <p className="hidden truncate text-sm text-slate-500 sm:block dark:text-zinc-400">{item.subtitle}</p>
        </div>
        <div className={cn("flex items-center gap-2", !ready && "invisible")}>
          <MonthSwitcher className="hidden sm:flex" />
          {/* Below lg the bottom navigation carries the "new expense" action. */}
          <Button variant="outline" onClick={() => openCreate()} className="hidden h-9 lg:inline-flex">
            <Plus /> Novo Gasto
          </Button>
          <AlertsBell />
          <Button onClick={openImport} className="h-9 bg-blue-600 font-medium text-white hover:bg-blue-700" aria-label="Importar CSV">
            <Upload /> <span className="hidden sm:inline">Importar CSV</span>
          </Button>
        </div>
        {/* Outside the ready gate: signing out must work even if the data failed to load. */}
        <span aria-hidden="true" className="hidden h-6 w-px bg-border sm:block" />
        <SignOutButton compact className="sm:hidden" />
        <SignOutButton className="hidden sm:inline-flex" />
      </div>
      <div className={cn("px-4 pb-3 sm:hidden", !ready && "invisible")}>
        <MonthSwitcher className="w-full" />
      </div>
    </header>
  );
}

function MonthSwitcher({ className }: { className?: string }) {
  const { selectedMonth, setSelectedMonth, currentMonth } = useFinance();
  const isCurrent = selectedMonth === currentMonth;
  return (
    <div className={cn("flex h-9 items-center justify-between rounded-lg border bg-card shadow-panel pointer-coarse:h-11", className)}>
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
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-0">
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
