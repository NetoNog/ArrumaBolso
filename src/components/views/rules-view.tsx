"use client";

import { EyeOff, Pencil, Play, Plus, Repeat, Trash2, Wand2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { CategoryIcon } from "@/components/common/category-icon";
import { CategorySelect } from "@/components/common/category-select";
import { Pill } from "@/components/common/pill";
import { SimpleSelect } from "@/components/common/simple-select";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { categorize, isValidRulePattern, ruleMatches } from "@/lib/categorization";
import { formatDateBR } from "@/lib/dates";
import {
  deleteRule,
  previewReapplyRules,
  reapplyRules,
  upsertRule,
  type RulePreviewChange,
} from "@/lib/domain/operations";
import { PAYMENT_METHOD_LABEL, type CategorizationRule, type PaymentMethod } from "@/lib/domain/types";
import { formatBRL, parseAmount } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

type Editing = { open: false } | { open: true; rule: CategorizationRule | null };
type PreviewTarget = { open: false } | { open: true; onlyRuleId?: string; label: string; changes: RulePreviewChange[] };

const ANY_METHOD = "__any__";
const NO_SUB = "__none__";

const METHOD_OPTIONS = [
  { value: ANY_METHOD, label: "Qualquer método" },
  ...(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] })),
];

export function RulesView() {
  const { state, commit } = useFinance();
  const [editing, setEditing] = useState<Editing>({ open: false });
  const [preview, setPreview] = useState<PreviewTarget>({ open: false });
  const categoriesById = new Map(state.categories.map((category) => [category.id, category]));
  const subsById = new Map(state.recurring_subscriptions.map((sub) => [sub.id, sub]));
  const rules = [...state.categorization_rules].sort((a, b) => b.priority - a.priority);

  const removeRule = (rule: CategorizationRule) => {
    commit((current) => deleteRule(current, rule.id));
    toast.success("Regra excluída", {
      action: { label: "Desfazer", onClick: () => commit((current) => upsertRule(current, rule)) },
    });
  };

  const matches = (rule: CategorizationRule) =>
    state.transactions.filter((tx) => ruleMatches(rule, tx.raw_title, { amount: tx.amount, paymentMethod: tx.payment_method })).length;

  function openPreview(onlyRuleId?: string, label = "Todas as regras") {
    const changes = previewReapplyRules(state, onlyRuleId);
    if (changes.length === 0) {
      toast("Nada a reclassificar", { description: "Somente itens importados não editados manualmente são afetados." });
      return;
    }
    setPreview({ open: true, onlyRuleId, label, changes });
  }

  function confirmApply() {
    if (!preview.open) return;
    let changed = 0;
    const onlyRuleId = preview.onlyRuleId;
    commit((current) => {
      const result = reapplyRules(current, undefined, onlyRuleId);
      changed = result.changed;
      return result.state;
    });
    setPreview({ open: false });
    toast.success(`${changed} lançamento(s) atualizado(s)`);
  }

  return (
    <div className="grid gap-6">
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-sm font-semibold">Dicionário inteligente de auto-categorização</CardTitle>
          <CardDescription>
            Combine texto ou Regex com faixa de valor e forma de pagamento. Regras também podem vincular assinaturas ou marcar como ignorado.
          </CardDescription>
          <CardAction className="flex flex-col gap-2 sm:flex-row">
            <Button size="sm" variant="outline" onClick={() => openPreview()}>
              <Wand2 /> Pré-visualizar & Reaplicar
            </Button>
            <Button size="sm" onClick={() => setEditing({ open: true, rule: null })}>
              <Plus /> Nova regra
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y md:hidden" aria-label="Regras">
            {rules.map((rule) => {
              const category = rule.category_id ? categoriesById.get(rule.category_id) : undefined;
              return (
                <li key={rule.id} className="flex items-center gap-2 py-3 pr-2 pl-4">
                  <button
                    type="button"
                    onClick={() => setEditing({ open: true, rule })}
                    className="min-w-0 flex-1 text-left transition-opacity active:opacity-60"
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="num truncate text-sm font-medium">{rule.pattern}</span>
                      {rule.is_regex ? <Pill tone="blue">Regex</Pill> : null}
                      {rule.mark_ignored ? <Pill tone="slate">Ignora</Pill> : null}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      {category ? <CategoryIcon icon={category.icon} color={category.color} /> : null}
                      {category?.name ?? "Sem categoria"} • {rule.clean_name_override ?? "nome automático"}
                    </span>
                    <span className="num mt-0.5 block text-xs text-muted-foreground">
                      Prioridade {rule.priority} • {matches(rule)} ocorrência(s)
                    </span>
                  </button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Aplicar regra ${rule.pattern}`} onClick={() => openPreview(rule.id, rule.pattern)}>
                    <Play />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Excluir regra ${rule.pattern}`} onClick={() => removeRule(rule)}>
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
            {rules.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhuma regra. Ao mudar a categoria de um item importado, use “Salvar regra” no aviso.
              </li>
            ) : null}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Padrão & Condições</TableHead>
                  <TableHead>Nome limpo</TableHead>
                  <TableHead>Ações automáticas</TableHead>
                  <TableHead className="text-right">Prioridade</TableHead>
                  <TableHead className="text-right">Casamentos</TableHead>
                  <TableHead className="pr-4 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => {
                  const category = rule.category_id ? categoriesById.get(rule.category_id) : undefined;
                  const sub = rule.subscription_id ? subsById.get(rule.subscription_id) : undefined;
                  return (
                    <TableRow key={rule.id}>
                      <TableCell className="pl-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="num text-xs font-medium">{rule.pattern}</span>
                          {rule.is_regex ? <Pill tone="blue">Regex</Pill> : null}
                        </div>
                        <div className="num mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                          {rule.min_amount != null || rule.max_amount != null ? (
                            <span>
                              Valor: {rule.min_amount != null ? formatBRL(rule.min_amount) : "0"} –{" "}
                              {rule.max_amount != null ? formatBRL(rule.max_amount) : "∞"}
                            </span>
                          ) : null}
                          {rule.payment_method ? <span>• {PAYMENT_METHOD_LABEL[rule.payment_method]}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell>{rule.clean_name_override ?? <span className="text-muted-foreground">automático</span>}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {category ? (
                            <span className="flex items-center gap-1.5 text-xs">
                              <CategoryIcon icon={category.icon} color={category.color} /> {category.name}
                            </span>
                          ) : null}
                          {sub ? (
                            <Pill tone="violet">
                              <Repeat className="mr-1 inline size-3" />
                              {sub.title}
                            </Pill>
                          ) : null}
                          {rule.mark_ignored ? (
                            <Pill tone="slate">
                              <EyeOff className="mr-1 inline size-3" />
                              Ignorar
                            </Pill>
                          ) : null}
                          {!category && !sub && !rule.mark_ignored ? <span className="text-muted-foreground">—</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="num text-right">{rule.priority}</TableCell>
                      <TableCell className="num text-right">{matches(rule)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Pré-visualizar e aplicar apenas esta regra"
                          aria-label={`Aplicar regra ${rule.pattern}`}
                          onClick={() => openPreview(rule.id, rule.pattern)}
                        >
                          <Play />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Editar regra ${rule.pattern}`} onClick={() => setEditing({ open: true, rule })}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Excluir regra ${rule.pattern}`} onClick={() => removeRule(rule)}>
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma regra. Ao mudar a categoria de um item importado, use “Salvar regra” no aviso.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editing.open} onOpenChange={(open) => !open && setEditing({ open: false })}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {editing.open ? <RuleForm key={editing.rule?.id ?? "new"} rule={editing.rule} onDone={() => setEditing({ open: false })} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={preview.open} onOpenChange={(open) => !open && setPreview({ open: false })}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {preview.open ? (
            <div className="grid gap-4">
              <DialogHeader>
                <DialogTitle>Prévia de aplicação • {preview.label}</DialogTitle>
                <DialogDescription>
                  {preview.changes.length} lançamento(s) importado(s) e não editados serão atualizados. Confira antes de confirmar:
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-96 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Antes</TableHead>
                      <TableHead>Depois</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.changes.slice(0, 80).map((change) => (
                      <TableRow key={change.transactionId}>
                        <TableCell className="num text-xs text-muted-foreground">{formatDateBR(change.date)}</TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium">{change.beforeTitle}</div>
                          <div className="text-muted-foreground">
                            {change.beforeCategoryId ? categoriesById.get(change.beforeCategoryId)?.name : "Sem categoria"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium text-blue-600">{change.afterTitle}</div>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            <span className="text-emerald-600">
                              {change.afterCategoryId ? categoriesById.get(change.afterCategoryId)?.name : "Sem categoria"}
                            </span>
                            {change.afterSubscriptionId && change.afterSubscriptionId !== change.beforeSubscriptionId ? (
                              <Pill tone="violet">+Assinatura</Pill>
                            ) : null}
                            {change.afterIgnored && !change.beforeIgnored ? <Pill tone="slate">+Ignorar</Pill> : null}
                          </div>
                        </TableCell>
                        <TableCell className="num text-right text-xs">{formatBRL(change.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreview({ open: false })}>
                  Cancelar
                </Button>
                <Button onClick={confirmApply}>
                  <Wand2 /> Confirmar e aplicar ({preview.changes.length})
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleForm({ rule, onDone }: { rule: CategorizationRule | null; onDone: () => void }) {
  const { state, commit } = useFinance();
  const [pattern, setPattern] = useState(rule?.pattern ?? "");
  const [isRegex, setIsRegex] = useState(Boolean(rule?.is_regex));
  const [cleanName, setCleanName] = useState(rule?.clean_name_override ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(rule?.category_id ?? null);
  const [priority, setPriority] = useState(String(rule?.priority ?? 50));
  const [minAmount, setMinAmount] = useState(rule?.min_amount != null ? rule.min_amount.toFixed(2).replace(".", ",") : "");
  const [maxAmount, setMaxAmount] = useState(rule?.max_amount != null ? rule.max_amount.toFixed(2).replace(".", ",") : "");
  const [paymentMethod, setPaymentMethod] = useState<string>(rule?.payment_method ?? ANY_METHOD);
  const [subscriptionId, setSubscriptionId] = useState<string>(rule?.subscription_id ?? NO_SUB);
  const [markIgnored, setMarkIgnored] = useState(Boolean(rule?.mark_ignored));
  const [error, setError] = useState<string | null>(null);

  const subOptions = [
    { value: NO_SUB, label: "Não vincular assinatura" },
    ...state.recurring_subscriptions.map((sub) => ({ value: sub.id, label: sub.title })),
  ];

  const draftRule: CategorizationRule = {
    id: "preview",
    pattern: pattern.trim(),
    clean_name_override: cleanName.trim() || null,
    category_id: categoryId,
    priority: 1,
    is_regex: isRegex,
    min_amount: minAmount.trim() ? parseAmount(minAmount) : null,
    max_amount: maxAmount.trim() ? parseAmount(maxAmount) : null,
    payment_method: paymentMethod === ANY_METHOD ? null : (paymentMethod as PaymentMethod),
    subscription_id: subscriptionId === NO_SUB ? null : subscriptionId,
    mark_ignored: markIgnored,
  };

  const validPattern = isValidRulePattern(pattern, isRegex);
  const sample = validPattern
    ? state.transactions.filter((tx) => ruleMatches(draftRule, tx.raw_title, { amount: tx.amount, paymentMethod: tx.payment_method }))
    : [];
  const preview = sample[0]
    ? categorize(sample[0].raw_title, [draftRule], { amount: sample[0].amount, paymentMethod: sample[0].payment_method })
    : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(priority);
    if (!pattern.trim()) return setError("Informe o padrão.");
    if (!isValidRulePattern(pattern, isRegex)) return setError("Expressão regular inválida.");
    if (!Number.isInteger(value) || value < 0 || value > 1000) return setError("Prioridade entre 0 e 1000.");
    const minVal = minAmount.trim() ? parseAmount(minAmount) : null;
    const maxVal = maxAmount.trim() ? parseAmount(maxAmount) : null;
    if (minAmount.trim() && (minVal === null || minVal < 0)) return setError("Valor mínimo inválido.");
    if (maxAmount.trim() && (maxVal === null || maxVal < 0)) return setError("Valor máximo inválido.");
    if (minVal !== null && maxVal !== null && minVal > maxVal) return setError("Valor mínimo maior que o máximo.");

    commit((current) =>
      upsertRule(current, {
        id: rule?.id,
        pattern: isRegex ? pattern.trim() : pattern.trim().toLowerCase(),
        clean_name_override: cleanName.trim() || null,
        category_id: categoryId,
        priority: value,
        is_regex: isRegex,
        min_amount: minVal,
        max_amount: maxVal,
        payment_method: paymentMethod === ANY_METHOD ? null : (paymentMethod as PaymentMethod),
        subscription_id: subscriptionId === NO_SUB ? null : subscriptionId,
        mark_ignored: markIgnored,
      }),
    );
    toast.success(rule ? "Regra atualizada" : "Regra criada", { description: "Use “Pré-visualizar & Reaplicar” para atualizar itens existentes." });
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{rule ? "Editar regra" : "Nova regra inteligente"}</DialogTitle>
        <DialogDescription>Aplicada automaticamente nas próximas importações e sob demanda na pré-visualização.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="rule-pattern">{isRegex ? "Expressão regular (Regex)" : "Título contém"}</Label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox checked={isRegex} onCheckedChange={(checked) => setIsRegex(Boolean(checked))} />
            Usar Regex
          </label>
        </div>
        <Input
          id="rule-pattern"
          className="num"
          autoCapitalize="none"
          autoCorrect="off"
          value={pattern}
          onChange={(event) => setPattern(event.target.value)}
          placeholder={isRegex ? "ex.: ^(ifd|99food)\\*" : "ex.: ifd*"}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          {!pattern.trim()
            ? " "
            : !validPattern
              ? "Regex inválida."
              : `${sample.length} lançamento(s) existentes casam com estas condições.`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="rule-min">Valor mín. (R$)</Label>
          <Input id="rule-min" inputMode="decimal" className="num" value={minAmount} onChange={(event) => setMinAmount(event.target.value)} placeholder="Opcional" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rule-max">Valor máx. (R$)</Label>
          <Input id="rule-max" inputMode="decimal" className="num" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} placeholder="Opcional" />
        </div>
        <div className="grid gap-1.5">
          <Label>Método</Label>
          <SimpleSelect value={paymentMethod} options={METHOD_OPTIONS} onChange={setPaymentMethod} className="w-full" />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="rule-name">Nome amigável (opcional)</Label>
        <Input id="rule-name" value={cleanName} onChange={(event) => setCleanName(event.target.value)} placeholder="Deixe vazio para limpeza automática" />
      </div>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <div className="grid gap-1.5">
          <Label>Categoria</Label>
          <CategorySelect categories={state.categories} value={categoryId} onChange={setCategoryId} className="w-full" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rule-priority">Prioridade</Label>
          <Input id="rule-priority" type="number" inputMode="numeric" className="num" value={priority} onChange={(event) => setPriority(event.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="grid gap-1.5">
          <Label>Vincular automaticamente à assinatura (opcional)</Label>
          <SimpleSelect value={subscriptionId} options={subOptions} onChange={setSubscriptionId} className="w-full" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox checked={markIgnored} onCheckedChange={(checked) => setMarkIgnored(Boolean(checked))} />
          Marcar lançamentos importados como ignorados na soma (útil para transferências/estornos internos)
        </label>
      </div>

      {preview && sample[0] ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <span className="num text-muted-foreground">{sample[0].raw_title}</span> → <strong className="font-medium">{preview.cleanTitle}</strong>
        </p>
      ) : null}
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
