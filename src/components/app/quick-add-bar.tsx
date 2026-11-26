"use client";

import { Plus, Sparkles, X, Zap } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { CategorySelect } from "@/components/common/category-select";
import { Pill } from "@/components/common/pill";
import { SimpleSelect } from "@/components/common/simple-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  activeCards,
  createTransaction,
  deleteQuickTemplate,
  resolveOrCreatePresetCategory,
  upsertQuickTemplate,
} from "@/lib/domain/operations";
import { parseQuickAdd } from "@/lib/domain/quick-add";
import { PAYMENT_METHOD_LABEL, type PaymentMethod, type QuickTemplate } from "@/lib/domain/types";
import { formatBRL, parseAmount } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((value) => ({
  value,
  label: PAYMENT_METHOD_LABEL[value],
}));

/**
 * Zero-friction Quick Add bar (natural language: "45,90 padaria pix #cafe")
 * paired with 1-click favourite expense templates.
 */
export function QuickAddBar() {
  const { state, commit, today, selectedMonth } = useFinance();
  const [text, setText] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const parsed = parseQuickAdd(text, state);
  const templates = state.quick_templates ?? [];

  function submitQuick(event: FormEvent) {
    event.preventDefault();
    if (!parsed) {
      toast.error("Informe ao menos o valor e a descrição", {
        description: 'Exemplo: "45,90 padaria pix #cafe" ou "+500 freela pix"',
      });
      return;
    }
    commit((current) => {
      const resolved = resolveOrCreatePresetCategory(current, parsed.categoryId);
      return createTransaction(resolved.state, {
        type: parsed.type,
        payment_method: parsed.paymentMethod,
        card_id: parsed.cardId,
        account_id: parsed.accountId,
        date: today,
        invoice_month: selectedMonth,
        title: parsed.title,
        amount: parsed.amount,
        category_id: resolved.categoryId,
        pet_id: parsed.petId,
        pet_expense_kind: parsed.petExpenseKind,
        notes: "",
        tags: parsed.tags,
        recurrence: { kind: "single" },
      });
    });
    toast.success(`${parsed.title} lançado (${formatBRL(parsed.amount)})`, {
      description: parsed.categoryLabel ? `Categoria automática: ${parsed.categoryLabel}` : undefined,
    });
    setText("");
  }

  function fireTemplate(tpl: QuickTemplate) {
    commit((current) =>
      createTransaction(current, {
        type: tpl.type,
        payment_method: tpl.payment_method,
        card_id: tpl.card_id,
        account_id: tpl.account_id,
        date: today,
        invoice_month: selectedMonth,
        title: tpl.title,
        amount: tpl.amount,
        category_id: tpl.category_id,
        notes: "Lançamento rápido (favorito)",
        tags: tpl.tags,
        recurrence: { kind: "single" },
      }),
    );
    toast.success(`Atalho lançado: ${tpl.title}`, { description: formatBRL(tpl.amount) });
  }

  return (
    <section className="hidden gap-2.5 rounded-2xl border border-border/70 bg-card p-3.5 shadow-panel md:grid md:rounded-xl" aria-label="Registro rápido">
      <form onSubmit={submitQuick} className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Zap className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-amber-500" />
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder='Rápido: "45,90 padaria pix #cafe"'
            className="h-10 rounded-xl pl-8 text-sm md:h-9"
            aria-label="Lançamento rápido por texto"
          />
        </div>
        <Button type="submit" size="sm" disabled={!parsed} className="h-10 shrink-0 rounded-xl bg-brand px-3 text-white hover:bg-blue-700 md:h-9">
          <Sparkles className="size-4 md:size-3.5" />
          <span className="hidden sm:inline">Lançar</span>
        </Button>
      </form>

      {parsed ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Detectado:</span>
          <Pill tone={parsed.type === "income" ? "emerald" : "blue"}>
            {parsed.type === "income" ? "+" : ""}
            {formatBRL(parsed.amount)}
          </Pill>
          <Pill tone="slate">{parsed.title}</Pill>
          <Pill tone="slate">{PAYMENT_METHOD_LABEL[parsed.paymentMethod]}</Pill>
          {parsed.categoryLabel ? <Pill tone="violet">{parsed.categoryLabel}</Pill> : null}
          {parsed.petName ? <Pill tone="amber">🐾 {parsed.petName}</Pill> : null}
          {parsed.tags.map((tag) => (
            <Pill key={tag} tone="amber">
              #{tag}
            </Pill>
          ))}
        </div>
      ) : null}

      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] md:flex-wrap [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Favoritos:</span>
        {templates.map((tpl) => (
          <span
            key={tpl.id}
            className="inline-flex shrink-0 items-center overflow-hidden rounded-full border bg-muted/40 text-xs"
          >
            <button
              type="button"
              onClick={() => fireTemplate(tpl)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 font-medium transition-colors hover:bg-muted active:bg-muted md:py-1"
            >
              <span>{tpl.title}</span>
              <span className="num text-muted-foreground">{formatBRL(tpl.amount)}</span>
            </button>
            <button
              type="button"
              aria-label={`Remover favorito ${tpl.title}`}
              onClick={() => {
                commit((current) => deleteQuickTemplate(current, tpl.id));
                toast.success("Favorito removido");
              }}
              className="px-1.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:py-1"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:py-1"
        >
          <Plus className="size-3" /> Favorito
        </button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          {dialogOpen ? <TemplateForm onDone={() => setDialogOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function TemplateForm({ onDone }: { onDone: () => void }) {
  const { state, commit } = useFinance();
  const [title, setTitle] = useState("");
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("pix_debit");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = parseAmount(amountText);
    if (!title.trim()) return setError("Informe um nome.");
    if (amount === null || amount <= 0) return setError("Informe um valor válido.");
    const cardId = method === "credit_card" ? (activeCards(state)[0]?.id ?? null) : null;
    const accountId = method !== "credit_card" ? ((state.accounts ?? []).find((a) => !a.is_archived)?.id ?? null) : null;
    commit((current) =>
      upsertQuickTemplate(current, {
        title: title.trim(),
        amount,
        type: "expense",
        payment_method: method,
        category_id: categoryId,
        card_id: cardId,
        account_id: accountId,
        tags: [],
      }),
    );
    toast.success("Favorito salvo", { description: `${title.trim()} • ${formatBRL(amount)}` });
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Novo atalho favorito (1 clique)</DialogTitle>
        <DialogDescription>Salve gastos frequentes do dia a dia (ex.: Almoço, Café, Estacionamento) para lançar em 1 toque.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tpl-title">Nome</Label>
          <Input id="tpl-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Almoço trabalho" autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tpl-amount">Valor (R$)</Label>
          <Input id="tpl-amount" inputMode="decimal" className="num" value={amountText} onChange={(event) => setAmountText(event.target.value)} placeholder="35,00" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Forma de pagamento</Label>
          <SimpleSelect value={method} options={METHOD_OPTIONS} onChange={setMethod} className="w-full" />
        </div>
        <div className="grid gap-1.5">
          <Label>Categoria</Label>
          <CategorySelect categories={state.categories} value={categoryId} onChange={setCategoryId} className="w-full" />
        </div>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Salvar favorito</Button>
      </DialogFooter>
    </form>
  );
}

