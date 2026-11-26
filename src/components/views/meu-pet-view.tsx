"use client";

import {
  Archive,
  CalendarDays,
  Link2,
  PawPrint,
  Pencil,
  Plus,
  Scale,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { CATEGORY_COLORS } from "@/components/common/category-icon";
import { Pill } from "@/components/common/pill";
import { SimpleSelect } from "@/components/common/simple-select";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TransactionsTable } from "@/components/transactions/transactions-table";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateBR, formatMonthLabel, normalizeDate } from "@/lib/dates";
import {
  archivePet,
  assignTransactionToPet,
  deletePet,
  ensurePetCategory,
  upsertPet,
} from "@/lib/domain/operations";
import {
  PET_SPECIES_LABEL,
  type Pet,
  type PetSpecies,
} from "@/lib/domain/types";
import {
  allPetsSummary,
  delta,
  netExpenseAmount,
  petAgeLabel,
} from "@/lib/finance/metrics";
import { formatBRL, formatPercent, formatSignedBRL, parseAmount } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

const SPECIES_OPTIONS: { value: PetSpecies; label: string }[] = (
  Object.keys(PET_SPECIES_LABEL) as PetSpecies[]
).map((value) => ({ value, label: PET_SPECIES_LABEL[value] }));

const SPECIES_EMOJI: Record<PetSpecies, string> = {
  dog: "🐶",
  cat: "🐱",
  bird: "🦜",
  rodent: "🐹",
  reptile: "🐢",
  fish: "🐠",
  other: "🐾",
};

type EditingPet = { open: false } | { open: true; pet: Pet | null };

