"use client";

import { Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { CategoryIcon } from "@/components/common/category-icon";
import { CategorySelect } from "@/components/common/category-select";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { categorize } from "@/lib/categorization";
import { deleteRule, reapplyRules, upsertRule } from "@/lib/domain/operations";
import type { CategorizationRule } from "@/lib/domain/types";
import { useFinance } from "@/lib/store/finance-store";

type Editing = { open: false } | { open: true; rule: CategorizationRule | null };

export function RulesView() {
  const { state, commit } = useFinance();
  const [editing, setEditing] = useState<Editing>({ open: false });
  const categoriesById = new Map(state.categories.map((category) => [category.id, category]));
  const rules = [...state.categorization_rules].sort((a, b) => b.priority - a.priority);

  const matches = (rule: CategorizationRule) =>
    state.transactions.filter((tx) => tx.raw_title.toLowerCase().includes(rule.pattern.toLowerCase())).length;

  return (
    <div className="grid gap-6">
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-sm font-semibold">Dicionário de auto-categorização</CardTitle>
          <CardDescription>
            Cada regra procura o padrão no título original do CSV (sem diferenciar maiúsculas). Maior prioridade vence. Prefixos como
            “Pix no Crédito -”, “Mp *”, “Ifd*” e “99food *” já são limpos automaticamente.
          </CardDescription>
          <CardAction className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                let changed = 0;
                commit((current) => {
                  const result = reapplyRules(current);
                  changed = result.changed;
                  return result.state;
                });
                toast.success(changed > 0 ? `${changed} lançamento(s) reclassificado(s)` : "Nada a reclassificar", {
                  description: "Somente itens do CSV que você não editou são afetados.",
                });
              }}
            >
              <Wand2 /> Reaplicar regras
            </Button>
            <Button size="sm" onClick={() => setEditing({ open: true, rule: null })}>
              <Plus /> Nova regra
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Padrão (contém)</TableHead>
                <TableHead>Nome limpo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Prioridade</TableHead>
                <TableHead className="text-right">Ocorrências</TableHead>
                <TableHead className="pr-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => {
                const category = rule.category_id ? categoriesById.get(rule.category_id) : undefined;
                return (
                  <TableRow key={rule.id}>
                    <TableCell className="num pl-4 text-xs">{rule.pattern}</TableCell>
                    <TableCell>{rule.clean_name_override ?? <span className="text-muted-foreground">automático</span>}</TableCell>
                    <TableCell>
                      {category ? (
                        <span className="flex items-center gap-2">
                          <CategoryIcon icon={category.icon} color={category.color} /> {category.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="num text-right">{rule.priority}</TableCell>
                    <TableCell className="num text-right">{matches(rule)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar regra ${rule.pattern}`} onClick={() => setEditing({ open: true, rule })}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Excluir regra ${rule.pattern}`}
                        onClick={() => {
                          commit((current) => deleteRule(current, rule.id));
                          toast.success("Regra excluída", {
                            action: { label: "Desfazer", onClick: () => commit((current) => upsertRule(current, rule)) },
                          });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma regra. Ao mudar a categoria de um item do CSV, use “Salvar regra” no aviso.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editing.open} onOpenChange={(open) => !open && setEditing({ open: false })}>
        <DialogContent className="sm:max-w-md">
          {editing.open ? <RuleForm key={editing.rule?.id ?? "new"} rule={editing.rule} onDone={() => setEditing({ open: false })} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleForm({ rule, onDone }: { rule: CategorizationRule | null; onDone: () => void }) {
  const { state, commit } = useFinance();
  const [pattern, setPattern] = useState(rule?.pattern ?? "");
  const [cleanName, setCleanName] = useState(rule?.clean_name_override ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(rule?.category_id ?? null);
  const [priority, setPriority] = useState(String(rule?.priority ?? 50));
  const [error, setError] = useState<string | null>(null);

  const needle = pattern.trim().toLowerCase();
  const sample = needle ? state.transactions.filter((tx) => tx.raw_title.toLowerCase().includes(needle)) : [];
  const preview = sample[0]
    ? categorize(sample[0].raw_title, [{ id: "preview", pattern: needle, clean_name_override: cleanName.trim() || null, category_id: categoryId, priority: 1 }])
    : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(priority);
    if (!needle) return setError("Informe o padrão.");
    if (!Number.isInteger(value) || value < 0 || value > 1000) return setError("Prioridade entre 0 e 1000.");
    commit((current) =>
      upsertRule(current, {
        id: rule?.id,
        pattern: needle,
        clean_name_override: cleanName.trim() || null,
        category_id: categoryId,
        priority: value,
      }),
    );
    toast.success(rule ? "Regra atualizada" : "Regra criada", { description: "Use “Reaplicar regras” para atualizar itens já importados." });
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{rule ? "Editar regra" : "Nova regra de limpeza"}</DialogTitle>
        <DialogDescription>Aplicada automaticamente aos próximos lançamentos importados.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="rule-pattern">Título contém</Label>
        <Input id="rule-pattern" className="num" value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="ex.: ifd*" autoFocus />
        <p className="text-xs text-muted-foreground">{needle ? `${sample.length} lançamento(s) existentes casam com este padrão.` : " "}</p>
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
          <Input id="rule-priority" type="number" className="num" value={priority} onChange={(event) => setPriority(event.target.value)} />
        </div>
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
