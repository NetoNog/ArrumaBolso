"use client";

import { AlertTriangle, Check, Plus } from "lucide-react";
import { cn } from "cn";

import { SimpleSelect } from "@/components/common/simple-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CARD_BRAND_LABEL, type Card, type CardBrand, type CardIssuer } from "@/lib/domain/types";
import { ISSUERS, issuerInfo, matchCard } from "@/lib/import/issuers";
import type { StatementDetection } from "@/lib/import/statement";

export type CardChoice =
  | { kind: "existing"; cardId: string }
  | {
      kind: "new";
      issuer: CardIssuer;
      brand: CardBrand | "";
      name: string;
      lastFour: string;
      closingDay: string;
      dueDay: string;
      creditLimit: string;
    };

/** New-card draft pre-filled with what the file revealed (bank and last four digits). */
export function newCardDraft(detection: StatementDetection): CardChoice {
  const issuer = detection.issuer ?? "other";
  return {
    kind: "new",
    issuer,
    brand: "",
    name: issuer === "other" ? "" : issuerInfo(issuer).label,
    lastFour: detection.lastFour ?? "",
    closingDay: "",
    dueDay: "",
    creditLimit: "",
  };
}

/** Initial choice for a freshly uploaded file: the matching active card, or a new card of the detected bank. */
export function initialCardChoice(cards: readonly Card[], detection: StatementDetection): CardChoice {
  const active = cards.filter((card) => !card.is_archived);
  const match = matchCard(active, detection.issuer, detection.lastFour);
  if (match) return { kind: "existing", cardId: match.id };
  if (!detection.issuer && active.length > 0) {
    const def = active.find((card) => card.is_default) ?? active[0];
    return { kind: "existing", cardId: def.id };
  }
  return newCardDraft(detection);
}

export function choiceIssuer(cards: readonly Card[], choice: CardChoice): CardIssuer | null {
  if (choice.kind === "new") return choice.issuer;
  return cards.find((card) => card.id === choice.cardId)?.issuer ?? null;
}

export function isChoiceValid(cards: readonly Card[], choice: CardChoice): boolean {
  if (choice.kind === "existing") return cards.some((card) => card.id === choice.cardId);
  return choice.name.trim().length > 0 && (choice.lastFour === "" || /^\d{4}$/.test(choice.lastFour));
}

const ISSUER_OPTIONS = ISSUERS.map((info) => ({ value: info.issuer, label: info.label }));
const BRAND_OPTIONS = [
  { value: "" as const, label: "Opcional" },
  ...(Object.keys(CARD_BRAND_LABEL) as CardBrand[]).map((value) => ({ value, label: CARD_BRAND_LABEL[value] })),
];

const TILE =
  "relative flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500";
const TILE_SELECTED = "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500 hover:bg-blue-50/60 dark:bg-blue-500/10";

