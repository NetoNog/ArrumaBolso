/**
 * Natural-language Quick Add parser for zero-friction daily expense tracking.
 *
 * Examples:
 *   "45,90 padaria pix #cafe"        -> R$ 45,90, Padaria, pix_debit, auto-category, [#cafe]
 *   "uber 22,50 credito"             -> R$ 22,50, Uber, credit_card (default card), Transporte
 *   "+1200 freela cliente pix"       -> R$ 1.200,00, income, Freela Cliente, pix_debit
 *   "35 almoço dinheiro #trabalho"   -> R$ 35,00, Almoço, cash, Alimentação, [#trabalho]
 */
import { categorize } from "@/lib/categorization";
import { activeCards, defaultCardId, normalizeTags } from "@/lib/domain/operations";
import type { FinanceState, PaymentMethod, PetExpenseKind, TransactionType } from "@/lib/domain/types";
import { normalizeText } from "@/lib/import/issuers";
import { autoSuggestCategory, findCategoryForPreset, inferPetExpenseKind, presetCategoryId, presetFromCategoryId } from "@/lib/import/merchant-categories";
import { parseAmount } from "@/lib/money";

export interface ParsedQuickAdd {
  amount: number;
  type: TransactionType;
  title: string;
  paymentMethod: PaymentMethod;
  cardId: string | null;
  accountId: string | null;
  petId: string | null;
  petName: string | null;
  petExpenseKind: PetExpenseKind | null;
  categoryId: string | null;
  categoryLabel: string | null;
  tags: string[];
}

const METHOD_KEYWORDS: readonly [RegExp, PaymentMethod][] = [
  [/^(?:pix|debito|d[eé]bito|ted|doc)$/i, "pix_debit"],
  [/^(?:dinheiro|especie|esp[eé]cie|cash)$/i, "cash"],
  [/^(?:boleto|conta)$/i, "boleto"],
  [/^(?:cr[eé]dito|credito|cart[aã]o|cartao|cc)$/i, "credit_card"],
];

function capitalizeWords(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function parseQuickAdd(input: string, state: FinanceState): ParsedQuickAdd | null {
  const raw = input.trim();
  if (!raw) return null;

  const tokens = raw.split(/\s+/);
  let amount: number | null = null;
  let type: TransactionType = "expense";
  let paymentMethod: PaymentMethod | null = null;
  let cardId: string | null = null;
  let accountId: string | null = null;
  let petId: string | null = null;
  let petName: string | null = null;
  const tags: string[] = [];
  const titleTokens: string[] = [];

  const cards = activeCards(state);
  const accounts = (state.accounts ?? []).filter((acc) => !acc.is_archived);
  const pets = (state.pets ?? []).filter((pet) => !pet.is_archived);

  for (const token of tokens) {
    // 1. #tag
    if (token.startsWith("#") && token.length > 1) {
      tags.push(token.slice(1));
      continue;
    }

    // 2. First numeric token is the amount (supports "+500", "R$45,90", "45,90", "1.200,50")
    if (amount === null) {
      const cleaned = token.replace(/^r\$/i, "");
      if (/^[+]?\d[\d.,]*$/.test(cleaned)) {
        const parsed = parseAmount(cleaned.replace(/^\+/, ""));
        if (parsed !== null && parsed > 0) {
          amount = parsed;
          if (cleaned.startsWith("+")) type = "income";
          continue;
        }
      }
    }

    // 3. Payment method keyword
    if (paymentMethod === null) {
      const matchedMethod = METHOD_KEYWORDS.find(([re]) => re.test(token));
      if (matchedMethod) {
        paymentMethod = matchedMethod[1];
        continue;
      }
    }

    // 4. Explicit card name match (e.g. "nubank", "itau", "inter")
    const normToken = normalizeText(token);
    if (normToken.length >= 3 && !cardId) {
      const matchedCard = cards.find((card) => normalizeText(card.name) === normToken);
      if (matchedCard) {
        paymentMethod = "credit_card";
        cardId = matchedCard.id;
        continue;
      }
    }

    // 5. Explicit account name match (e.g. "va", "vr", "nuconta")
    if (normToken.length >= 2 && !accountId) {
      const matchedAccount = accounts.find(
        (acc) =>
          normalizeText(acc.name) === normToken ||
          (acc.kind === "voucher" && (normToken === "va" || normToken === "vr" || normToken === "vale")),
      );
      if (matchedAccount) {
        accountId = matchedAccount.id;
        paymentMethod ??= matchedAccount.kind === "cash" ? "cash" : "pix_debit";
        continue;
      }
    }

    // 6. Explicit pet name match (e.g. "120 ração rex pix")
    if (normToken.length >= 2 && !petId) {
      const matchedPet = pets.find((pet) => normalizeText(pet.name) === normToken);
      if (matchedPet) {
        petId = matchedPet.id;
        petName = matchedPet.name;
        continue;
      }
    }

    titleTokens.push(token);
  }

  if (amount === null || amount <= 0) return null;
  const title = capitalizeWords(titleTokens.join(" ")) || (petName ? `Gasto ${petName}` : type === "income" ? "Entrada rápida" : "Gasto rápido");
  const finalMethod: PaymentMethod = paymentMethod ?? (type === "income" ? "pix_debit" : "pix_debit");
  const finalCardId = finalMethod === "credit_card" ? (cardId ?? defaultCardId(state)) : null;
  const finalAccountId =
    finalMethod !== "credit_card"
      ? (accountId ?? accounts.find((acc) => (finalMethod === "cash" ? acc.kind === "cash" : acc.kind === "checking"))?.id ?? accounts[0]?.id ?? null)
      : null;

  let categoryId: string | null = null;
  let categoryLabel: string | null = null;
  if (type === "expense") {
    const fromRule = categorize(title, state.categorization_rules, { amount, paymentMethod: finalMethod });
    const rawId =
      fromRule.categoryId ??
      autoSuggestCategory({
        rawTitle: title,
        cleanTitle: title,
        bankCategory: null,
        categories: state.categories,
        transactions: state.transactions,
      }).categoryId ??
      (petId ? presetCategoryId("pets") : null);

    if (rawId) {
      const preset = presetFromCategoryId(rawId);
      if (preset) {
        const existing = findCategoryForPreset(state.categories, preset);
        categoryId = existing?.id ?? rawId;
        categoryLabel = existing?.name ?? preset.name;
      } else {
        categoryId = rawId;
        categoryLabel = state.categories.find((cat) => cat.id === rawId)?.name ?? null;
      }
    }
  }

  return {
    amount,
    type,
    title,
    paymentMethod: finalMethod,
    cardId: finalCardId,
    accountId: finalAccountId,
    petId,
    petName,
    petExpenseKind: petId ? inferPetExpenseKind(title) : null,
    categoryId,
    categoryLabel,
    tags: normalizeTags(tags),
  };
}

