"use client";

import {
  ArrowDownUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useDeferredValue, useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { usePrivacy } from "@/components/app/privacy-provider";
import { CategoryIcon } from "@/components/common/category-icon";
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
  autoCategorizeUncategorized,
  bulkAddTag,
  bulkSetCategory,
  bulkUpdateTransactions,
  duplicateTransaction,
  markAsSubscription,
  setIgnored,
  updateTransaction,
  upsertRule,
} from "@/lib/domain/operations";
import { PAYMENT_METHOD_LABEL, PET_EXPENSE_KIND_LABEL, type Category, type PaymentMethod, type Pet, type Transaction } from "@/lib/domain/types";
import { cardLabel } from "@/lib/import/issuers";
import { duplicateCandidates, netExpenseAmount, transactionsToCsv } from "@/lib/finance/metrics";
import { formatBRL, parseAmount, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";
import { useIsDesktop } from "@/lib/use-media-query";

export type QuickFilter =
  | "all"
  | "uncategorized"
  | "csv"
  | "manual"
  | "installments"
  | "subscriptions"
  | "alerts"
  | "payments"
  | "ignored";

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "uncategorized", label: "Sem categoria" },
  { key: "csv", label: "Importados" },
  { key: "manual", label: "Manuais" },
  { key: "installments", label: "Parcelados" },
  { key: "subscriptions", label: "Assinaturas" },
  { key: "alerts", label: "Alertas" },
  { key: "payments", label: "Pagamentos" },
  { key: "ignored", label: "Ignorados" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date_desc", label: "Data (recentes)" },
  { value: "date_asc", label: "Data (antigos)" },
  { value: "amount_desc", label: "Valor (maior)" },
  { value: "amount_asc", label: "Valor (menor)" },
];

type MethodFilter = PaymentMethod | "all" | `card:${string}`;

const METHOD_FILTER_OPTIONS: { value: MethodFilter; label: string }[] = [
  { value: "all", label: "Todos os métodos" },
  ...(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] })),
];