export function CardPicker({
  cards,
  value,
  onChange,
  detection,
}: {
  cards: readonly Card[];
  value: CardChoice;
  onChange: (choice: CardChoice) => void;
  detection: StatementDetection;
}) {
  const visibleCards = cards.filter((card) => !card.is_archived || (value.kind === "existing" && value.cardId === card.id));
  const selectedCard = value.kind === "existing" ? cards.find((card) => card.id === value.cardId) : undefined;
  const mismatch =
    detection.issuer !== null && selectedCard !== undefined && selectedCard.issuer !== detection.issuer ? selectedCard : null;

  return (
    <fieldset className="grid min-w-0 gap-3">
      <legend className="mb-1.5 text-xs text-muted-foreground">Cartão da fatura</legend>

      <div role="radiogroup" aria-label="Cartão da fatura" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {visibleCards.map((card) => {
          const info = issuerInfo(card.issuer);
          const checked = value.kind === "existing" && value.cardId === card.id;
          return (
            <label key={card.id} className={cn(TILE, checked && TILE_SELECTED)}>
              <input
                type="radio"
                name="import-card"
                className="sr-only"
                checked={checked}
                onChange={() => onChange({ kind: "existing", cardId: card.id })}
              />
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: card.color }}
                aria-hidden
              >
                {info.label.charAt(0)}
              </span>
              <span className="grid min-w-0">
                <span className="truncate text-sm font-medium">{card.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {card.name === info.label ? "Cartão de crédito" : info.label}
                  {card.last_four ? <span className="num"> • final {card.last_four}</span> : null}
                  {card.closing_day ? <span className="num"> • fecha {card.closing_day}</span> : null}
                </span>
              </span>
              {checked ? <Check className="ml-auto size-4 shrink-0 text-blue-600" aria-hidden /> : null}
            </label>
          );
        })}

        <label className={cn(TILE, "border-dashed", value.kind === "new" && TILE_SELECTED)}>
          <input
            type="radio"
            name="import-card"
            className="sr-only"
            checked={value.kind === "new"}
            onChange={() => onChange(newCardDraft(detection))}
          />
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground" aria-hidden>
            <Plus className="size-4" />
          </span>
          <span className="grid min-w-0">
            <span className="text-sm font-medium">Novo cartão</span>
            <span className="truncate text-xs text-muted-foreground">
              {visibleCards.length === 0 ? "Cadastre o cartão desta fatura" : "Cadastrar outro cartão"}
            </span>
          </span>
          {value.kind === "new" ? <Check className="ml-auto size-4 shrink-0 text-blue-600" aria-hidden /> : null}
        </label>
      </div>

      {mismatch && detection.issuer ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Este arquivo parece ser do {issuerInfo(detection.issuer).label}, mas o cartão escolhido é do {issuerInfo(mismatch.issuer).label}.
          Confira antes de continuar.
        </p>
      ) : null}

      {value.kind === "new" ? (
        <div className="grid gap-3 rounded-xl border bg-muted/20 p-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_6rem]">
            <div className="grid gap-1.5">
              <Label htmlFor="new-card-issuer" className="text-xs text-muted-foreground">
                Banco
              </Label>
              <SimpleSelect
                id="new-card-issuer"
                className="w-full"
                value={value.issuer}
                options={ISSUER_OPTIONS}
                onChange={(issuer) => {
                  const previousDefault = issuerInfo(value.issuer).label;
                  const keepName = value.name.trim() !== "" && value.name !== previousDefault;
                  onChange({ ...value, issuer, name: keepName ? value.name : issuer === "other" ? "" : issuerInfo(issuer).label });
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-card-name" className="text-xs text-muted-foreground">
                Apelido
              </Label>
              <Input
                id="new-card-name"
                maxLength={60}
                placeholder="Ex.: Inter Black"
                value={value.name}
                aria-invalid={value.name.trim() === ""}
                onChange={(event) => onChange({ ...value, name: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-card-last-four" className="text-xs text-muted-foreground">
                Final
              </Label>
              <Input
                id="new-card-last-four"
                className="num"
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
                value={value.lastFour}
                onChange={(event) => onChange({ ...value, lastFour: event.target.value.replace(/\D/g, "").slice(0, 4) })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="grid gap-1.5">
              <Label htmlFor="new-card-brand" className="text-xs text-muted-foreground">
                Bandeira
              </Label>
              <SimpleSelect
                id="new-card-brand"
                className="w-full"
                value={value.brand}
                options={BRAND_OPTIONS}
                onChange={(brand) => onChange({ ...value, brand })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-card-closing" className="text-xs text-muted-foreground">
                Dia fechamento
              </Label>
              <Input
                id="new-card-closing"
                type="number"
                min={1}
                max={28}
                className="num"
                placeholder="Padrão"
                value={value.closingDay}
                onChange={(event) => onChange({ ...value, closingDay: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-card-due" className="text-xs text-muted-foreground">
                Dia vencimento
              </Label>
              <Input
                id="new-card-due"
                type="number"
                min={1}
                max={31}
                className="num"
                placeholder="Opcional"
                value={value.dueDay}
                onChange={(event) => onChange({ ...value, dueDay: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-card-limit" className="text-xs text-muted-foreground">
                Limite (R$)
              </Label>
              <Input
                id="new-card-limit"
                inputMode="decimal"
                className="num"
                placeholder="Opcional"
                value={value.creditLimit}
                onChange={(event) => onChange({ ...value, creditLimit: event.target.value })}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {value.name.trim() === ""
              ? "Dê um apelido ao cartão para continuar."
              : "O cartão será cadastrado quando você confirmar a importação."}
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