export function MeuPetView() {
  const { state, commit, selectedMonth, today } = useFinance();
  const { openCreate, openEdit } = useDialogs();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingPet>({ open: false });
  const [removing, setRemoving] = useState<Pet | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const pets = state.pets ?? [];
  const activePets = pets.filter((pet) => !pet.is_archived);
  const visiblePets = showArchived ? pets : activePets;
  const effectiveSelectedPetId = selectedPetId && pets.some((p) => p.id === selectedPetId) ? selectedPetId : null;
  const selectedPet = effectiveSelectedPetId ? pets.find((p) => p.id === effectiveSelectedPetId) ?? null : null;

  const summary = allPetsSummary(state, selectedMonth, effectiveSelectedPetId);
  const monthDelta = delta(summary.totalMonth, summary.previousMonth);
  const budgetUsage = summary.totalBudget > 0 ? summary.totalMonth / summary.totalBudget : null;
  const maxTrend = Math.max(...summary.monthlyTrend6m.map((m) => m.total), 1);

  function openNewPetExpense(targetPetId?: string | null) {
    let petCategoryId: string | null = null;
    commit((current) => {
      const ensured = ensurePetCategory(current);
      petCategoryId = ensured.categoryId;
      return ensured.state;
    });
    const resolvedPetId = targetPetId ?? effectiveSelectedPetId ?? activePets[0]?.id ?? null;
    openCreate({
      type: "expense",
      invoice_month: selectedMonth,
      category_id: petCategoryId,
      pet_id: resolvedPetId,
    });
  }

  return (
    <div className="grid gap-6">
      {/* Top Action Bar & Pet Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="-mx-4 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setSelectedPetId(null)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium whitespace-nowrap transition-colors sm:h-8 sm:px-3",
              effectiveSelectedPetId === null
                ? "border-foreground bg-foreground text-background"
                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <PawPrint className="size-3.5" /> Todos ({activePets.length})
          </button>
          {activePets.map((pet) => (
            <button
              key={pet.id}
              type="button"
              onClick={() => setSelectedPetId(pet.id)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium whitespace-nowrap transition-colors sm:h-8 sm:px-3",
                effectiveSelectedPetId === pet.id
                  ? "border-foreground bg-foreground text-background"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: pet.color }} />
              <span>{SPECIES_EMOJI[pet.species]}</span>
              <span>{pet.name}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button size="sm" variant="outline" className="h-10 rounded-xl sm:h-8 sm:rounded-md" onClick={() => setEditing({ open: true, pet: null })}>
            <Plus /> Cadastrar pet
          </Button>
          <Button size="sm" className="h-10 rounded-xl bg-brand text-white hover:bg-blue-700 sm:h-8 sm:rounded-md" onClick={() => openNewPetExpense()}>
            <PawPrint className="size-3.5" /> Novo gasto pet
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Resumo Meu Pet">
        <KpiCard
          icon={PawPrint}
          iconClassName="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
          value={formatBRL(summary.totalMonth)}
          subtitle={
            selectedPet
              ? `Gasto com ${selectedPet.name} • ${formatMonthLabel(selectedMonth)}`
              : `Gastos Pet em ${formatMonthLabel(selectedMonth)}`
          }
          trend={{
            direction: monthDelta.value > 0 ? "up" : monthDelta.value < 0 ? "down" : "flat",
            label: formatSignedBRL(monthDelta.value),
            tone: monthDelta.value > 0 ? "bad" : monthDelta.value < 0 ? "good" : "neutral",
          }}
        />
        <KpiCard
          icon={TrendingUp}
          iconClassName="bg-blue-50 text-blue-600 dark:bg-blue-500/10"
          value={formatBRL(summary.average3m)}
          subtitle="Média mensal (últimos 3 meses)"
          trend={{ direction: "flat", label: `Projeção ${formatBRL(summary.average3m * 12)}/ano`, tone: "neutral" }}
        />
        <KpiCard
          icon={CalendarDays}
          iconClassName="bg-violet-50 text-violet-600 dark:bg-violet-500/10"
          value={formatBRL(summary.total12m)}
          subtitle="Acumulado nos últimos 12 meses"
          trend={{ direction: "flat", label: `${summary.allPetTransactions.length} lançamento(s)`, tone: "neutral" }}
        />
        <KpiCard
          icon={Target}
          iconClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
          value={budgetUsage === null ? "—" : formatPercent(budgetUsage)}
          subtitle={summary.totalBudget > 0 ? `Teto mensal ${formatBRL(summary.totalBudget)}` : "Sem teto definido"}
          trend={
            budgetUsage === null
              ? { direction: "flat", label: "Defina no cadastro", tone: "neutral" }
              : budgetUsage > 1
                ? { direction: "up", label: "Acima do teto", tone: "bad" }
                : budgetUsage >= 0.8
                  ? { direction: "flat", label: "Atenção", tone: "neutral" }
                  : { direction: "down", label: "Dentro do teto", tone: "good" }
          }
        />
      </section>

      {/* Pets Grid */}
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Meus Pets ({activePets.length})</h2>
          {pets.some((p) => p.is_archived) ? (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {showArchived ? "Ocultar arquivados" : "Mostrar arquivados"}
            </button>
          ) : null}
        </div>

        {visiblePets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10">
                <PawPrint className="size-6" />
              </div>
              <div className="max-w-md space-y-1">
                <p className="text-sm font-semibold">Cadastre seu primeiro pet</p>
                <p className="text-xs text-muted-foreground">
                  Adicione nome, espécie, raça, idade, peso e orçamento mensal. Depois você pode vincular qualquer lançamento ou digitar o nome do pet no Lançamento Rápido (ex.: <code>&quot;120 ração rex pix&quot;</code>).
                </p>
              </div>
              <Button size="sm" onClick={() => setEditing({ open: true, pet: null })}>
                <Plus /> Cadastrar primeiro pet
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {summary.byPet
              .filter((row) => showArchived || !row.pet.is_archived)
              .map((row) => {
                const { pet } = row;
                const age = petAgeLabel(pet.birth_date, today);
                const isSelected = effectiveSelectedPetId === pet.id;
                const ratio = row.budgetRatio ?? 0;
                const barColor = ratio > 1 ? "bg-rose-500" : ratio >= 0.8 ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <div
                    key={pet.id}
                    onClick={() => setSelectedPetId(isSelected ? null : pet.id)}
                    className={cn(
                      "grid cursor-pointer gap-3 rounded-xl border bg-card p-4 shadow-panel transition-colors hover:bg-muted/25",
                      isSelected && "ring-2 ring-amber-500",
                      pet.is_archived && "opacity-60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-lg"
                          style={{ backgroundColor: `${pet.color}20`, color: pet.color }}
                        >
                          {SPECIES_EMOJI[pet.species]}
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-semibold">
                            <span className="truncate">{pet.name}</span>
                            {pet.is_archived ? <Pill tone="slate">Arquivado</Pill> : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {PET_SPECIES_LABEL[pet.species]}
                            {pet.breed ? ` • ${pet.breed}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar ${pet.name}`}
                          onClick={() => setEditing({ open: true, pet })}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={pet.is_archived ? `Reativar ${pet.name}` : `Arquivar ${pet.name}`}
                          onClick={() => {
                            commit((current) => archivePet(current, pet.id, !pet.is_archived));
                            toast.success(pet.is_archived ? `${pet.name} reativado` : `${pet.name} arquivado`);
                          }}
                        >
                          <Archive />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Excluir ${pet.name}`}
                          onClick={() => setRemoving(pet)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {age ? <Pill tone="slate">{age}</Pill> : null}
                      {pet.weight_kg !== null ? (
                        <Pill tone="sky">
                          <Scale className="mr-0.5 inline size-3" />
                          {pet.weight_kg.toFixed(1).replace(".", ",")} kg
                        </Pill>
                      ) : null}
                      <Pill tone="amber">{row.count} gasto(s) no mês</Pill>
                    </div>

                    <div className="grid gap-1.5">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="num font-semibold">{formatBRL(row.spent)}</span>
                        <span className="num text-xs text-muted-foreground">
                          {pet.monthly_budget > 0 ? `teto ${formatBRL(pet.monthly_budget)}` : `12m: ${formatBRL(row.total12m)}`}
                        </span>
                      </div>
                      {pet.monthly_budget > 0 ? (
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5 text-xs text-muted-foreground">
                      <span className="num">Média 3m: {formatBRL(row.average3m)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          openNewPetExpense(pet.id);
                        }}
                      >
                        <Plus className="size-3" /> Gasto
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* Unlinked Pet Expenses Triage (from imported statements or manual Pet-category entries) */}
      {summary.unlinkedPetTransactions.length > 0 && activePets.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-amber-600" />
              Gastos Pet detectados sem pet vinculado ({summary.unlinkedPetTransactions.length})
            </CardTitle>
            <CardDescription>
              Encontramos lançamentos de pet shop/veterinária (como Petz, Cobasi, Petlove ou categoria Pets) que ainda não estão ligados a um pet. Vincule em 1 clique:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-lg border bg-card">
              {summary.unlinkedPetTransactions.slice(0, 8).map((tx) => (
                <li key={tx.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-xs">
                  <button type="button" onClick={() => openEdit(tx.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium text-foreground hover:underline">{tx.clean_title}</p>
                    <p className="num text-muted-foreground">
                      {formatDateBR(tx.date)} • {formatBRL(netExpenseAmount(state, tx))}
                    </p>
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {activePets.map((pet) => (
                      <Button
                        key={pet.id}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          commit((current) => assignTransactionToPet(current, tx.id, pet.id));
                          toast.success(`Vinculado a ${pet.name}`, { description: tx.clean_title });
                        }}
                      >
                        <Link2 className="size-3" /> {pet.name}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Breakdown by Pet Expense Kind & 6-Month Evolution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Onde foi o dinheiro Pet • {formatMonthLabel(selectedMonth)}
            </CardTitle>
            <CardDescription>
              Distribuição entre Ração, Veterinário, Banho & Tosa, Vacinas/Remédios, Acessórios e Creche/Hotel.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {summary.byKind.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum gasto pet registrado em {formatMonthLabel(selectedMonth)}.
              </p>
            ) : (
              summary.byKind.map((row) => (
                <div key={row.kind} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-medium">
                      {row.label} <span className="text-muted-foreground">({row.count}x)</span>
                    </span>
                    <span className="num font-semibold">
                      {formatBRL(row.total)}{" "}
                      <span className="font-normal text-muted-foreground">({formatPercent(row.share)})</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${Math.max(row.share * 100, 3)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Evolução mensal de gastos Pet (6 meses)</CardTitle>
            <CardDescription>
              {selectedPet ? `Histórico de ${selectedPet.name}` : "Total consolidado de todos os pets"} nos últimos 6 ciclos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-44 items-end gap-3 rounded-lg border bg-muted/15 px-4 pt-6 pb-3">
              {summary.monthlyTrend6m.map((pt) => {
                const heightPct = pt.total > 0 ? Math.max((pt.total / maxTrend) * 100, 8) : 2;
                const isCurrent = pt.month === selectedMonth;
                return (
                  <div
                    key={pt.month}
                    title={`${pt.label}: ${formatBRL(pt.total)} (${pt.count}x)`}
                    className="flex flex-1 flex-col items-center gap-1.5"
                  >
                    <span className="num text-[10px] font-medium text-muted-foreground">
                      {pt.total > 0 ? formatBRL(pt.total).replace("R$\u00a0", "") : "—"}
                    </span>
                    <div className="flex h-24 w-full items-end">
                      <div
                        className={cn(
                          "w-full rounded-t-md transition-all",
                          pt.total === 0 ? "bg-muted" : isCurrent ? "bg-amber-500" : "bg-amber-500/60",
                        )}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className={cn("text-[11px]", isCurrent ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {pt.label.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pet Transactions Table */}
      <TransactionsTable
        title={selectedPet ? `Histórico de gastos • ${selectedPet.name}` : "Todos os lançamentos Meu Pet"}
        description="Gastos vinculados a um pet ou classificados na categoria Pets / lojas pet."
        transactions={summary.allPetTransactions}
        showMonth
        advancedFilters
        headerAction={
          <Button size="sm" variant="outline" onClick={() => openNewPetExpense()}>
            <Plus /> Novo gasto pet
          </Button>
        }
      />

      {/* Pet Create/Edit Dialog */}
      <Dialog open={editing.open} onOpenChange={(open) => !open && setEditing({ open: false })}>
        <DialogContent className="sm:max-w-md">
          {editing.open ? (
            <PetForm key={editing.pet?.id ?? "new"} pet={editing.pet} onDone={() => setEditing({ open: false })} />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Pet Confirm */}
      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o cadastro de “{removing?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Os lançamentos financeiros já registrados não serão apagados — eles apenas ficarão desvinculados deste pet. Se preferir preservar o vínculo histórico, use a opção Arquivar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (removing) {
                  commit((current) => deletePet(current, removing.id));
                  if (selectedPetId === removing.id) setSelectedPetId(null);
                  toast.success(`Cadastro de ${removing.name} removido`);
                }
                setRemoving(null);
              }}
            >
              Excluir cadastro
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PetForm({ pet, onDone }: { pet: Pet | null; onDone: () => void }) {
  const { commit } = useFinance();
  const [name, setName] = useState(pet?.name ?? "");
  const [species, setSpecies] = useState<PetSpecies>(pet?.species ?? "dog");
  const [breed, setBreed] = useState(pet?.breed ?? "");
  const [birthDate, setBirthDate] = useState(pet?.birth_date ?? "");
  const [weightText, setWeightText] = useState(
    pet?.weight_kg !== null && pet?.weight_kg !== undefined ? pet.weight_kg.toFixed(1).replace(".", ",") : "",
  );
  const [budgetText, setBudgetText] = useState(
    pet && pet.monthly_budget > 0 ? pet.monthly_budget.toFixed(2).replace(".", ",") : "",
  );
  const [color, setColor] = useState(pet?.color ?? "#F59E0B");
  const [notes, setNotes] = useState(pet?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Informe o nome do pet.");
    const parsedWeight = weightText.trim() ? parseAmount(weightText) : null;
    if (weightText.trim() && (parsedWeight === null || parsedWeight < 0)) return setError("Peso inválido.");
    const parsedBudget = budgetText.trim() ? parseAmount(budgetText) : 0;
    if (parsedBudget === null || parsedBudget < 0) return setError("Orçamento mensal inválido.");
    const normalizedBirth = birthDate.trim() ? normalizeDate(birthDate) : null;
    if (birthDate.trim() && !normalizedBirth) return setError("Data de nascimento inválida.");

    commit((current) =>
      upsertPet(current, {
        id: pet?.id,
        name: name.trim(),
        species,
        breed: breed.trim(),
        birth_date: normalizedBirth,
        weight_kg: parsedWeight,
        monthly_budget: parsedBudget,
        color,
        notes: notes.trim(),
        is_archived: pet?.is_archived ?? false,
      }),
    );
    toast.success(pet ? `${name.trim()} atualizado` : `${name.trim()} cadastrado em Meu Pet!`);
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{pet ? `Editar ${pet.name}` : "Cadastrar Pet"}</DialogTitle>
        <DialogDescription>
          Cadastre o perfil do seu pet para separar gastos de ração, veterinário, banho & tosa e acompanhar o orçamento mensal.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pet-name">Nome</Label>
          <Input id="pet-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Thor, Luna" autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pet-species">Espécie</Label>
          <SimpleSelect id="pet-species" value={species} options={SPECIES_OPTIONS} onChange={setSpecies} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pet-breed">Raça (opcional)</Label>
          <Input id="pet-breed" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Ex.: Golden, SRD, Siamês" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pet-birth">Nascimento (opcional)</Label>
          <Input id="pet-birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pet-weight">Peso atual (kg)</Label>
          <Input id="pet-weight" inputMode="decimal" className="num" value={weightText} onChange={(e) => setWeightText(e.target.value)} placeholder="Ex.: 12,5" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pet-budget">Orçamento mensal (R$)</Label>
          <Input id="pet-budget" inputMode="decimal" className="num" value={budgetText} onChange={(e) => setBudgetText(e.target.value)} placeholder="Ex.: 450,00" />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Cor de identificação</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((option) => (
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
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="pet-notes">Observações (opcional)</Label>
        <Textarea
          id="pet-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: Ração hipoalergênica, clínica veterinária de referência..."
        />
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">{pet ? "Salvar alterações" : "Cadastrar pet"}</Button>
      </DialogFooter>
    </form>
  );
}
