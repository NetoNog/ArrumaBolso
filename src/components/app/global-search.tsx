"use client";

import { Moon, Plus, Settings, Sun, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useDialogs } from "@/components/app/dialogs-provider";
import { NAV_GROUPS, SETTINGS_ITEM } from "@/components/app/navigation";
import { SourceBadge } from "@/components/common/source-badge";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { formatDateBR, formatMonthLabel } from "@/lib/dates";
import { updateSettings } from "@/lib/domain/operations";
import { cardLabel } from "@/lib/import/issuers";
import { formatBRL } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

const MAX_RESULTS = 40;

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { state, commit, selectedMonth } = useFinance();
  const { openEdit, openCreate, openImport } = useDialogs();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const categoriesById = useMemo(() => new Map(state.categories.map((cat) => [cat.id, cat.name])), [state.categories]);
  const cardsById = useMemo(() => new Map(state.cards.map((card) => [card.id, cardLabel(card)])), [state.cards]);

  const sortedTransactions = useMemo(
    () => [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [state.transactions],
  );

  const matchedTransactions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sortedTransactions.slice(0, MAX_RESULTS);
    const matches = [];
    for (const tx of sortedTransactions) {
      const category = tx.category_id ? (categoriesById.get(tx.category_id) ?? "") : "";
      const card = tx.card_id ? (cardsById.get(tx.card_id) ?? "") : "";
      const tags = (tx.tags ?? []).map((t) => `#${t}`).join(" ");
      const itemNames = (tx.line_items ?? []).map((item) => item.name).join(" ");
      const amountText = `${tx.amount.toFixed(2)} ${tx.amount.toFixed(2).replace(".", ",")} ${formatBRL(tx.amount)}`;
      const haystack = `${tx.clean_title} ${tx.raw_title} ${tx.notes} ${itemNames} ${category} ${card} ${tags} ${amountText} ${formatMonthLabel(tx.invoice_month)}`.toLowerCase();
      if (haystack.includes(needle)) {
        matches.push(tx);
        if (matches.length >= MAX_RESULTS) break;
      }
    }
    return matches;
  }, [sortedTransactions, search, categoriesById, cardsById]);

  const isDark = state.settings.theme === "dark";

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch("");
        onOpenChange(next);
      }}
      title="Busca global"
      description="Buscar lançamento, valor, tag, cartão ou ação rápida"
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder="Buscar em todo o histórico (loja, valor, #tag, cartão) ou ação..."
        />
        <CommandList className="max-h-96">
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

          <CommandGroup heading="Ações rápidas">
            <CommandItem
              value="acao novo lancamento gasto despesa"
              onSelect={() => {
                onOpenChange(false);
                openCreate({ invoice_month: selectedMonth });
              }}
            >
              <Plus /> Novo lançamento em {formatMonthLabel(selectedMonth)}
            </CommandItem>
            <CommandItem
              value="acao importar fatura extrato csv ofx"
              onSelect={() => {
                onOpenChange(false);
                openImport();
              }}
            >
              <Upload /> Importar fatura ou extrato (CSV/OFX)
            </CommandItem>
            <CommandItem
              value="acao alternar tema claro escuro dark light"
              onSelect={() => {
                onOpenChange(false);
                commit((current) => updateSettings(current, { theme: isDark ? "light" : "dark" }));
              }}
            >
              {isDark ? <Sun /> : <Moon />} Alternar para tema {isDark ? "claro" : "escuro"}
            </CommandItem>
          </CommandGroup>

          {matchedTransactions.length > 0 ? (
            <CommandGroup
              heading={
                search.trim()
                  ? `Lançamentos (${matchedTransactions.length}${matchedTransactions.length === MAX_RESULTS ? "+" : ""})`
                  : "Lançamentos recentes"
              }
            >
              {matchedTransactions.map((tx) => (
                <CommandItem
                  key={tx.id}
                  value={tx.id}
                  onSelect={() => {
                    onOpenChange(false);
                    openEdit(tx.id);
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate font-medium">{tx.clean_title}</span>
                    <SourceBadge tx={tx} />
                    {(tx.tags ?? []).slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <span className="num text-xs text-muted-foreground">
                    {formatDateBR(tx.date)} • {formatMonthLabel(tx.invoice_month)}
                  </span>
                  <span className="num w-24 text-right text-sm">{formatBRL(tx.amount)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          <CommandGroup heading="Páginas">
            {[...NAV_GROUPS.flatMap((group) => group.items), SETTINGS_ITEM]
              .filter((item) => !search.trim() || `${item.label} ${item.title}`.toLowerCase().includes(search.trim().toLowerCase()))
              .map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.href}
                  onSelect={() => {
                    onOpenChange(false);
                    router.push(item.href);
                  }}
                >
                  {item.href === SETTINGS_ITEM.href ? <Settings /> : <item.icon />}
                  {item.label}
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
