"use client";

import { Archive, ArchiveRestore, CreditCard, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

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
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { archiveCard, deleteCard, upsertCard } from "@/lib/domain/operations";
import { CARD_BRAND_LABEL, type Card as CreditCardEntity, type CardBrand, type CardIssuer } from "@/lib/domain/types";
import { ISSUERS, issuerInfo } from "@/lib/import/issuers";
import { formatBRL, parseAmount } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

const ISSUER_OPTIONS = ISSUERS.map((info) => ({ value: info.issuer, label: info.label }));
const BRAND_OPTIONS = [
  { value: "" as const, label: "Sem bandeira" },
  ...(Object.keys(CARD_BRAND_LABEL) as CardBrand[]).map((value) => ({ value, label: CARD_BRAND_LABEL[value] })),
];
const CARD_COLORS = ["#820AD1", "#EC7000", "#FF7A00", "#CC092F", "#EA1D25", "#242424", "#1D4ED8", "#0F766E", "#10B981", "#64748B"];
const NO_PARENT = "__none__";

type Editing = { open: false } | { open: true; card: CreditCardEntity | null };

/** Registers, edits and archives credit cards (including virtual/additional subcards, benefits & fee waiver). */
export function CardsSettings() {
  const { state, commit } = useFinance();
  const [editing, setEditing] = useState<Editing>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<CreditCardEntity | null>(null);

  const usage = (card: CreditCardEntity) => state.transactions.filter((tx) => tx.card_id === card.id).length;
  const active = state.cards.filter((card) => !card.is_archived);
  const archived = state.cards.filter((card) => card.is_archived);
  const byId = new Map(state.cards.map((card) => [card.id, card]));

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    commit((current) => deleteCard(current, target.id));
    setDeleteTarget(null);
    toast.success("Cartão removido", { description: "Os lançamentos continuam, apenas sem cartão vinculado." });
  }

  function toggleArchive(card: CreditCardEntity, nextArchived: boolean) {
    commit((current) => archiveCard(current, card.id, nextArchived));
    toast.success(nextArchived ? "Cartão arquivado" : "Cartão reativado", {
      description: nextArchived ? "Histórico preservado; oculto para novos lançamentos." : card.name,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="size-4 text-muted-foreground" /> Cartões de Crédito
        </CardTitle>
        <CardDescription>
          Gerencie cartões titulares, virtuais/adicionais, bandeira, limite, fechamento, cashback e meta de isenção de anuidade.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setEditing({ open: true, card: null })}>
            <Plus /> Novo cartão
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cartão ativo cadastrado ainda.</p>
        ) : (
          <ul className="grid gap-2">
            {active.map((card) => {
              const parent = card.parent_card_id ? byId.get(card.parent_card_id) : undefined;
              return (
                <li
                  key={card.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                    parent && "ml-5 border-dashed",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: card.color }} aria-hidden />
                    <div className="grid min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">{card.name}</span>
                        {card.last_four ? <span className="num text-muted-foreground">•{card.last_four}</span> : null}
                        {card.brand ? <Pill tone="slate">{CARD_BRAND_LABEL[card.brand]}</Pill> : null}
                        {card.is_default ? (
                          <Pill tone="amber">
                            <Star className="mr-0.5 inline size-3" /> Padrão
                          </Pill>
                        ) : null}
                        {parent ? <Pill tone="blue">Subcartão de {parent.name}</Pill> : null}
                      </span>
                      <span className="num text-xs text-muted-foreground">
                        {issuerInfo(card.issuer).label}
                        {card.holder_name ? ` • ${card.holder_name}` : ""}
                        {" • "}
                        {usage(card)} lançamento(s)
                        {!parent ? ` • fecha dia ${card.closing_day ?? state.settings.closing_day}` : ""}
                        {!parent && card.due_day ? ` • vence dia ${card.due_day}` : ""}
                        {!parent && card.credit_limit ? ` • limite ${formatBRL(card.credit_limit)}` : ""}
                        {card.cashback_rate ? ` • ${card.cashback_rate}% cashback` : ""}
                        {card.points_per_dollar ? ` • ${card.points_per_dollar} pts/US$` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon-sm" aria-label={`Editar ${card.name}`} onClick={() => setEditing({ open: true, card })}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Arquivar cartão (mantém histórico)"
                      aria-label={`Arquivar ${card.name}`}
                      onClick={() => toggleArchive(card, true)}
                    >
                      <Archive />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remover ${card.name}`} onClick={() => setDeleteTarget(card)}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {archived.length > 0 ? (
          <div className="grid gap-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Arquivados ({archived.length})</p>
            <ul className="grid gap-2">
              {archived.map((card) => (
                <li key={card.id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 opacity-70">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: card.color }} />
                    <span className="truncate text-sm">
                      {card.name}
                      {card.last_four ? ` •${card.last_four}` : ""} ({usage(card)} lançamentos)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => toggleArchive(card, false)}>
                      <ArchiveRestore className="size-3.5" /> Reativar
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remover ${card.name}`} onClick={() => setDeleteTarget(card)}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>

      <Dialog open={editing.open} onOpenChange={(open) => !open && setEditing({ open: false })}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {editing.open ? <CardForm key={editing.card?.id ?? "new"} card={editing.card} onDone={() => setEditing({ open: false })} /> : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => (!open ? setDeleteTarget(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o cartão “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Os {deleteTarget ? usage(deleteTarget) : 0} lançamento(s) vinculados continuam no app, apenas sem cartão. Se quiser apenas escondê-lo mantendo o histórico, use Arquivar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmDelete}>
              Remover cartão
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function CardForm({ card, onDone }: { card: CreditCardEntity | null; onDone: () => void }) {
  const { state, commit } = useFinance();
  const [issuer, setIssuer] = useState<CardIssuer>(card?.issuer ?? "nubank");
  const [brand, setBrand] = useState<CardBrand | "">(card?.brand ?? "");
  const [name, setName] = useState(card?.name ?? issuerInfo("nubank").label);
  const [color, setColor] = useState(card?.color ?? issuerInfo("nubank").color);
  const [lastFour, setLastFour] = useState(card?.last_four ?? "");
  const [isDefault, setIsDefault] = useState(Boolean(card?.is_default));
  const [parentId, setParentId] = useState<string>(card?.parent_card_id ?? NO_PARENT);
  const [holderName, setHolderName] = useState(card?.holder_name ?? "");
  const [closingDay, setClosingDay] = useState(card?.closing_day ? String(card.closing_day) : "");
  const [dueDay, setDueDay] = useState(card?.due_day ? String(card.due_day) : "");
  const [limitText, setLimitText] = useState(card?.credit_limit ? card.credit_limit.toFixed(2).replace(".", ",") : "");
  const [cashbackText, setCashbackText] = useState(card?.cashback_rate ? String(card.cashback_rate).replace(".", ",") : "");
  const [pointsText, setPointsText] = useState(card?.points_per_dollar ? String(card.points_per_dollar).replace(".", ",") : "");
  const [annualFeeText, setAnnualFeeText] = useState(card?.annual_fee ? card.annual_fee.toFixed(2).replace(".", ",") : "");
  const [waiverText, setWaiverText] = useState(
    card?.waiver_monthly_spend ? card.waiver_monthly_spend.toFixed(2).replace(".", ",") : "",
  );
  const [error, setError] = useState<string | null>(null);

  const parentCandidates = state.cards.filter((item) => !item.is_archived && !item.parent_card_id && item.id !== card?.id);
  const parentOptions = [
    { value: NO_PARENT, label: "Cartão titular (principal)" },
    ...parentCandidates.map((item) => ({ value: item.id, label: `Virtual / adicional de ${item.name}` })),
  ];
  const isSubcard = parentId !== NO_PARENT;

  function changeIssuer(next: CardIssuer) {
    const previousDefault = issuerInfo(issuer).label;
    if (name.trim() === "" || name === previousDefault) setName(next === "other" ? "" : issuerInfo(next).label);
    if (color === issuerInfo(issuer).color) setColor(issuerInfo(next).color);
    setIssuer(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Dê um apelido ao cartão.");
    if (lastFour !== "" && !/^\d{4}$/.test(lastFour)) return setError("O final do cartão deve ter 4 dígitos.");
    const parsedClosing = closingDay.trim() === "" ? null : Number(closingDay);
    if (parsedClosing !== null && (!Number.isInteger(parsedClosing) || parsedClosing < 1 || parsedClosing > 28)) {
      return setError("Dia de fechamento deve ficar entre 1 e 28.");
    }
    const parsedDue = dueDay.trim() === "" ? null : Number(dueDay);
    if (parsedDue !== null && (!Number.isInteger(parsedDue) || parsedDue < 1 || parsedDue > 31)) {
      return setError("Dia de vencimento deve ficar entre 1 e 31.");
    }
    const parsedLimit = limitText.trim() === "" ? null : parseAmount(limitText);
    const parsedCashback = cashbackText.trim() === "" ? null : parseAmount(cashbackText);
    const parsedPoints = pointsText.trim() === "" ? null : parseAmount(pointsText);
    const parsedFee = annualFeeText.trim() === "" ? null : parseAmount(annualFeeText);
    const parsedWaiver = waiverText.trim() === "" ? null : parseAmount(waiverText);
    if (parsedCashback !== null && (parsedCashback < 0 || parsedCashback > 100)) return setError("Cashback deve ficar entre 0% e 100%.");

    commit((current) =>
      upsertCard(current, {
        id: card?.id,
        name: trimmed,
        issuer,
        brand: brand || null,
        last_four: lastFour || null,
        color,
        is_default: isDefault,
        is_archived: card?.is_archived ?? false,
        parent_card_id: isSubcard ? parentId : null,
        holder_name: holderName.trim() || null,
        closing_day: isSubcard ? null : parsedClosing,
        due_day: isSubcard ? null : parsedDue,
        credit_limit: isSubcard ? null : parsedLimit,
        cashback_rate: isSubcard ? null : parsedCashback,
        points_per_dollar: isSubcard ? null : parsedPoints,
        annual_fee: isSubcard ? null : parsedFee,
        waiver_monthly_spend: isSubcard ? null : parsedWaiver,
      }),
    );
    toast.success(card ? "Cartão atualizado" : "Cartão cadastrado", { description: trimmed });
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{card ? "Editar cartão" : "Novo cartão"}</DialogTitle>
        <DialogDescription>Configure ciclo, limite, subcartão virtual/adicional e benefícios do cartão.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cf-issuer">Banco</Label>
          <SimpleSelect id="cf-issuer" className="w-full" value={issuer} options={ISSUER_OPTIONS} onChange={changeIssuer} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cf-brand">Bandeira</Label>
          <SimpleSelect id="cf-brand" className="w-full" value={brand} options={BRAND_OPTIONS} onChange={setBrand} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cf-name">Apelido</Label>
          <Input id="cf-name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Nubank Ultravioleta" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cf-last4">Final (4 díg.)</Label>
          <Input
            id="cf-last4"
            className="num"
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            value={lastFour}
            onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Cor do cartão</Label>
        <div className="flex flex-wrap gap-2">
          {CARD_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              aria-label={`Cor ${swatch}`}
              className={cn("size-6 rounded-full ring-offset-2 ring-offset-background", color === swatch && "ring-2 ring-foreground")}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
      </div>

      {parentCandidates.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Tipo / Vínculo</Label>
            <SimpleSelect value={parentId} options={parentOptions} onChange={setParentId} className="w-full" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cf-holder">Portador / Uso (opcional)</Label>
            <Input
              id="cf-holder"
              maxLength={60}
              value={holderName}
              onChange={(event) => setHolderName(event.target.value)}
              placeholder={isSubcard ? "Ex.: Virtual Assinaturas, Adicional" : "Ex.: Titular"}
            />
          </div>
        </div>
      ) : null}

      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
        <Checkbox checked={isDefault} onCheckedChange={(checked) => setIsDefault(Boolean(checked))} />
        Definir como cartão padrão (pré-selecionado em “Novo Gasto”)
      </label>

      {!isSubcard ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cf-closing">Fechamento</Label>
              <Input id="cf-closing" type="number" min={1} max={28} className="num" placeholder="Padrão" value={closingDay} onChange={(event) => setClosingDay(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cf-due">Vencimento</Label>
              <Input id="cf-due" type="number" min={1} max={31} className="num" placeholder="Opcional" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cf-limit">Limite (R$)</Label>
              <Input id="cf-limit" inputMode="decimal" className="num" placeholder="5.000,00" value={limitText} onChange={(event) => setLimitText(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">Benefícios & Anuidade (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cf-cb">Cashback (%)</Label>
                <Input id="cf-cb" inputMode="decimal" className="num" placeholder="Ex.: 1,0" value={cashbackText} onChange={(event) => setCashbackText(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cf-pts">Pontos por US$</Label>
                <Input id="cf-pts" inputMode="decimal" className="num" placeholder="Ex.: 2,2" value={pointsText} onChange={(event) => setPointsText(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cf-fee">Anuidade anual (R$)</Label>
                <Input id="cf-fee" inputMode="decimal" className="num" placeholder="Ex.: 588,00" value={annualFeeText} onChange={(event) => setAnnualFeeText(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cf-waiver">Gasto/mês p/ isenção (R$)</Label>
                <Input id="cf-waiver" inputMode="decimal" className="num" placeholder="Ex.: 5.000,00" value={waiverText} onChange={(event) => setWaiverText(event.target.value)} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Este subcartão herda automaticamente o dia de fechamento, vencimento, limite e benefícios do cartão titular.
        </p>
      )}

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