const PAGE_SIZE = 25;
const ALL_CATEGORIES = "__all__";
const ALL_TAGS = "__all_tags__";

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
  const { mask } = usePrivacy();
  const isDesktop = useIsDesktop();
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(ALL_CATEGORIES);
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [tagFilter, setTagFilter] = useState<string>(ALL_TAGS);
  const [minAmountText, setMinAmountText] = useState("");
  const [maxAmountText, setMaxAmountText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortKey>("date_desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMonth, setBulkMonth] = useState("");
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeAdvancedCount = [
    categoryFilter !== ALL_CATEGORIES,
    methodFilter !== "all",
    tagFilter !== ALL_TAGS,
    Boolean(minAmountText),
    Boolean(maxAmountText),
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  const duplicateIds = useMemo(() => {
    const months = new Set(transactions.map((tx) => tx.invoice_month));
    const ids = new Set<string>();
    for (const month of months) for (const group of duplicateCandidates(state, month)) for (const tx of group) ids.add(tx.id);
    return ids;
  }, [state, transactions]);

  const categoriesById = useMemo(() => new Map(state.categories.map((category) => [category.id, category])), [state.categories]);
  const cardsById = useMemo(() => new Map(state.cards.map((card) => [card.id, card])), [state.cards]);
  const accountsById = useMemo(() => new Map((state.accounts ?? []).map((acc) => [acc.id, acc])), [state.accounts]);
  const petsById = useMemo(() => new Map((state.pets ?? []).map((pet) => [pet.id, pet])), [state.pets]);
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const tx of transactions) for (const tag of tx.tags ?? []) tags.add(tag);
    return Array.from(tags).sort();
  }, [transactions]);

  const tagOptions = useMemo(
    () => [{ value: ALL_TAGS, label: "Todas as tags" }, ...allTags.map((tag) => ({ value: tag, label: `#${tag}` }))],
    [allTags],
  );

  const methodOptions = useMemo(
    () => [
      ...METHOD_FILTER_OPTIONS,
      ...state.cards.map((card) => ({ value: `card:${card.id}` as MethodFilter, label: cardLabel(card) })),
    ],
    [state.cards],
  );
  const methodLabel = (tx: Transaction) => {
    const card = tx.card_id ? cardsById.get(tx.card_id) : undefined;
    if (card) return cardLabel(card);
    const acc = tx.account_id ? accountsById.get(tx.account_id) : undefined;
    if (acc) return acc.name;
    return PAYMENT_METHOD_LABEL[tx.payment_method];
  };

  const counts = useMemo(() => {
    const result: Record<QuickFilter, number> = {
      all: 0,
      uncategorized: 0,
      csv: 0,
      manual: 0,
      installments: 0,
      subscriptions: 0,
      alerts: 0,
      payments: 0,
      ignored: 0,
    };
    for (const tx of transactions) for (const filter of QUICK_FILTERS) if (matchesQuick(tx, filter.key, duplicateIds)) result[filter.key] += 1;
    return result;
  }, [transactions, duplicateIds]);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const minVal = minAmountText.trim() ? parseAmount(minAmountText) : null;
    const maxVal = maxAmountText.trim() ? parseAmount(maxAmountText) : null;

    const rows = transactions.filter((tx) => {
      if (!matchesQuick(tx, quick, duplicateIds)) return false;
      if (needle) {
        const tagString = (tx.tags ?? []).map((t) => `#${t}`).join(" ");
        const itemsString = (tx.line_items ?? []).map((i) => i.name).join(" ");
        const petString = tx.pet_id ? (petsById.get(tx.pet_id)?.name ?? "") : "";
        if (!`${tx.clean_title} ${tx.raw_title} ${tx.notes} ${tagString} ${itemsString} ${petString}`.toLowerCase().includes(needle)) return false;
      }
      if (categoryFilter !== ALL_CATEGORIES && tx.category_id !== categoryFilter) return false;
      if (tagFilter !== ALL_TAGS && !(tx.tags ?? []).includes(tagFilter)) return false;
      if (methodFilter.startsWith("card:")) {
        if (tx.card_id !== methodFilter.slice(5)) return false;
      } else if (methodFilter !== "all" && tx.payment_method !== methodFilter) return false;
      if (minVal !== null && Math.abs(tx.amount) < minVal) return false;
      if (maxVal !== null && Math.abs(tx.amount) > maxVal) return false;
      if (dateFrom && tx.date < dateFrom) return false;
      if (dateTo && tx.date > dateTo) return false;
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
  }, [transactions, quick, deferredQuery, categoryFilter, tagFilter, methodFilter, minAmountText, maxAmountText, dateFrom, dateTo, sort, duplicateIds, petsById]);

  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);
  const filteredIdSet = useMemo(() => new Set(filtered.map((tx) => tx.id)), [filtered]);
  const selectedIds = useMemo(() => Array.from(selected).filter((id) => filteredIdSet.has(id)), [selected, filteredIdSet]);
  const allVisibleSelected = visible.length > 0 && visible.every((tx) => selected.has(tx.id));
  const filteredTotal = useMemo(
    () => sumMoney(filtered.filter((tx) => tx.type === "expense" && !tx.is_ignored).map((tx) => netExpenseAmount(state, tx))),
    [filtered, state],
  );

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function exportFilteredCsv() {
    if (filtered.length === 0) return toast.error("Nenhum lançamento para exportar");
    const csv = transactionsToCsv(filtered, state);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arrumabolso-lancamentos-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} lançamento(s) exportado(s) em CSV`);
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
    <Card className="gap-0 overflow-hidden rounded-2xl py-0 md:rounded-xl">
      <CardHeader className="flex flex-col gap-2.5 border-b py-4 sm:grid">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardAction className="flex items-center gap-2">
          {counts.uncategorized > 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                let categorized = 0;
                let created: string[] = [];
                commit((current) => {
                  const res = autoCategorizeUncategorized(current);
                  categorized = res.categorized;
                  created = res.createdCategories;
                  return res.state;
                });
                if (categorized === 0) {
                  toast("Nenhuma correspondência automática encontrada", {
                    description: "Categorize manualmente uma vez e o app passa a aprender nas próximas importações.",
                  });
                } else {
                  toast.success(`${categorized} lançamento(s) categorizado(s) automaticamente`, {
                    description: created.length > 0 ? `Categorias criadas: ${created.join(", ")}.` : undefined,
                  });
                }
              }}
            >
              <Sparkles className="size-3.5 text-blue-600" />
              <span className="hidden sm:inline">Auto-categorizar ({counts.uncategorized})</span>
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={exportFilteredCsv} title="Exportar tabela filtrada em CSV">
            <Download /> <span className="hidden sm:inline">CSV</span>
          </Button>
          {headerAction ?? (
            <Button size="sm" variant="outline" onClick={() => openCreate({ invoice_month: selectedMonth })}>
              <Plus /> Novo
            </Button>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-3 px-0 pt-3">
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
          <div className="relative min-w-0 flex-1 sm:min-w-48">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar loja, item, #tag..."
              type="search"
              enterKeyHint="search"
              className="h-9 rounded-xl pl-8 md:h-8 md:rounded-md"
              aria-label="Buscar lançamentos"
            />
          </div>
          {advancedFilters ? (
            <Button
              type="button"
              size="sm"
              variant={mobileFiltersOpen || activeAdvancedCount > 0 ? "default" : "outline"}
              className="h-9 shrink-0 rounded-xl px-3 md:hidden"
              onClick={() => setMobileFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal className="size-3.5" />
              <span>Filtros</span>
              {activeAdvancedCount > 0 ? <span className="num rounded-full bg-white/20 px-1.5 text-[10px]">{activeAdvancedCount}</span> : null}
            </Button>
          ) : null}
          {advancedFilters ? (
            <div className={cn("w-full flex-wrap items-center gap-2 md:flex md:w-auto", mobileFiltersOpen ? "flex" : "hidden")}>
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
                options={methodOptions}
                onChange={setMethodFilter}
                size="sm"
                className="min-w-0 flex-1 sm:w-40 sm:flex-none"
                ariaLabel="Filtrar por método"
              />
              {allTags.length > 0 ? (
                <SimpleSelect
                  value={tagFilter}
                  options={tagOptions}
                  onChange={setTagFilter}
                  size="sm"
                  className="min-w-0 flex-1 sm:w-36 sm:flex-none"
                  ariaLabel="Filtrar por tag"
                />
              ) : null}
            </div>
          ) : null}
          <div className={cn("items-center gap-1 md:flex", mobileFiltersOpen || !advancedFilters ? "flex" : "hidden")}>
            <ArrowDownUp className="size-3.5 text-muted-foreground" />
            <SimpleSelect value={sort} options={SORT_OPTIONS} onChange={setSort} size="sm" className="w-36" ariaLabel="Ordenação" />
          </div>
        </div>

        {advancedFilters ? (
          <div className={cn("flex-wrap items-center gap-2 px-4 text-xs md:flex", mobileFiltersOpen ? "flex" : "hidden")}>
            <Input
              value={minAmountText}
              onChange={(event) => setMinAmountText(event.target.value)}
              placeholder="Valor mín. (R$)"
              inputMode="decimal"
              className="num h-8 w-32"
              aria-label="Valor mínimo"
            />
            <Input
              value={maxAmountText}
              onChange={(event) => setMaxAmountText(event.target.value)}
              placeholder="Valor máx. (R$)"
              inputMode="decimal"
              className="num h-8 w-32"
              aria-label="Valor máximo"
            />
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-8 w-36"
              aria-label="Data inicial"
            />
            <span className="text-muted-foreground">até</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-8 w-36"
              aria-label="Data final"
            />
            {minAmountText || maxAmountText || dateFrom || dateTo || tagFilter !== ALL_TAGS ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => {
                  setMinAmountText("");
                  setMaxAmountText("");
                  setDateFrom("");
                  setDateTo("");
                  setTagFilter(ALL_TAGS);
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>
        ) : null}

        {selectedIds.length > 0 ? (
          <div className="mx-4 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-500/30 dark:bg-blue-500/10">
            <span className="font-medium">{selectedIds.length} selecionado(s)</span>
            <span className="text-muted-foreground">•</span>
            <CategorySelect
              categories={state.categories}
              value={null}
              placeholder="Categoria em lote"
              size="sm"
              className="w-44 bg-card"
              onChange={(categoryId) => {
                commit((current) => bulkSetCategory(current, selectedIds, categoryId));
                toast.success(`${selectedIds.length} lançamento(s) recategorizado(s)`);
                setSelected(new Set());
              }}
            />
            {state.cards.length > 0 ? (
              <SimpleSelect
                value="__pick__"
                options={[
                  { value: "__pick__", label: "Trocar cartão em lote" },
                  { value: "__none__", label: "Desvincular cartão" },
                  ...state.cards
                    .filter((card) => !card.is_archived)
                    .map((card) => ({ value: card.id, label: cardLabel(card) })),
                ]}
                onChange={(value) => {
                  if (value === "__pick__") return;
                  const nextCardId = value === "__none__" ? null : value;
                  commit((current) =>
                    bulkUpdateTransactions(current, selectedIds, {
                      ...(nextCardId ? { payment_method: "credit_card" as const } : {}),
                      card_id: nextCardId,
                    }),
                  );
                  toast.success(`Cartão atualizado em ${selectedIds.length} lançamento(s)`);
                  setSelected(new Set());
                }}
                size="sm"
                className="w-44 bg-card"
                ariaLabel="Trocar cartão em lote"
              />
            ) : null}
            <div className="flex items-center gap-1">
              <Input
                type="month"
                value={bulkMonth}
                onChange={(event) => setBulkMonth(event.target.value)}
                className="h-8 w-36 bg-card text-xs"
                aria-label="Competência em lote"
              />
              {bulkMonth ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 bg-card"
                  onClick={() => {
                    commit((current) => bulkUpdateTransactions(current, selectedIds, { invoice_month: bulkMonth }));
                    toast.success(`Competência alterada para ${formatMonthLabel(bulkMonth)}`);
                    setBulkMonth("");
                    setSelected(new Set());
                  }}
                >
                  Mover mês
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <Input
                value={bulkTagInput}
                onChange={(event) => setBulkTagInput(event.target.value)}
                placeholder="#tag"
                className="h-8 w-24 bg-card text-xs"
                aria-label="Adicionar tag em lote"
              />
              {bulkTagInput.trim() ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 bg-card"
                  onClick={() => {
                    commit((current) => bulkAddTag(current, selectedIds, bulkTagInput));
                    toast.success(`Tag #${bulkTagInput.trim().replace(/^#/, "")} aplicada`);
                    setBulkTagInput("");
                    setSelected(new Set());
                  }}
                >
                  <Tag className="size-3.5" /> Aplicar
                </Button>
              ) : null}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="bg-card"
              onClick={() => {
                const ids = [...selectedIds];
                commit((current) => setIgnored(current, ids, true));
                toast("Lançamentos ignorados", {
                  action: { label: "Desfazer", onClick: () => commit((current) => setIgnored(current, ids, false)) },
                });
                setSelected(new Set());
              }}
            >
              <EyeOff /> Ignorar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-card"
              onClick={() => {
                commit((current) => setIgnored(current, selectedIds, false));
                toast.success("Lançamentos restaurados na soma");
                setSelected(new Set());
              }}
            >
              <Eye /> Restaurar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => openDelete(selectedIds, () => setSelected(new Set()))}>
              <Trash2 /> Excluir
            </Button>
            <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label="Limpar seleção" onClick={() => setSelected(new Set())}>
              <X />
            </Button>
          </div>
        ) : null}

        {!isDesktop ? (
          <ul className="grid gap-2.5 bg-background/60 px-3 py-3" aria-label="Lançamentos">
            {visible.map((tx) => (
              <MobileTransactionRow
                key={tx.id}
                tx={tx}
                category={tx.category_id ? categoriesById.get(tx.category_id) : undefined}
                pet={tx.pet_id ? petsById.get(tx.pet_id) : undefined}
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
        ) : (
          <div className="overflow-x-auto">
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
                        <TransactionPills tx={tx} isDuplicate={duplicateIds.has(tx.id)} pet={tx.pet_id ? petsById.get(tx.pet_id) : undefined} />
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
                  <TableCell className="text-xs text-muted-foreground">
                    {methodLabel(tx)}
                  </TableCell>
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
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
          <span>
            {Math.min(limit, filtered.length)} de {filtered.length} lançamento(s) • Despesas líquidas filtradas:{" "}
            <span className="num font-medium text-foreground">{mask(formatBRL(filteredTotal))}</span>
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

function TransactionPills({ tx, isDuplicate, pet }: { tx: Transaction; isDuplicate: boolean; pet?: Pet }) {
  return (
    <>
      {pet ? (
        <Pill tone="amber">
          🐾 {pet.name}
          {tx.pet_expense_kind ? ` • ${PET_EXPENSE_KIND_LABEL[tx.pet_expense_kind].split(" ")[0]}` : ""}
        </Pill>
      ) : null}
      {tx.installment_total ? (
        <Pill tone="blue">
          Parcela {tx.installment_current}/{tx.installment_total}
        </Pill>
      ) : null}
      {tx.subscription_id ? <Pill tone="violet">Assinatura</Pill> : null}
      {tx.split_group_id ? <Pill tone="slate">Dividido</Pill> : null}
      {tx.refund_of_transaction_id ? <Pill tone="emerald">Reembolso</Pill> : null}
      {tx.original_currency && tx.original_amount ? (
        <Pill tone="sky">
          {tx.original_currency} {tx.original_amount.toFixed(2)}
          {tx.iof_amount ? ` • IOF ${formatBRL(tx.iof_amount)}` : ""}
        </Pill>
      ) : null}
      {tx.transfer_account_id ? <Pill tone="blue">Transferência</Pill> : null}
      {tx.receipt_path ? <Pill tone="emerald">Recibo</Pill> : null}
      {(tx.line_items?.length ?? 0) > 0 ? (
        <Pill tone="slate">
          {tx.line_items!.length} {tx.line_items!.length === 1 ? "item" : "itens"}
        </Pill>
      ) : null}
      {isDuplicate ? <Pill tone="amber">Duplicidade?</Pill> : null}
      {tx.type === "payment" && !tx.transfer_account_id ? <Pill tone="sky">Pagamento</Pill> : null}
      {tx.type === "income" && !tx.refund_of_transaction_id ? <Pill tone="emerald">Receita</Pill> : null}
      {tx.is_ignored ? <Pill tone="slate">Ignorado</Pill> : null}
      {(tx.tags ?? []).map((tag) => (
        <span key={tag} className="rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">
          #{tag}
        </span>
      ))}
    </>
  );
}

function SignedAmount({ tx }: { tx: Transaction }) {
  const { mask } = usePrivacy();
  const formatted = `${tx.type === "income" ? "+" : ""}${formatBRL(tx.amount)}`;
  return <>{mask(formatted)}</>;
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

function MobileTransactionRow({
  tx,
  category,
  pet,
  showMonth,
  isDuplicate,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  tx: Transaction;
  category?: Category;
  pet?: Pet;
  showMonth: boolean;
  isDuplicate: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { commit } = useFinance();
  const [offsetX, setOffsetX] = useState(0);
  const touchStart = useRef<{ x: number; y: number; base: number; locked: "h" | "v" | null } | null>(null);
  const isIncome = tx.type === "income";
  const meta = [
    formatDateBR(tx.date),
    showMonth ? formatMonthLabel(tx.invoice_month) : null,
  ].filter(Boolean);

  function handleTouchStart(event: TouchEvent) {
    const t = event.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY, base: offsetX, locked: null };
  }

  function handleTouchMove(event: TouchEvent) {
    const start = touchStart.current;
    const t = event.touches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (!start.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      start.locked = Math.abs(dx) > Math.abs(dy) * 1.2 ? "h" : "v";
    }
    if (start.locked !== "h") return;
    const next = Math.max(-124, Math.min(82, start.base + dx));
    setOffsetX(next);
  }

  function handleTouchEnd() {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || start.locked !== "h") return;
    if (offsetX <= -54) setOffsetX(-120);
    else if (offsetX >= 42) setOffsetX(76);
    else setOffsetX(0);
  }

  return (
    <li className="relative overflow-hidden rounded-[18px]">
      {/* Right-swipe revealed action: Edit */}
      <div
        aria-hidden={offsetX <= 0}
        className="absolute inset-y-0 left-0 flex w-20 items-stretch bg-brand text-white"
      >
        <button
          type="button"
          onClick={() => {
            setOffsetX(0);
            onEdit();
          }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold"
        >
          <Pencil className="size-4" />
          Editar
        </button>
      </div>

      {/* Left-swipe revealed actions: Ignore & Delete */}
      <div
        aria-hidden={offsetX >= 0}
        className="absolute inset-y-0 right-0 flex w-[120px] items-stretch text-white"
      >
        <button
          type="button"
          onClick={() => {
            setOffsetX(0);
            commit((current) => setIgnored(current, [tx.id], !tx.is_ignored));
            toast(tx.is_ignored ? "Restaurado na soma" : "Lançamento ignorado");
          }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-slate-600 text-[10.5px] font-semibold"
        >
          {tx.is_ignored ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          {tx.is_ignored ? "Mostrar" : "Ignorar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOffsetX(0);
            onDelete();
          }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-rose-600 text-[10.5px] font-semibold"
        >
          <Trash2 className="size-4" />
          Excluir
        </button>
      </div>

      {/* Swipeable Foreground Card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${offsetX}px)` }}
        className={cn(
          "fintech-mobile-card relative flex items-center gap-2.5 border border-border/60 py-3 pr-1.5 pl-3 transition-transform duration-150",
          selected && "border-brand/60 bg-blue-50/70 dark:bg-blue-500/10",
          tx.is_ignored && "opacity-60",
        )}
      >
        <Checkbox aria-label={`Selecionar ${tx.clean_title}`} checked={selected} onCheckedChange={onSelect} />
        <button
          type="button"
          onClick={() => {
            if (offsetX !== 0) {
              setOffsetX(0);
              return;
            }
            onEdit();
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity active:opacity-70"
        >
          <CategoryIcon
            icon={category?.icon ?? (isIncome ? "trending-up" : "tag")}
            color={category?.color ?? (isIncome ? "#10B981" : "#4070F4")}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className={cn("truncate text-sm font-semibold text-foreground", tx.is_ignored && "line-through")}>{tx.clean_title}</span>
              <span className={cn("num shrink-0 text-sm font-bold", tx.type !== "expense" && "text-emerald-600")}>
                <SignedAmount tx={tx} />
              </span>
            </span>
            <span className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span className="num truncate">{meta.join(" • ")}</span>
              <span className="max-w-[110px] truncate text-[11px]">
                {tx.type === "payment" ? "Pagamento" : (category?.name ?? "Sem categoria")}
              </span>
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1 empty:hidden">
              <TransactionPills tx={tx} isDuplicate={isDuplicate} pet={pet} />
            </span>
          </span>
        </button>
        <RowActions tx={tx} onEdit={onEdit} onDelete={onDelete} />
      </div>
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
          <Pencil /> Editar / Dividir
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
        <DropdownMenuItem
          onClick={() => {
            const nextIgnored = !tx.is_ignored;
            commit((current) => setIgnored(current, [tx.id], nextIgnored));
            toast(nextIgnored ? "Lançamento ignorado" : "Lançamento restaurado", {
              action: {
                label: "Desfazer",
                onClick: () => commit((current) => setIgnored(current, [tx.id], !nextIgnored)),
              },
            });
          }}
        >
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
    case "uncategorized":
      return tx.type === "expense" && !tx.is_ignored && !tx.category_id;
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
    case "ignored":
      return tx.is_ignored;
    default:
      return true;
  }
}
