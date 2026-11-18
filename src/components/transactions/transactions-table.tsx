"use client";

import {
  ArrowDownUp,
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { CategorySelect } from "@/components/common/category-select";
import { Pill } from "@/components/common/pill";
import { SimpleSelect } from "@/components/common/simple-select";
import { SourceBadge } from "@/components/common/source-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { extractInstallment } from "@/lib/categorization";
import { formatDateBR, formatMonthLabel } from "@/lib/dates";
import {
  bulkSetCategory,
  duplicateTransaction,
  markAsSubscription,
  setIgnored,
  updateTransaction,
  upsertRule,
} from "@/lib/domain/operations";
import { PAYMENT_METHOD_LABEL, type PaymentMethod, type Transaction } from "@/lib/domain/types";
import { duplicateCandidates } from "@/lib/finance/metrics";
import { formatBRL, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

export type QuickFilter = "all" | "csv" | "manual" | "installments" | "subscriptions" | "alerts" | "payments";
type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "csv", label: "Importados CSV" },
  { key: "manual", label: "Manuais" },
  { key: "installments", label: "Parcelados" },
  { key: "subscriptions", label: "Assinaturas" },
  { key: "alerts", label: "Alertas" },
  { key: "payments", label: "Pagamentos" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date_desc", label: "Data (recentes)" },
  { value: "date_asc", label: "Data (antigos)" },
  { value: "amount_desc", label: "Valor (maior)" },
  { value: "amount_asc", label: "Valor (menor)" },
];

const METHOD_FILTER_OPTIONS: { value: PaymentMethod | "all"; label: string }[] = [
  { value: "all", label: "Todos os métodos" },
  ...(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] })),
];

const PAGE_SIZE = 40;
const ALL_CATEGORIES = "__all__";

