"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { ratioTone } from "@/components/dashboard/category-breakdown";
import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon } from "@/components/common/category-icon";
import { CategorySelect } from "@/components/common/category-select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMonthLabel } from "@/lib/dates";
import { deleteCategory, upsertCategory } from "@/lib/domain/operations";
import type { Category } from "@/lib/domain/types";
import { categoryBreakdown, invoiceTotal, totalBudget } from "@/lib/finance/metrics";
import { formatBRL, formatPercent, parseAmount } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

type Editing = { open: false } | { open: true; category: Category | null };

export function BudgetView() {
  const { state, commit, selectedMonth } = useFinance();
  const [editing, setEditing] = useState<Editing>({ open: false });
  const [removing, setRemoving] = useState<Category | null>(null);
  const [migrateTo, setMigrateTo] = useState<string | null>(null);

  const breakdown = new Map(categoryBreakdown(state, selectedMonth).map((row) => [row.category?.id ?? "none", row]));
  const budget = totalBudget(state.categories);
  const spent = invoiceTotal(state, selectedMonth);
  const usage = budget > 0 ? spent / budget : 0;
  const tone = ratioTone(usage);
  const usedBy = (id: string) => state.transactions.filter((tx) => tx.category_id === id).length;

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border bg-card p-5 shadow-panel">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Teto mensal consolidado • Fatura {formatMonthLabel(selectedMonth)}</p>
            <p className="num pt-1 text-3xl font-semibold">
              {formatBRL(spent)} <span className="text-lg font-normal text-muted-foreground">/ {formatBRL(budget)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className={cn("num text-xl font-semibold", tone.text)}>{formatPercent(usage)}</p>
            <p className="text-xs text-muted-foreground">do orçamento utilizado</p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${Math.min(usage, 1) * 100}%` }} />
        </div>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Categorias ({state.categories.length})</h2>
        <Button size="sm" onClick={() => setEditing({ open: true, category: null })}>
          <Plus /> Nova categoria
        </Button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {state.categories.map((category) => {
          const row = breakdown.get(category.id);
          const ratio = row?.ratio ?? 0;
          const rowTone = ratioTone(ratio);
          return (
            <div key={category.id} className="grid gap-3 rounded-xl border bg-card p-4 shadow-panel">
              <div className="flex items-center gap-2.5">
                <CategoryIcon icon={category.icon} color={category.color} className="inline-flex size-8 items-center justify-center rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{category.name}</p>
                  <p className="text-xs text-muted-foreground">{usedBy(category.id)} lançamento(s)</p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${category.name}`} onClick={() => setEditing({ open: true, category })}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Excluir ${category.name}`}
                  onClick={() => {
                    setMigrateTo(null);
                    setRemoving(category);
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="num font-medium">{formatBRL(row?.spent ?? 0)}</span>
                <span className="num text-xs text-muted-foreground">teto {formatBRL(category.monthly_limit)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", rowTone.bar)} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
              </div>
              <p className={cn("num text-xs font-medium", rowTone.text)}>
                {category.monthly_limit > 0 ? `${formatPercent(ratio)} utilizado` : "Sem teto definido"}
              </p>
            </div>
          );
        })}
      </section>

      <Dialog open={editing.open} onOpenChange={(open) => !open && setEditing({ open: false })}>
        <DialogContent className="sm:max-w-md">
          {editing.open ? (
            <CategoryForm key={editing.category?.id ?? "new"} category={editing.category} onDone={() => setEditing({ open: false })} />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a categoria “{removing?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing ? usedBy(removing.id) : 0} lançamento(s), regras e assinaturas usam esta categoria. Escolha para onde migrá-los.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <CategorySelect
            categories={state.categories.filter((category) => category.id !== removing?.id)}
            value={migrateTo}
            onChange={setMigrateTo}
            placeholder="Deixar sem categoria"
            className="w-full"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (removing) commit((current) => deleteCategory(current, removing.id, migrateTo));
                toast.success("Categoria excluída");
                setRemoving(null);
              }}
            >
              Excluir e migrar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryForm({ category, onDone }: { category: Category | null; onDone: () => void }) {
  const { state, commit } = useFinance();
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(category?.icon ?? "tag");
  const [limit, setLimit] = useState(category ? category.monthly_limit.toFixed(2).replace(".", ",") : "");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = limit.trim() === "" ? 0 : parseAmount(limit);
    if (!name.trim()) return setError("Informe o nome.");
    const duplicate = state.categories.some((item) => item.id !== category?.id && item.name.toLowerCase() === name.trim().toLowerCase());
    if (duplicate) return setError("Já existe uma categoria com esse nome.");
    if (value === null || value < 0) return setError("Teto inválido.");
    commit((current) => upsertCategory(current, { id: category?.id, name: name.trim(), color, icon, monthly_limit: value }));
    toast.success(category ? "Categoria atualizada" : "Categoria criada");
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{category ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        <DialogDescription>Defina cor, ícone e o teto mensal usado nos alertas de orçamento.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-[1fr_9rem] gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cat-name">Nome</Label>
          <Input id="cat-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cat-limit">Teto mensal (R$)</Label>
          <Input id="cat-limit" inputMode="decimal" className="num" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="0,00" />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Cor</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`Cor ${option}`}
              aria-pressed={color === option}
              onClick={() => setColor(option)}
              className={cn("size-7 rounded-full ring-offset-2 ring-offset-background transition", color === option && "ring-2 ring-foreground")}
              style={{ backgroundColor: option }}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Ícone</Label>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(CATEGORY_ICONS).map((key) => (
            <button
              key={key}
              type="button"
              aria-label={`Ícone ${key}`}
              aria-pressed={icon === key}
              onClick={() => setIcon(key)}
              className={cn("rounded-lg p-0.5 transition", icon === key ? "ring-2 ring-blue-500" : "hover:bg-muted")}
            >
              <CategoryIcon icon={key} color={color} className="inline-flex size-7 items-center justify-center rounded-md" />
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </DialogFooter>
    </form>
  );
}
