"use client";

import { Check, LayoutGrid, Pencil, PiggyBank, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { ratioTone } from "@/components/dashboard/category-breakdown";
import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon } from "@/components/common/category-icon";
import { CategorySelect, orderCategoriesHierarchy } from "@/components/common/category-select";
import { Pill } from "@/components/common/pill";
import { SimpleSelect } from "@/components/common/simple-select";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateBR, formatMonthLabel } from "@/lib/dates";
import {
  addPresetCategories,
  contributeSavingsGoal,
  deleteCategory,
  deleteSavingsGoal,
  upsertCategory,
  upsertSavingsGoal,
} from "@/lib/domain/operations";
import { CATEGORY_NATURE_LABEL, type Category, type CategoryNature, type SavingsGoal } from "@/lib/domain/types";
import { CATEGORY_PRESETS, defaultNatureForPreset, findCategoryForPreset, type PresetKey } from "@/lib/import/merchant-categories";
import {
  categoryBreakdown,
  expensesOfMonth,
  invoiceTotal,
  nature503020Breakdown,
  netExpenseAmount,
  suggestedCategoryLimits,
  totalBudget,
} from "@/lib/finance/metrics";
import { formatBRL, formatPercent, parseAmount, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

type Editing = { open: false } | { open: true; category: Category | null };
type EditingGoal = { open: false } | { open: true; goal: SavingsGoal | null };

export function BudgetView() {
  const { state, commit, selectedMonth } = useFinance();
  const { openEdit } = useDialogs();
  const [editing, setEditing] = useState<Editing>({ open: false });
  const [removing, setRemoving] = useState<Category | null>(null);
  const [migrateTo, setMigrateTo] = useState<string | null>(null);
  const [drilldownCategory, setDrilldownCategory] = useState<Category | null>(null);
  const [editingGoal, setEditingGoal] = useState<EditingGoal>({ open: false });
  const [contributingGoal, setContributingGoal] = useState<SavingsGoal | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const breakdown = new Map(categoryBreakdown(state, selectedMonth).map((row) => [row.category?.id ?? "none", row]));
  const categoriesById = new Map(state.categories.map((cat) => [cat.id, cat]));
  const orderedCategories = orderCategoriesHierarchy(state.categories);
  const nature503020 = nature503020Breakdown(state, selectedMonth);
  const budget = totalBudget(state.categories);
  const spent = invoiceTotal(state, selectedMonth);
  const usage = budget > 0 ? spent / budget : 0;
  const tone = ratioTone(usage);
  const usedBy = (id: string) => state.transactions.filter((tx) => tx.category_id === id).length;
  const goals = state.savings_goals ?? [];
  const totalSaved = sumMoney(goals.map((g) => g.current_amount));
  const totalGoalTarget = sumMoney(goals.map((g) => g.target_amount));

  const drilldownItems = drilldownCategory
    ? expensesOfMonth(state, selectedMonth)
        .filter((tx) => tx.category_id === drilldownCategory.id)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  function applySuggestedLimits() {
    const suggestions = suggestedCategoryLimits(state, selectedMonth);
    if (suggestions.size === 0) {
      toast("Sem histórico suficiente", { description: "Importe ou registre gastos para gerar sugestões automáticas." });
      return;
    }
    commit((current) => {
      let next = current;
      for (const [id, limit] of suggestions) {
        const cat = next.categories.find((c) => c.id === id);
        if (cat) next = upsertCategory(next, { ...cat, monthly_limit: limit });
      }
      return next;
    });
    toast.success(`Tetos sugeridos aplicados a ${suggestions.size} categoria(s)`, {
      description: "Baseado na média dos últimos 3 meses (arredondado para cima).",
    });
  }

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

      {/* Regra 50 / 30 / 20 */}
      <section className="rounded-xl border bg-card p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Equilíbrio 50 / 30 / 20 • {formatMonthLabel(selectedMonth)}</h2>
            <p className="text-xs text-muted-foreground">
              Referência saudável: até 50% Essenciais, 30% Estilo de Vida e 20% Patrimônio/Metas.
            </p>
          </div>
          {nature503020.uncategorized > 0 ? (
            <Pill tone="amber">Sem categoria: {formatBRL(nature503020.uncategorized)}</Pill>
          ) : null}
        </div>
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-muted">
          {nature503020.total > 0 ? (
            <>
              <div className="bg-blue-600" style={{ width: `${nature503020.ratios.essential * 100}%` }} title={`Essenciais: ${formatBRL(nature503020.essential)}`} />
              <div className="bg-violet-500" style={{ width: `${nature503020.ratios.lifestyle * 100}%` }} title={`Estilo de Vida: ${formatBRL(nature503020.lifestyle)}`} />
              <div className="bg-emerald-500" style={{ width: `${nature503020.ratios.financial * 100}%` }} title={`Patrimônio: ${formatBRL(nature503020.financial)}`} />
            </>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(
            [
              { key: "essential", label: "Essenciais", target: 0.5, amount: nature503020.essential, ratio: nature503020.ratios.essential, dot: "bg-blue-600", overIsBad: true },
              { key: "lifestyle", label: "Estilo de Vida", target: 0.3, amount: nature503020.lifestyle, ratio: nature503020.ratios.lifestyle, dot: "bg-violet-500", overIsBad: true },
              { key: "financial", label: "Patrimônio / Metas", target: 0.2, amount: nature503020.financial, ratio: nature503020.ratios.financial, dot: "bg-emerald-500", overIsBad: false },
            ] as const
          ).map((bucket) => {
            const alert = nature503020.total > 0 && (bucket.overIsBad ? bucket.ratio > bucket.target + 0.05 : bucket.ratio < bucket.target - 0.05);
            return (
              <div key={bucket.key} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className={cn("size-2 rounded-full", bucket.dot)} />
                    {bucket.label}
                  </span>
                  <span className="num text-muted-foreground">meta {Math.round(bucket.target * 100)}%</span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="num text-base font-semibold">{formatBRL(bucket.amount)}</span>
                  <span className={cn("num text-xs font-medium", alert ? "text-amber-600" : "text-emerald-600")}>
                    {nature503020.total > 0 ? formatPercent(bucket.ratio) : "0%"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold">Categorias & Subcategorias ({state.categories.length})</h2>
        <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          <Button size="sm" variant="outline" className="h-9 rounded-xl px-2 text-xs sm:h-8 sm:rounded-md sm:px-3" onClick={() => setCatalogOpen(true)}>
            <LayoutGrid className="size-3.5" /> Catálogo
          </Button>
          <Button size="sm" variant="outline" className="h-9 rounded-xl px-2 text-xs sm:h-8 sm:rounded-md sm:px-3" onClick={applySuggestedLimits}>
            <Sparkles className="size-3.5" /> <span className="sm:hidden">Tetos</span><span className="hidden sm:inline">Sugerir tetos (média 3m)</span>
          </Button>
          <Button size="sm" className="h-9 rounded-xl bg-brand px-2 text-xs text-white hover:bg-blue-700 sm:h-8 sm:rounded-md sm:px-3" onClick={() => setEditing({ open: true, category: null })}>
            <Plus className="size-3.5" /> Nova
          </Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {orderedCategories.map(({ category, isChild }) => {
          const row = breakdown.get(category.id);
          const ratio = row?.ratio ?? 0;
          const rowTone = ratioTone(ratio);
          const parent = isChild && category.parent_id ? categoriesById.get(category.parent_id) : undefined;
          const effectiveNature: CategoryNature = category.nature ?? parent?.nature ?? "lifestyle";
          const natureTone = effectiveNature === "essential" ? "blue" : effectiveNature === "financial" ? "emerald" : "violet";
          const natureShort = effectiveNature === "essential" ? "Essencial" : effectiveNature === "financial" ? "Patrimônio" : "Estilo de Vida";
          return (
            <div
              key={category.id}
              onClick={() => setDrilldownCategory(category)}
              className={cn(
                "grid cursor-pointer gap-3 rounded-xl border bg-card p-4 shadow-panel transition-colors hover:bg-muted/30",
                isChild && "border-l-4 border-l-muted-foreground/30",
              )}
            >
              <div className="flex items-center gap-2.5">
                <CategoryIcon icon={category.icon} color={category.color} className="inline-flex size-8 items-center justify-center rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {isChild ? <span className="mr-1 text-muted-foreground">↳</span> : null}
                    {category.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                    <span>{usedBy(category.id)} lançamento(s)</span>
                    {parent ? <Pill tone="slate">{parent.name}</Pill> : null}
                    <Pill tone={natureTone}>{natureShort}</Pill>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Editar ${category.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditing({ open: true, category });
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Excluir ${category.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
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

      {/* Savings Goals / Emergency Fund */}
      <section className="grid gap-4 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <PiggyBank className="size-4 text-emerald-600" /> Metas de Economia & Reserva ({goals.length})
            </h2>
            <p className="num text-xs text-muted-foreground">
              {goals.length > 0
                ? `Acumulado ${formatBRL(totalSaved)} de ${formatBRL(totalGoalTarget)} (${totalGoalTarget > 0 ? formatPercent(totalSaved / totalGoalTarget) : "0%"})`
                : "Acompanhe reserva de emergência, viagens ou grandes objetivos."}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditingGoal({ open: true, goal: null })}>
            <Plus /> Nova meta
          </Button>
        </div>

        {goals.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
            Nenhuma meta de economia criada ainda. Crie sua reserva de emergência ou próximo objetivo!
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => {
              const ratio = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0;
              const remaining = Math.max(0, sumMoney([goal.target_amount, -goal.current_amount]));
              const monthsLeft = goal.monthly_contribution > 0 && remaining > 0 ? Math.ceil(remaining / goal.monthly_contribution) : null;
              return (
                <div key={goal.id} className="grid gap-3 rounded-xl border bg-card p-4 shadow-panel">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{goal.title}</p>
                      <p className="num text-xs text-muted-foreground">
                        {goal.target_month ? `Alvo ${formatMonthLabel(goal.target_month)}` : "Sem prazo fixo"}
                        {monthsLeft ? ` • ~${monthsLeft} mês(es) no ritmo atual` : remaining === 0 ? " • Concluída ✓" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${goal.title}`} onClick={() => setEditingGoal({ open: true, goal })}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Excluir ${goal.title}`}
                        onClick={() => {
                          commit((current) => deleteSavingsGoal(current, goal.id));
                          toast.success("Meta removida");
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="num font-semibold text-emerald-600">{formatBRL(goal.current_amount)}</span>
                    <span className="num text-xs text-muted-foreground">meta {formatBRL(goal.target_amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(ratio, 1) * 100}%`, backgroundColor: goal.color }} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-xs text-muted-foreground">
                      {formatPercent(ratio)} • aporte {formatBRL(goal.monthly_contribution)}/mês
                    </span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setContributingGoal(goal)}>
                      <Plus className="size-3" /> Aportar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Drill-down sheet */}
      <Sheet open={drilldownCategory !== null} onOpenChange={(open) => !open && setDrilldownCategory(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {drilldownCategory ? (
            <div className="grid gap-4 p-4">
              <SheetHeader className="p-0">
                <SheetTitle className="flex items-center gap-2">
                  <CategoryIcon icon={drilldownCategory.icon} color={drilldownCategory.color} />
                  {drilldownCategory.name}
                </SheetTitle>
                <SheetDescription>
                  Lançamentos em {formatMonthLabel(selectedMonth)} • Total{" "}
                  {formatBRL(sumMoney(drilldownItems.map((tx) => netExpenseAmount(state, tx))))}
                </SheetDescription>
              </SheetHeader>
              {drilldownItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum gasto nesta categoria em {formatMonthLabel(selectedMonth)}.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {drilldownItems.map((tx) => (
                    <li key={tx.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setDrilldownCategory(null);
                          openEdit(tx.id);
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{tx.clean_title}</p>
                          <p className="num text-xs text-muted-foreground">{formatDateBR(tx.date)}</p>
                        </div>
                        <span className="num shrink-0 text-sm font-semibold">{formatBRL(netExpenseAmount(state, tx))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={editing.open} onOpenChange={(open) => !open && setEditing({ open: false })}>
        <DialogContent className="sm:max-w-md">
          {editing.open ? <CategoryForm key={editing.category?.id ?? "new"} category={editing.category} onDone={() => setEditing({ open: false })} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {catalogOpen ? <PresetCatalogDialog onDone={() => setCatalogOpen(false)} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editingGoal.open} onOpenChange={(open) => !open && setEditingGoal({ open: false })}>
        <DialogContent className="sm:max-w-md">
          {editingGoal.open ? <GoalForm key={editingGoal.goal?.id ?? "new"} goal={editingGoal.goal} onDone={() => setEditingGoal({ open: false })} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={contributingGoal !== null} onOpenChange={(open) => !open && setContributingGoal(null)}>
        <DialogContent className="sm:max-w-sm">
          {contributingGoal ? <ContributeGoalForm goal={contributingGoal} onDone={() => setContributingGoal(null)} /> : null}
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

function GoalForm({ goal, onDone }: { goal: SavingsGoal | null; onDone: () => void }) {
  const { commit } = useFinance();
  const [title, setTitle] = useState(goal?.title ?? "");
  const [target, setTarget] = useState(goal ? goal.target_amount.toFixed(2).replace(".", ",") : "");
  const [currentAmount, setCurrentAmount] = useState(goal ? goal.current_amount.toFixed(2).replace(".", ",") : "0,00");
  const [monthly, setMonthly] = useState(goal ? goal.monthly_contribution.toFixed(2).replace(".", ",") : "");
  const [targetMonth, setTargetMonth] = useState(goal?.target_month ?? "");
  const [color, setColor] = useState(goal?.color ?? "#10B981");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const t = parseAmount(target);
    const c = parseAmount(currentAmount) ?? 0;
    const m = monthly.trim() ? parseAmount(monthly) : 0;
    if (!title.trim()) return setError("Informe o nome da meta.");
    if (t === null || t <= 0) return setError("Informe um objetivo maior que zero.");
    if (c < 0 || m === null || m < 0) return setError("Valores inválidos.");
    commit((state) =>
      upsertSavingsGoal(state, {
        id: goal?.id,
        title: title.trim(),
        target_amount: t,
        current_amount: c,
        monthly_contribution: m,
        target_month: targetMonth || null,
        color,
      }),
    );
    toast.success(goal ? "Meta atualizada" : "Meta criada");
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{goal ? "Editar meta de economia" : "Nova meta de economia"}</DialogTitle>
        <DialogDescription>Defina quanto quer juntar e seu aporte mensal previsto.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="goal-title">Nome da meta</Label>
        <Input id="goal-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Reserva de emergência, Viagem" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="goal-target">Objetivo (R$)</Label>
          <Input id="goal-target" inputMode="decimal" className="num" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="15.000,00" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="goal-curr">Já guardado (R$)</Label>
          <Input id="goal-curr" inputMode="decimal" className="num" value={currentAmount} onChange={(event) => setCurrentAmount(event.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="goal-monthly">Aporte mensal (R$)</Label>
          <Input id="goal-monthly" inputMode="decimal" className="num" value={monthly} onChange={(event) => setMonthly(event.target.value)} placeholder="500,00" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="goal-month">Mês alvo (opcional)</Label>
          <Input id="goal-month" type="month" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_COLORS.slice(0, 8).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setColor(option)}
            className={cn("size-6 rounded-full ring-offset-2 ring-offset-background", color === option && "ring-2 ring-foreground")}
            style={{ backgroundColor: option }}
            aria-label={`Cor ${option}`}
          />
        ))}
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

function ContributeGoalForm({ goal, onDone }: { goal: SavingsGoal; onDone: () => void }) {
  const { commit } = useFinance();
  const [amount, setAmount] = useState(goal.monthly_contribution > 0 ? goal.monthly_contribution.toFixed(2).replace(".", ",") : "");

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (parsed === null || parsed === 0) return toast.error("Informe um valor");
    commit((state) => contributeSavingsGoal(state, goal.id, parsed));
    toast.success(parsed > 0 ? `Aporte de ${formatBRL(parsed)} registrado` : `Resgate de ${formatBRL(Math.abs(parsed))} registrado`);
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Aportar em {goal.title}</DialogTitle>
        <DialogDescription>Use valor negativo se precisar registrar um resgate.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="contrib-val">Valor (R$)</Label>
        <Input id="contrib-val" inputMode="decimal" className="num" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Confirmar</Button>
      </DialogFooter>
    </form>
  );
}

const NO_PARENT = "__root__";
const NATURE_OPTIONS: { value: CategoryNature; label: string }[] = (
  Object.keys(CATEGORY_NATURE_LABEL) as CategoryNature[]
).map((value) => ({ value, label: CATEGORY_NATURE_LABEL[value] }));

function CategoryForm({ category, onDone }: { category: Category | null; onDone: () => void }) {
  const { state, commit } = useFinance();
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(category?.icon ?? "tag");
  const [limit, setLimit] = useState(category ? category.monthly_limit.toFixed(2).replace(".", ",") : "");
  const [parentId, setParentId] = useState<string>(category?.parent_id ?? NO_PARENT);
  const [nature, setNature] = useState<CategoryNature>(category?.nature ?? "lifestyle");
  const [error, setError] = useState<string | null>(null);

  // Only allow top-level categories (not self, and not if this category already has children) as parent.
  const hasChildren = category ? state.categories.some((c) => c.parent_id === category.id) : false;
  const parentOptions = [
    { value: NO_PARENT, label: "Categoria principal (raiz)" },
    ...state.categories
      .filter((c) => !c.parent_id && c.id !== category?.id)
      .map((c) => ({ value: c.id, label: c.name })),
  ];

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = limit.trim() === "" ? 0 : parseAmount(limit);
    if (!name.trim()) return setError("Informe o nome.");
    const duplicate = state.categories.some((item) => item.id !== category?.id && item.name.toLowerCase() === name.trim().toLowerCase());
    if (duplicate) return setError("Já existe uma categoria com esse nome.");
    if (value === null || value < 0) return setError("Teto inválido.");
    commit((current) =>
      upsertCategory(current, {
        id: category?.id,
        name: name.trim(),
        color,
        icon,
        monthly_limit: value,
        parent_id: parentId === NO_PARENT ? null : parentId,
        nature,
      }),
    );
    toast.success(category ? "Categoria atualizada" : "Categoria criada");
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{category ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        <DialogDescription>Defina cor, ícone, classificação 50/30/20, categoria pai (opcional) e teto mensal.</DialogDescription>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cat-nature">Classificação 50/30/20</Label>
          <SimpleSelect id="cat-nature" value={nature} options={NATURE_OPTIONS} onChange={setNature} className="w-full" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cat-parent">Subcategoria de</Label>
          <SimpleSelect
            id="cat-parent"
            value={parentId}
            options={parentOptions}
            disabled={hasChildren}
            onChange={(next) => {
              setParentId(next);
              if (next !== NO_PARENT && !category) {
                const parent = state.categories.find((c) => c.id === next);
                if (parent) {
                  if (parent.nature) setNature(parent.nature);
                  setColor(parent.color);
                }
              }
            }}
            className="w-full"
          />
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

function PresetCatalogDialog({ onDone }: { onDone: () => void }) {
  const { state, commit } = useFinance();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<PresetKey>>(() => {
    const missing = CATEGORY_PRESETS.filter((p) => !findCategoryForPreset(state.categories, p)).map((p) => p.key);
    return new Set(missing);
  });

  const existingKeys = new Set(
    CATEGORY_PRESETS.filter((p) => findCategoryForPreset(state.categories, p)).map((p) => p.key),
  );
  const missingPresets = CATEGORY_PRESETS.filter((p) => !existingKeys.has(p.key));
  const needle = query.trim().toLowerCase();
  const filtered = CATEGORY_PRESETS.filter(
    (p) => !needle || p.name.toLowerCase().includes(needle) || p.aliases.some((a) => a.includes(needle)),
  );

  function toggle(key: PresetKey) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applySelected() {
    const keys = Array.from(selected).filter((k) => !existingKeys.has(k));
    if (keys.length === 0) {
      toast("Nenhuma categoria nova selecionada");
      return;
    }
    let addedNames: string[] = [];
    commit((current) => {
      const res = addPresetCategories(current, keys);
      addedNames = res.added;
      return res.state;
    });
    toast.success(`${addedNames.length} categoria(s) adicionada(s)`, {
      description: addedNames.slice(0, 5).join(", ") + (addedNames.length > 5 ? ` +${addedNames.length - 5}` : ""),
    });
    onDone();
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Catálogo de Categorias ({CATEGORY_PRESETS.length})</DialogTitle>
        <DialogDescription>
          Adicione categorias específicas em 1 clique — todas já vêm com ícone, classificação 50/30/20 e reconhecimento automático nos extratos e Quick Add.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar: ex. Video Game, Carro, Esporte..."
          className="h-8 flex-1 text-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => setSelected(new Set(missingPresets.map((p) => p.key)))}
        >
          Selecionar faltantes ({missingPresets.length})
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelected(new Set())}>
          Limpar
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {filtered.map((preset) => {
          const already = existingKeys.has(preset.key);
          const checked = already || selected.has(preset.key);
          const nature = defaultNatureForPreset(preset.key);
          const natureLabel = nature === "essential" ? "Essencial" : nature === "financial" ? "Patrimônio" : "Estilo de Vida";
          return (
            <button
              key={preset.key}
              type="button"
              disabled={already}
              onClick={() => toggle(preset.key)}
              className={cn(
                "flex items-center justify-between gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                already
                  ? "cursor-default border-emerald-200/70 bg-emerald-50/40 opacity-75 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                  : checked
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/10"
                    : "hover:bg-muted/40",
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <CategoryIcon icon={preset.icon} color={preset.color} className="inline-flex size-7 shrink-0 items-center justify-center rounded-md" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{preset.name}</p>
                  <p className="text-[10.5px] text-muted-foreground">{natureLabel}</p>
                </div>
              </div>
              {already ? (
                <Pill tone="emerald">Adicionada</Pill>
              ) : (
                <span
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded border",
                    checked ? "border-blue-600 bg-blue-600 text-white" : "border-input bg-background",
                  )}
                >
                  {checked ? <Check className="size-3.5" /> : null}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Fechar
        </Button>
        <Button type="button" onClick={applySelected} disabled={Array.from(selected).filter((k) => !existingKeys.has(k)).length === 0}>
          Adicionar {Array.from(selected).filter((k) => !existingKeys.has(k)).length} categoria(s)
        </Button>
      </DialogFooter>
    </div>
  );
}