export function TransactionsTable({
  transactions,
  title,
  description,
  showMonth = false,
  advancedFilters = false,
  headerAction,
}: {
  transactions: readonly Transaction[];
  title: string;
  description?: string;
  showMonth?: boolean;
  advancedFilters?: boolean;
  headerAction?: ReactNode;
}) {
  const { state, commit, selectedMonth } = useFinance();
  const { openEdit, openDelete, openCreate } = useDialogs();
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(ALL_CATEGORIES);
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "all">("all");
  const [sort, setSort] = useState<SortKey>("date_desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE_SIZE);

  const duplicateIds = useMemo(() => {
    const months = new Set(transactions.map((tx) => tx.invoice_month));
    const ids = new Set<string>();
    for (const month of months) for (const group of duplicateCandidates(state, month)) for (const tx of group) ids.add(tx.id);
    return ids;
  }, [state, transactions]);

  const categoriesById = useMemo(() => new Map(state.categories.map((category) => [category.id, category])), [state.categories]);

  const counts = useMemo(() => {
    const result: Record<QuickFilter, number> = { all: 0, csv: 0, manual: 0, installments: 0, subscriptions: 0, alerts: 0, payments: 0 };
    for (const tx of transactions) for (const filter of QUICK_FILTERS) if (matchesQuick(tx, filter.key, duplicateIds)) result[filter.key] += 1;
    return result;
  }, [transactions, duplicateIds]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = transactions.filter((tx) => {
      if (!matchesQuick(tx, quick, duplicateIds)) return false;
      if (needle && !`${tx.clean_title} ${tx.raw_title} ${tx.notes}`.toLowerCase().includes(needle)) return false;
      if (categoryFilter !== ALL_CATEGORIES && tx.category_id !== categoryFilter) return false;
      if (methodFilter !== "all" && tx.payment_method !== methodFilter) return false;
      return true;
    });
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case "date_asc":
          return a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at);
        case "amount_desc":
          return b.amount - a.amount;
        case "amount_asc":
          return a.amount - b.amount;
        default:
          return b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);
      }
    });
    return sorted;
  }, [transactions, quick, query, categoryFilter, methodFilter, sort, duplicateIds]);

  const visible = filtered.slice(0, limit);
  const selectedIds = Array.from(selected).filter((id) => filtered.some((tx) => tx.id === id));
  const allVisibleSelected = visible.length > 0 && visible.every((tx) => selected.has(tx.id));
  const filteredTotal = sumMoney(filtered.filter((tx) => tx.type === "expense" && !tx.is_ignored).map((tx) => tx.amount));

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function changeCategory(tx: Transaction, categoryId: string | null) {
    commit((current) => updateTransaction(current, tx.id, { category_id: categoryId }));
    const category = categoryId ? categoriesById.get(categoryId) : null;
    const pattern = (extractInstallment(tx.raw_title)?.baseTitle ?? tx.raw_title).trim().toLowerCase();
    const alreadyRuled = state.categorization_rules.some((rule) => rule.pattern.toLowerCase() === pattern);
    toast.success(`Categoria: ${category?.name ?? "Sem categoria"}`, {
      description: tx.clean_title,
      action:
        category && !alreadyRuled && tx.source === "csv"
          ? {
              label: "Salvar regra",
              onClick: () => {
                commit((current) =>
                  upsertRule(current, { pattern, clean_name_override: null, category_id: category.id, priority: 100 }),
                );
                toast.success("Regra criada", { description: `“${pattern}” → ${category.name} nas próximas importações.` });
              },
            }
          : undefined,
    });
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardAction>
          {headerAction ?? (
            <Button size="sm" variant="outline" onClick={() => openCreate({ invoice_month: selectedMonth })}>
              <Plus /> Novo
            </Button>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-3 px-0 pt-3">
        {/* Phones: one swipeable row of chips instead of several wrapped lines. */}
        <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] md:flex-wrap [&::-webkit-scrollbar]:hidden">
          {QUICK_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => {
                setQuick(filter.key);
                setLimit(PAGE_SIZE);
              }}
              aria-pressed={quick === filter.key}
              className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap transition-colors pointer-coarse:h-9",
                quick === filter.key
                  ? "border-nav-active bg-nav-active text-nav-active-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {filter.label}
              <span className="num text-[10.5px] opacity-70">{counts[filter.key]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4">
          <div className="relative basis-full sm:min-w-48 sm:flex-1 sm:basis-auto">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por loja, título ou nota"
              type="search"
              enterKeyHint="search"
              className="h-8 pl-8"
              aria-label="Buscar lançamentos"
            />
          </div>
          {advancedFilters ? (
            <>
              <CategorySelect
                categories={state.categories}
                value={categoryFilter === ALL_CATEGORIES ? null : categoryFilter}
                onChange={(id) => setCategoryFilter(id ?? ALL_CATEGORIES)}
                placeholder="Todas as categorias"
                size="sm"
                className="min-w-0 flex-1 sm:w-44 sm:flex-none"
                ariaLabel="Filtrar por categoria"
              />
              <SimpleSelect
                value={methodFilter}
                options={METHOD_FILTER_OPTIONS}
                onChange={setMethodFilter}
                size="sm"
                className="min-w-0 flex-1 sm:w-40 sm:flex-none"
                ariaLabel="Filtrar por método"
              />
            </>
          ) : null}
          <div className="flex items-center gap-1">
            <ArrowDownUp className="size-3.5 text-muted-foreground" />
            <SimpleSelect value={sort} options={SORT_OPTIONS} onChange={setSort} size="sm" className="w-36" ariaLabel="Ordenação" />
          </div>
        </div>

        {selectedIds.length > 0 ? (
          <div className="mx-4 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-500/30 dark:bg-blue-500/10">
            <span className="font-medium">{selectedIds.length} selecionado(s)</span>
            <span className="text-muted-foreground">•</span>
            <CategorySelect
              categories={state.categories}
              value={null}
              placeholder="Alterar categoria em lote"
              size="sm"
              className="w-52 bg-card"
              onChange={(categoryId) => {
                commit((current) => bulkSetCategory(current, selectedIds, categoryId));
                toast.success(`${selectedIds.length} lançamento(s) recategorizado(s)`);
                setSelected(new Set());
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="bg-card"
              onClick={() => {
                commit((current) => setIgnored(current, selectedIds, true));
                setSelected(new Set());
              }}
            >
              <EyeOff /> Ignorar na soma
            </Button>
            <Button size="sm" variant="destructive" onClick={() => openDelete(selectedIds, () => setSelected(new Set()))}>
              <Trash2 /> Excluir em lote
            </Button>
            <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label="Limpar seleção" onClick={() => setSelected(new Set())}>
              <X />
            </Button>
          </div>
        ) : null}

        <ul className="divide-y border-t md:hidden" aria-label="Lançamentos">
          {visible.map((tx) => (
            <MobileTransactionRow
              key={tx.id}
              tx={tx}
              categoryName={tx.category_id ? categoriesById.get(tx.category_id)?.name : undefined}
              showMonth={showMonth}
              isDuplicate={duplicateIds.has(tx.id)}
              selected={selected.has(tx.id)}
              onSelect={(checked) => toggle(tx.id, checked)}
              onEdit={() => openEdit(tx.id)}
              onDelete={() => openDelete([tx.id])}
            />
          ))}
          {visible.length === 0 ? <EmptyRows /> : null}
        </ul>

        <div className="hidden overflow-x-auto md:block">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Selecionar todos visíveis"
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        for (const tx of visible) {
                          if (checked) next.add(tx.id);
                          else next.delete(tx.id);
                        }
                        return next;
                      })
                    }
                  />
                </TableHead>
                <TableHead className="w-24">Data</TableHead>
                <TableHead>Lançamento</TableHead>
                <TableHead className="w-48">Categoria</TableHead>
                <TableHead className="w-32">Método</TableHead>
                <TableHead className="w-24">Origem</TableHead>
                <TableHead className="w-32 text-right">Valor</TableHead>
                <TableHead className="w-12 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((tx) => (
                <TableRow key={tx.id} data-state={selected.has(tx.id) ? "selected" : undefined} className={cn(tx.is_ignored && "opacity-55")}>
                  <TableCell className="pl-4">
                    <Checkbox aria-label={`Selecionar ${tx.clean_title}`} checked={selected.has(tx.id)} onCheckedChange={(checked) => toggle(tx.id, checked)} />
                  </TableCell>
                  <TableCell className="num text-xs text-muted-foreground">
                    {formatDateBR(tx.date)}
                    {showMonth ? <div className="text-[10.5px]">{formatMonthLabel(tx.invoice_month)}</div> : null}
                  </TableCell>
                  <TableCell>
                    <button type="button" onClick={() => openEdit(tx.id)} className="flex min-w-0 max-w-[340px] flex-col items-start text-left">
                      <span className={cn("truncate font-medium text-foreground hover:underline", tx.is_ignored && "line-through")}>
                        {tx.clean_title}
                      </span>
                      <span className="flex flex-wrap items-center gap-1 pt-0.5">
                        <TransactionPills tx={tx} isDuplicate={duplicateIds.has(tx.id)} />
                        {tx.notes ? <span className="max-w-[200px] truncate text-xs text-muted-foreground">“{tx.notes}”</span> : null}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    {tx.type === "payment" ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <CategorySelect
                        categories={state.categories}
                        value={tx.category_id}
                        onChange={(categoryId) => changeCategory(tx, categoryId)}
                        size="sm"
                        className="w-44 border-transparent shadow-none hover:border-input"
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{PAYMENT_METHOD_LABEL[tx.payment_method]}</TableCell>
                  <TableCell>
                    <SourceBadge tx={tx} />
                  </TableCell>
                  <TableCell className={cn("num text-right font-medium", tx.type !== "expense" && "text-emerald-600")}>
                    <SignedAmount tx={tx} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <RowActions tx={tx} onEdit={() => openEdit(tx.id)} onDelete={() => openDelete([tx.id])} />
                  </TableCell>
                </TableRow>
              ))}
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center">
                    <EmptyMessage />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
          <span>
            {Math.min(limit, filtered.length)} de {filtered.length} lançamento(s) • Despesas filtradas:{" "}
            <span className="num font-medium text-foreground">{formatBRL(filteredTotal)}</span>
          </span>
          {filtered.length > limit ? (
            <Button size="sm" variant="outline" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
              Mostrar mais
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

}

function TransactionPills({ tx, isDuplicate }: { tx: Transaction; isDuplicate: boolean }) {
  return (
    <>
      {tx.installment_total ? (
        <Pill tone="blue">
          Parcela {tx.installment_current}/{tx.installment_total}
        </Pill>
      ) : null}
      {tx.subscription_id ? <Pill tone="violet">Assinatura</Pill> : null}
      {isDuplicate ? <Pill tone="amber">Duplicidade?</Pill> : null}
      {tx.type === "payment" ? <Pill tone="sky">Pagamento</Pill> : null}
      {tx.type === "income" ? <Pill tone="emerald">Receita</Pill> : null}
      {tx.is_ignored ? <Pill tone="slate">Ignorado</Pill> : null}
    </>
  );
}

function SignedAmount({ tx }: { tx: Transaction }) {
  return (
    <>
      {tx.type === "income" ? "+" : ""}
      {formatBRL(tx.amount)}
    </>
  );
}

function EmptyMessage() {
  return (
    <>
      <p className="text-sm font-medium">Nenhum lançamento encontrado</p>
      <p className="text-xs text-muted-foreground">Ajuste os filtros ou crie um novo gasto.</p>
    </>
  );
}

function EmptyRows() {
  return (
    <li className="px-4 py-12 text-center">
      <EmptyMessage />
    </li>
  );
}

/** Phone layout of a transaction: tap to edit, checkbox for bulk actions, menu for the rest. */
function MobileTransactionRow({
  tx,
  categoryName,
  showMonth,
  isDuplicate,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  tx: Transaction;
  categoryName: string | undefined;
  showMonth: boolean;
  isDuplicate: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = [
    formatDateBR(tx.date),
    showMonth ? `Fatura ${formatMonthLabel(tx.invoice_month)}` : null,
    tx.type === "payment" ? null : (categoryName ?? "Sem categoria"),
  ].filter(Boolean);

  return (
    <li className={cn("flex items-start gap-3 py-3 pr-2 pl-4", selected && "bg-blue-50/70 dark:bg-blue-500/10", tx.is_ignored && "opacity-55")}>
      <Checkbox className="mt-1" aria-label={`Selecionar ${tx.clean_title}`} checked={selected} onCheckedChange={onSelect} />
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left transition-opacity active:opacity-60">
        <span className="flex items-baseline justify-between gap-3">
          <span className={cn("truncate text-sm font-medium text-foreground", tx.is_ignored && "line-through")}>{tx.clean_title}</span>
          <span className={cn("num shrink-0 text-sm font-semibold", tx.type !== "expense" && "text-emerald-600")}>
            <SignedAmount tx={tx} />
          </span>
        </span>
        <span className="num mt-0.5 block truncate text-xs text-muted-foreground">{meta.join(" • ")}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1 empty:hidden">
          <TransactionPills tx={tx} isDuplicate={isDuplicate} />
        </span>
      </button>
      <RowActions tx={tx} onEdit={onEdit} onDelete={onDelete} />
    </li>
  );
}

function RowActions({ tx, onEdit, onDelete }: { tx: Transaction; onEdit: () => void; onDelete: () => void }) {
  const { commit } = useFinance();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ações para ${tx.clean_title}`} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            commit((current) => duplicateTransaction(current, tx.id));
            toast.success("Lançamento duplicado como Manual");
          }}
        >
          <Copy /> Duplicar
        </DropdownMenuItem>
        {tx.type === "expense" && !tx.subscription_id ? (
          <DropdownMenuItem
            onClick={() => {
              commit((current) => markAsSubscription(current, tx.id));
              toast.success("Assinatura criada", { description: `${tx.clean_title} entra na projeção mensal.` });
            }}
          >
            <Repeat /> Marcar como Assinatura
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => commit((current) => setIgnored(current, [tx.id], !tx.is_ignored))}>
          {tx.is_ignored ? <Eye /> : <EyeOff />}
          {tx.is_ignored ? "Voltar a somar" : "Ignorar na soma"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function matchesQuick(tx: Transaction, filter: QuickFilter, duplicateIds: ReadonlySet<string>): boolean {
  switch (filter) {
    case "csv":
      return tx.source === "csv";
    case "manual":
      return tx.source === "manual";
    case "installments":
      return tx.installment_total !== null && tx.installment_total > 1;
    case "subscriptions":
      return tx.subscription_id !== null;
    case "alerts":
      return duplicateIds.has(tx.id) || (tx.installment_current !== null && tx.installment_current === tx.installment_total);
    case "payments":
      return tx.type === "payment";
    default:
      return true;
  }
}
