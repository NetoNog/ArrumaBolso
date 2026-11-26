import { describe, expect, it } from "vitest";

import { emptyState } from "@/lib/data/initial-state";
import { parseFinanceState } from "@/lib/data/repository";
import {
  createCard,
  createTransaction,
  deleteAccount,
  deleteCategory,
  deleteQuickTemplate,
  resolveOrCreatePresetCategory,
  transferBetweenAccounts,
  upsertAccount,
  upsertCategory,
  upsertQuickTemplate,
  upsertSubscription,
} from "@/lib/domain/operations";
import { parseQuickAdd } from "@/lib/domain/quick-add";
import {
  accountBalances,
  antExpensesAnalysis,
  cashFlowSummary,
  merchantProfile,
  nature503020Breakdown,
  realFreeBalance,
  spendingByWeekday,
  spendingCalendar,
} from "@/lib/finance/metrics";

describe("Personal finance tracker upgrades", () => {
  it("parses natural-language Quick Add with amount, method, card, account, tags and auto-category", () => {
    let state = emptyState();
    const cardRes = createCard(state, {
      name: "Nubank",
      issuer: "nubank",
      last_four: "1234",
      color: "#820AD1",
      is_default: true,
    });
    state = cardRes.state;
    state = upsertAccount(state, { name: "Conta Principal", kind: "checking", initial_balance: 1000, color: "#2563EB" });
    state = upsertAccount(state, { name: "Flash VR", kind: "voucher", initial_balance: 600, color: "#10B981" });
    const vrId = state.accounts![1].id;

    const parsed1 = parseQuickAdd("45,90 padaria pix #cafe #manha", state);
    expect(parsed1).not.toBeNull();
    expect(parsed1!.amount).toBe(45.9);
    expect(parsed1!.type).toBe("expense");
    expect(parsed1!.title).toBe("Padaria");
    expect(parsed1!.paymentMethod).toBe("pix_debit");
    expect(parsed1!.tags).toEqual(["cafe", "manha"]);
    expect(parsed1!.categoryId).toBeTruthy();

    const parsed2 = parseQuickAdd("uber 22,50 nubank", state);
    expect(parsed2!.paymentMethod).toBe("credit_card");
    expect(parsed2!.cardId).toBe(cardRes.card.id);
    expect(parsed2!.title).toBe("Uber");

    const parsed3 = parseQuickAdd("35 almoço vr", state);
    expect(parsed3!.accountId).toBe(vrId);
    expect(parsed3!.paymentMethod).toBe("pix_debit");

    const parsedIncome = parseQuickAdd("+1.250,00 freela cliente pix", state);
    expect(parsedIncome!.type).toBe("income");
    expect(parsedIncome!.amount).toBe(1250);
    expect(parsedIncome!.title).toBe("Freela Cliente");

    // Creating category from preset works idempotently.
    const resolved = resolveOrCreatePresetCategory(state, parsed1!.categoryId);
    expect(resolved.categoryId).toBeTruthy();
    expect(resolved.categoryId?.startsWith("preset:")).toBe(false);
    expect(resolved.state.categories.length).toBeGreaterThan(0);
  });

  it("computes 50/30/20 breakdown with subcategory nature inheritance and safe parent deletion", () => {
    let state = emptyState();
    state = upsertCategory(state, { name: "Moradia", color: "#2563EB", icon: "home", monthly_limit: 2000, nature: "essential" });
    const parentId = state.categories[0].id;
    state = upsertCategory(state, {
      name: "Energia",
      color: "#2563EB",
      icon: "zap",
      monthly_limit: 400,
      parent_id: parentId,
      nature: "essential",
    });
    const childId = state.categories[1].id;
    state = upsertCategory(state, { name: "Lazer", color: "#7C3AED", icon: "film", monthly_limit: 600, nature: "lifestyle" });
    const lazerId = state.categories[2].id;
    state = upsertCategory(state, { name: "Investimentos", color: "#10B981", icon: "piggy-bank", monthly_limit: 0, nature: "financial" });
    const finId = state.categories[3].id;

    state = createTransaction(state, {
      type: "expense",
      payment_method: "pix_debit",
      date: "2026-11-10",
      invoice_month: "2026-12",
      title: "Conta de Luz",
      amount: 500,
      category_id: childId,
      notes: "",
      recurrence: { kind: "single" },
    });
    state = createTransaction(state, {
      type: "expense",
      payment_method: "pix_debit",
      date: "2026-11-11",
      invoice_month: "2026-12",
      title: "Cinema",
      amount: 300,
      category_id: lazerId,
      notes: "",
      recurrence: { kind: "single" },
    });
    state = createTransaction(state, {
      type: "expense",
      payment_method: "pix_debit",
      date: "2026-11-12",
      invoice_month: "2026-12",
      title: "Tesouro Direto",
      amount: 200,
      category_id: finId,
      notes: "",
      recurrence: { kind: "single" },
    });

    const b = nature503020Breakdown(state, "2026-12");
    expect(b.essential).toBe(500);
    expect(b.lifestyle).toBe(300);
    expect(b.financial).toBe(200);
    expect(b.ratios.essential).toBeCloseTo(0.5);
    expect(b.ratios.lifestyle).toBeCloseTo(0.3);
    expect(b.ratios.financial).toBeCloseTo(0.2);

    // Deleting parent clears child.parent_id without deleting child.
    const afterDelete = deleteCategory(state, parentId, null);
    const childAfter = afterDelete.categories.find((c) => c.id === childId);
    expect(childAfter?.parent_id).toBeNull();
  });

  it("tracks account balances, internal transfers without inflating cash flow, and Saldo Livre Real", () => {
    let state = emptyState();
    state = upsertAccount(state, { name: "Conta Corrente", kind: "checking", initial_balance: 3000, color: "#2563EB" });
    state = upsertAccount(state, { name: "Reserva", kind: "savings", initial_balance: 1000, color: "#10B981" });
    const [checking, savings] = state.accounts!;

    const cardRes = createCard(state, {
      name: "Inter",
      issuer: "inter",
      last_four: "5678",
      color: "#F97316",
      closing_day: 25,
      due_day: 5,
    });
    state = cardRes.state;

    // Income into checking (+2000 -> 5000)
    state = createTransaction(state, {
      type: "income",
      payment_method: "pix_debit",
      account_id: checking.id,
      date: "2026-11-05",
      invoice_month: "2026-12",
      title: "Salário",
      amount: 2000,
      category_id: null,
      notes: "",
      recurrence: { kind: "single" },
    });

    // Internal transfer checking -> savings (500): checking 4500, savings 1500
    state = transferBetweenAccounts(state, {
      fromAccountId: checking.id,
      toAccountId: savings.id,
      amount: 500,
      date: "2026-11-06",
    });

    // Credit card expense of 800 (open invoice)
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      card_id: cardRes.card.id,
      date: "2026-11-10",
      invoice_month: "2026-12",
      title: "Supermercado",
      amount: 800,
      category_id: null,
      notes: "",
      recurrence: { kind: "single" },
    });

    // Pending boleto fixed bill of 200
    state = upsertSubscription(state, {
      title: "Internet Fibra",
      expected_amount: 200,
      category_id: null,
      billing_day: 20,
      active: true,
      payment_method: "boleto",
    });

    const balances = accountBalances(state);
    expect(balances.find((b) => b.account.id === checking.id)?.balance).toBe(4500);
    expect(balances.find((b) => b.account.id === savings.id)?.balance).toBe(1500);

    // Internal transfer must not inflate inflow or outflow
    const cf = cashFlowSummary(state, "2026-12");
    expect(cf.inflow).toBe(2000);
    expect(cf.outflow).toBe(800);

    // Saldo Livre Real = 4500 liquid - 800 open card invoice - 200 pending fixed bill = 3500
    const free = realFreeBalance(state, "2026-12", "2026-11-15");
    expect(free.liquidBalance).toBe(4500);
    expect(free.savingsBalance).toBe(1500);
    expect(free.openCardInvoices).toBe(800);
    expect(free.pendingFixedBills).toBe(200);
    expect(free.freeToSpend).toBe(3500);

    // Deleting an account unlinks transactions safely
    const afterDel = deleteAccount(state, checking.id);
    expect(afterDel.accounts?.length).toBe(1);
    expect(afterDel.transactions.every((tx) => tx.account_id !== checking.id)).toBe(true);
  });

  it("computes daily spending heatmap, ant expenses, weekday patterns and merchant X-Ray", () => {
    let state = emptyState();
    state.settings.closing_day = 1;

    const entries = [
      { date: "2026-11-02", title: "Padaria Central", amount: 15 },
      { date: "2026-11-03", title: "Padaria Central", amount: 22 },
      { date: "2026-11-03", title: "Café Expresso", amount: 12 },
      { date: "2026-11-05", title: "Supermercado", amount: 450 },
    ];
    for (const e of entries) {
      state = createTransaction(state, {
        type: "expense",
        payment_method: "pix_debit",
        date: e.date,
        invoice_month: "2026-12",
        title: e.title,
        amount: e.amount,
        category_id: null,
        notes: "",
        recurrence: { kind: "single" },
      });
    }

    const cal = spendingCalendar(state, "2026-12", "2026-11-10");
    expect(cal.activeDays).toBe(3);
    expect(cal.zeroSpendDays).toBe(7); // days 1..10 = 10 elapsed days, 3 active -> 7 zero-spend
    expect(cal.peakDay?.date).toBe("2026-11-05");
    expect(cal.peakDay?.level).toBe(4);

    const ants = antExpensesAnalysis(state, "2026-12", 30);
    expect(ants.count).toBe(3);
    expect(ants.total).toBe(49);
    expect(ants.annualized).toBe(588);
    expect(ants.topMerchants[0].merchant).toBe("Padaria Central");
    expect(ants.topMerchants[0].total).toBe(37);

    const weekdays = spendingByWeekday(state, "2026-12", 1);
    expect(weekdays).toHaveLength(7);
    expect(weekdays.reduce((acc, w) => acc + w.count, 0)).toBe(4);

    const xray = merchantProfile(state, "Padaria Central", "2026-12");
    expect(xray.count).toBe(2);
    expect(xray.total).toBe(37);
    expect(xray.min).toBe(15);
    expect(xray.max).toBe(22);
    expect(xray.average).toBe(18.5);
    expect(xray.monthlySeries).toHaveLength(12);
  });

  it("manages quick templates and upgrades legacy JSON backups cleanly", () => {
    let state = emptyState();
    state = upsertQuickTemplate(state, {
      title: "Café da manhã",
      amount: 18,
      type: "expense",
      payment_method: "pix_debit",
      category_id: null,
      card_id: null,
      account_id: null,
      tags: ["#cafe"],
    });
    expect(state.quick_templates?.length).toBe(1);
    expect(state.quick_templates![0].tags).toEqual(["cafe"]);

    state = deleteQuickTemplate(state, state.quick_templates![0].id);
    expect(state.quick_templates?.length).toBe(0);

    // Legacy backup missing accounts, quick_templates, line_items, receipt_path
    const legacy = {
      settings: emptyState().settings,
      categories: [{ id: "c1", name: "Geral", color: "#64748B", icon: "tag", monthly_limit: 500 }],
      cards: [],
      transactions: [],
      import_batches: [],
      deleted_csv_hashes: [],
      recurring_subscriptions: [],
      income_sources: [],
      categorization_rules: [],
    };
    const parsed = parseFinanceState(legacy);
    expect(parsed).not.toBeNull();
    expect(parsed!.accounts).toEqual([]);
    expect(parsed!.quick_templates).toEqual([]);
    expect(parsed!.categories[0].nature).toBe("lifestyle");
  });
});

