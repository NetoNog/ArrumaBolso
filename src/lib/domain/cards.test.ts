import { describe, expect, it } from "vitest";

import { emptyState } from "@/lib/data/initial-state";
import {
  archiveCard,
  closingDayForCard,
  createCard,
  createTransaction,
  defaultCardId,
  payCardInvoice,
  upsertCard,
} from "@/lib/domain/operations";
import {
  annualAnalytics,
  bestCardToBuyToday,
  buildAlerts,
  cardMonthlySummary,
} from "@/lib/finance/metrics";
import { parseStatementCsv } from "@/lib/import/csv";

describe("credit card system upgrades", () => {
  it("enforces single default card, supports archiving without losing history, and inherits config on subcards", () => {
    let state = emptyState();
    const c1 = createCard(state, {
      name: "Nubank UV",
      issuer: "nubank",
      brand: "mastercard",
      last_four: "1111",
      color: "#820AD1",
      closing_day: 20,
      due_day: 28,
      credit_limit: 5000,
      is_default: true,
      cashback_rate: 1,
      waiver_monthly_spend: 5000,
    });
    state = c1.state;
    const c2 = createCard(state, {
      name: "Itaú Black",
      issuer: "itau",
      brand: "visa",
      last_four: "2222",
      color: "#EC7000",
      closing_day: 5,
      due_day: 12,
      credit_limit: 10000,
      is_default: true,
    });
    state = c2.state;
    expect(defaultCardId(state)).toBe(c2.card.id);
    expect(state.cards.find((c) => c.id === c1.card.id)?.is_default).toBe(false);

    // Virtual subcard inherits parent closing day (20) & limit (5000).
    const virtual = createCard(state, {
      name: "Virtual Assinaturas",
      issuer: "nubank",
      last_four: "9999",
      color: "#820AD1",
      parent_card_id: c1.card.id,
      holder_name: "Assinaturas",
    });
    state = virtual.state;
    expect(closingDayForCard(state, virtual.card.id)).toBe(20);

    // Archive default card -> clears default and falls back to remaining active card.
    state = archiveCard(state, c2.card.id, true);
    expect(state.cards.find((c) => c.id === c2.card.id)?.is_archived).toBe(true);
    expect(defaultCardId(state)).toBe(c1.card.id);

    // Update parent card back to default.
    state = upsertCard(state, { ...c1.card, is_default: true });
    expect(defaultCardId(state)).toBe(c1.card.id);
  });

  it("tracks real limit (unpaid past + open + future + subcards), fee waiver, cashback, 1-click payment and alerts", () => {
    let state = emptyState();
    const main = createCard(state, {
      name: "Nubank",
      issuer: "nubank",
      brand: "mastercard",
      last_four: "1234",
      color: "#820AD1",
      closing_day: 10,
      due_day: 27,
      credit_limit: 2000,
      cashback_rate: 1.5,
      points_per_dollar: 2.2,
      annual_fee: 480,
      waiver_monthly_spend: 1500,
    });
    state = main.state;
    const sub = createCard(state, {
      name: "Virtual Delivery",
      issuer: "nubank",
      last_four: "5678",
      color: "#820AD1",
      parent_card_id: main.card.id,
    });
    state = sub.state;

    // Unpaid past invoice (2026-11): R$ 600
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      card_id: main.card.id,
      date: "2026-10-15",
      invoice_month: "2026-11",
      title: "Compra passada",
      amount: 600,
      category_id: null,
      notes: "",
      recurrence: { kind: "single" },
    });
    // Current month (2026-12): R$ 800 on main + R$ 300 on virtual subcard = R$ 1.100
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      card_id: main.card.id,
      date: "2026-11-12",
      invoice_month: "2026-12",
      title: "Compra atual",
      amount: 800,
      category_id: null,
      notes: "",
      recurrence: { kind: "single" },
    });
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      card_id: sub.card.id,
      date: "2026-11-15",
      invoice_month: "2026-12",
      title: "iFood Virtual",
      amount: 300,
      category_id: null,
      notes: "",
      recurrence: { kind: "single" },
    });

    // Real used limit = 600 (unpaid past) + 1100 (open family) = 1700 / 2000 = 85%!
    const summary = cardMonthlySummary(state, main.card, "2026-12", "2026-11-24");
    expect(summary.spent).toBe(1100);
    expect(summary.unpaidPastBalance).toBe(600);
    expect(summary.totalUsed).toBe(1700);
    expect(summary.limitAvailable).toBe(300);
    expect(summary.subcards[0].spent).toBe(300);
    expect(summary.waiverRemaining).toBe(400);
    expect(summary.estimatedCashback).toBeCloseTo(16.5, 2);

    // Alerts fire for both >=80% limit AND due date in 3 days (Nov 24 -> Nov 27)!
    const alerts = buildAlerts(state, "2026-12", "2026-11-24");
    expect(alerts.some((a) => a.kind === "card_limit")).toBe(true);
    expect(alerts.some((a) => a.kind === "invoice_due")).toBe(true);

    // 1-click pay current invoice reduces limit usage & marks invoice paid.
    state = payCardInvoice(state, {
      invoice_month: "2026-12",
      card_id: main.card.id,
      amount: 1100,
      date: "2026-11-24",
    });
    const afterPay = cardMonthlySummary(state, main.card, "2026-12", "2026-11-24");
    expect(afterPay.isPaid).toBe(true);
    expect(afterPay.totalUsed).toBe(600);
  });

  it("ranks the best card to buy today by longest grace period", () => {
    let state = emptyState();
    // On Nov 24: Card A closes on day 25 (1 day left, short grace) vs Card B closed on day 20 (closes Dec 20, long grace!)
    const cardA = createCard(state, {
      name: "Fecha amanhã",
      issuer: "inter",
      last_four: null,
      color: "#FF7A00",
      closing_day: 25,
      due_day: 2,
    });
    state = cardA.state;
    const cardB = createCard(state, {
      name: "Acabou de fechar",
      issuer: "nubank",
      last_four: null,
      color: "#820AD1",
      closing_day: 20,
      due_day: 28,
    });
    state = cardB.state;

    const ranked = bestCardToBuyToday(state, "2026-11-24");
    expect(ranked[0].card.id).toBe(cardB.card.id);
    expect(ranked[0].daysUntilPayment).toBeGreaterThan(ranked[1].daysUntilPayment);
  });

  it("captures foreign-currency columns from bank CSV and summarizes cards & international IOF in analytics", async () => {
    const bradescoCsv = `Data;Histórico;Valor (US$);Valor (R$)
10/11/2026;GITHUB.COM;10,00;58,00
10/11/2026;IOF COMPRA EXTERIOR;0,00;2,54
12/11/2026;PADARIA REAL;0,00;20,00`;

    const parsed = await parseStatementCsv(bradescoCsv, { issuer: "bradesco" });
    expect(parsed.rows[0].originalCurrency).toBe("USD");
    expect(parsed.rows[0].originalAmount).toBe(10);

    let state = emptyState();
    const card = createCard(state, { name: "Bradesco", issuer: "bradesco", last_four: null, color: "#CC092F", cashback_rate: 1 });
    state = card.state;
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      card_id: card.card.id,
      date: "2026-11-10",
      invoice_month: "2026-12",
      title: "GitHub",
      amount: 58,
      category_id: null,
      notes: "",
      original_currency: "USD",
      original_amount: 10,
      iof_amount: 2.54,
      recurrence: { kind: "single" },
    });

    const analytics = annualAnalytics(state, "2026-12", 12);
    expect(analytics.cardComparison[0].card.id).toBe(card.card.id);
    expect(analytics.cardComparison[0].total).toBe(58);
    expect(analytics.internationalSummary.count).toBe(1);
    expect(analytics.internationalSummary.totalIOF).toBe(2.54);
    expect(analytics.internationalSummary.byCurrency[0]).toMatchObject({ currency: "USD", originalTotal: 10 });
  });
});

