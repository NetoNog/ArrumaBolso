import { describe, expect, it } from "vitest";

import { emptyState } from "@/lib/data/initial-state";
import {
  createTransaction,
  updateSettings,
  upsertAccount,
  upsertCard,
  upsertCategory,
  upsertIncomeSource,
  upsertPet,
  upsertSubscription,
} from "@/lib/domain/operations";
import { buildAlerts } from "@/lib/finance/metrics";
import { DEFAULT_NOTIFICATION_PREFS, filterAlertsByPrefs, maskCurrencyText } from "@/lib/notifications";

describe("Enhanced Notification & Alert System", () => {
  it("generates critical/warning alerts for negative free balance, exceeded budget, overdue income, upcoming subscription, and pet budget", () => {
    let state = updateSettings(emptyState(), { closing_day: 25 });
    state = upsertCategory(state, { name: "Restaurantes", color: "#F97316", icon: "utensils", monthly_limit: 200 });
    const catId = state.categories[0].id;

    state = upsertAccount(state, { name: "Conta Corrente", kind: "checking", initial_balance: 100, color: "#4070F4", is_archived: false });
    state = upsertCard(state, { name: "Nubank", issuer: "nubank", last_four: "1234", color: "#820AD1", closing_day: 25, due_day: 20, credit_limit: 400 });
    const cardId = state.cards[0].id;
    state = upsertPet(state, { name: "Thor", species: "dog", breed: "Golden", birth_date: null, weight_kg: null, monthly_budget: 200, color: "#F59E0B", notes: "" });
    const petId = (state.pets ?? [])[0].id;

    state = upsertIncomeSource(state, {
      title: "Salário CLT",
      kind: "salary",
      expected_amount: 5000,
      pay_day: 5,
      active: true,
      frequency: "monthly",
    });

    state = upsertSubscription(state, {
      title: "Netflix",
      expected_amount: 55.9,
      category_id: catId,
      billing_day: 20,
      active: true,
      frequency: "monthly",
    });

    // Spend > category limit & > pet budget & > liquid balance
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      card_id: cardId,
      date: "2026-11-18",
      invoice_month: "2026-11",
      title: "Petz + Jantar",
      amount: 350,
      category_id: catId,
      pet_id: petId,
      pet_expense_kind: "food",
      notes: "",
      recurrence: { kind: "single" },
    });

    const alerts = buildAlerts(state, "2026-11", "2026-11-18");
    const kinds = new Set(alerts.map((a) => a.kind));

    expect(kinds.has("negative_free_balance")).toBe(true);
    expect(kinds.has("budget_exceeded")).toBe(true);
    expect(kinds.has("income_overdue")).toBe(true);
    expect(kinds.has("subscription_due")).toBe(true);
    expect(kinds.has("pet_budget")).toBe(true);
    expect(alerts[0].severity).toBe("critical");
  });

  it("groups 3+ active installments into a single summary alert to prevent alert fatigue", () => {
    let state = emptyState();
    for (let i = 1; i <= 4; i += 1) {
      state = createTransaction(state, {
        type: "expense",
        payment_method: "credit_card",
        date: "2026-11-05",
        invoice_month: "2026-11",
        title: `Compra Parcelada ${i}`,
        amount: 100,
        category_id: null,
        notes: "",
        recurrence: { kind: "installments", count: 6 },
      });
    }
    const alerts = buildAlerts(state, "2026-11", "2026-11-10");
    const installmentAlerts = alerts.filter((a) => a.kind === "installment");
    expect(installmentAlerts).toHaveLength(1);
    expect(installmentAlerts[0].title).toContain("4 parcelas");
  });

  it("respects granular category preferences and privacy currency masking", () => {
    let state = emptyState();
    state = upsertPet(state, { name: "Mia", species: "cat", breed: "", birth_date: null, weight_kg: null, monthly_budget: 100, color: "#F59E0B", notes: "" });
    const petId = (state.pets ?? [])[0].id;
    state = createTransaction(state, {
      type: "expense",
      payment_method: "pix_debit",
      date: "2026-11-10",
      invoice_month: "2026-11",
      title: "Ração Mia",
      amount: 120,
      category_id: null,
      pet_id: petId,
      notes: "",
      recurrence: { kind: "single" },
    });

    const alerts = buildAlerts(state, "2026-11", "2026-11-10");
    expect(alerts.some((a) => a.kind === "pet_budget")).toBe(true);

    const mutedPets = filterAlertsByPrefs(alerts, {
      ...DEFAULT_NOTIFICATION_PREFS,
      categories: { ...DEFAULT_NOTIFICATION_PREFS.categories, pets: false },
    });
    expect(mutedPets.some((a) => a.kind === "pet_budget")).toBe(false);

    expect(maskCurrencyText("Fatura vence com R$ 1.250,50 em aberto", true)).toBe("Fatura vence com R$ •••• em aberto");
    expect(maskCurrencyText("Saldo -R$ 320,00 negativo", true)).toBe("Saldo R$ •••• negativo");
    expect(maskCurrencyText("R$ 100,00", false)).toBe("R$ 100,00");
  });
});
