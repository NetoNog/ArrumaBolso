import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { categorize, isValidRulePattern } from "@/lib/categorization";
import { emptyState } from "@/lib/data/initial-state";
import { FETCH_PAGE_SIZE, SupabaseRepository, parseFinanceState } from "@/lib/data/repository";
import {
  anticipateInstallments,
  bulkAddTag,
  closingDayForCard,
  contributeSavingsGoal,
  createCard,
  createTransaction,
  parseTagInput,
  paySubscription,
  previewReapplyRules,
  reapplyRules,
  splitTransaction,
  updateInstallmentGroup,
  upsertCategory,
  upsertIncomeSource,
  upsertInvoiceReconciliation,
  upsertRule,
  upsertSavingsGoal,
  upsertSubscription,
} from "@/lib/domain/operations";
import {
  annualAnalytics,
  buildAlerts,
  cashFlowSummary,
  categoryBreakdown,
  committedFor,
  detectRecurringCandidates,
  expectedIncomeForMonth,
  invoiceTotal,
  subscriptionAppliesToMonth,
  suggestedCategoryLimits,
  transactionsToCsv,
} from "@/lib/finance/metrics";
import { detectStatement, parseStatement } from "@/lib/import/statement";

describe("power upgrades — domain, metrics, import & repository", () => {
  it("uses per-card closing day when creating credit card expenses", () => {
    const base = emptyState();
    const { state: s1, card } = createCard(base, {
      name: "Itaú",
      issuer: "itau",
      last_four: "1234",
      color: "#EC7000",
      closing_day: 15,
      due_day: 25,
      credit_limit: 8000,
    });
    expect(closingDayForCard(s1, card.id)).toBe(15);

    // Date 2026-11-10 is before closing_day 15 -> 2026-11 (would be 2026-12 with default closing_day 2).
    const s2 = createTransaction(s1, {
      type: "expense",
      payment_method: "credit_card",
      card_id: card.id,
      date: "2026-11-10",
      title: "Restaurante",
      amount: 120,
      category_id: null,
      notes: "",
      recurrence: { kind: "single" },
    });
    expect(s2.transactions[0].invoice_month).toBe("2026-11");
  });

  it("splits transactions across categories while preserving unique_hash on part 1", () => {
    let state = upsertCategory(emptyState(), { name: "Mercado", color: "#F97316", icon: "utensils", monthly_limit: 500 });
    state = upsertCategory(state, { name: "Pet", color: "#10B981", icon: "tag", monthly_limit: 200 });
    const [mercado, pet] = state.categories;
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      date: "2026-11-05",
      invoice_month: "2026-12",
      title: "Carrefour",
      amount: 300,
      category_id: mercado.id,
      notes: "",
      recurrence: { kind: "single" },
    });
    const original = { ...state.transactions[0], unique_hash: "a".repeat(64) };
    state = { ...state, transactions: [original] };

    const split = splitTransaction(state, original.id, [
      { category_id: mercado.id, amount: 220, clean_title: "Carrefour - Mercado" },
      { category_id: pet.id, amount: 80, clean_title: "Carrefour - Ração" },
    ]);
    expect(split.transactions).toHaveLength(2);
    expect(split.transactions[0].unique_hash).toBe("a".repeat(64));
    expect(split.transactions[1].unique_hash).toBeNull();
    expect(split.transactions[0].split_group_id).toBe(split.transactions[1].split_group_id);
    expect(invoiceTotal(split, "2026-12")).toBe(300);
  });

  it("offsets expense and category spend with linked reimbursements without inflating income", () => {
    let state = upsertCategory(emptyState(), { name: "Lazer", color: "#EAB308", icon: "tag", monthly_limit: 300 });
    const lazer = state.categories[0];
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      date: "2026-11-10",
      invoice_month: "2026-12",
      title: "Jantar com amigos",
      amount: 200,
      category_id: lazer.id,
      notes: "",
      recurrence: { kind: "single" },
    });
    const dinner = state.transactions[0];
    state = createTransaction(state, {
      type: "income",
      payment_method: "pix_debit",
      date: "2026-11-11",
      invoice_month: "2026-12",
      title: "Pix amigo",
      amount: 100,
      category_id: null,
      notes: "",
      refund_of_transaction_id: dinner.id,
      recurrence: { kind: "single" },
    });

    const summary = cashFlowSummary(state, "2026-12");
    expect(summary.inflow).toBe(0);
    expect(summary.outflow).toBe(100);
    expect(categoryBreakdown(state, "2026-12")[0].spent).toBe(100);
  });

  it("batch-edits and anticipates installment groups with discount", () => {
    let state = upsertCategory(emptyState(), { name: "Eletrônicos", color: "#2563EB", icon: "tag", monthly_limit: 0 });
    const cat = state.categories[0];
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      date: "2026-11-05",
      invoice_month: "2026-12",
      title: "Monitor",
      amount: 1000,
      category_id: null,
      notes: "",
      recurrence: { kind: "installments", count: 4 },
    });
    const groupId = state.transactions[0].installment_group_id as string;
    state = updateInstallmentGroup(state, groupId, { clean_title: "Monitor 4K", category_id: cat.id });
    expect(state.transactions.every((tx) => tx.clean_title === "Monitor 4K" && tx.category_id === cat.id)).toBe(true);

    // Anticipate parcels after 2026-12 (3 parcels = 750) with R$ 50 discount -> R$ 700 settlement in 2026-12.
    state = anticipateInstallments(state, groupId, "2026-12", 50, "2026-11-20");
    expect(state.transactions).toHaveLength(2);
    expect(state.transactions.every((tx) => tx.invoice_month === "2026-12")).toBe(true);
    expect(invoiceTotal(state, "2026-12")).toBe(950);
  });

  it("handles periodic subscriptions, 1-click payment, and recurring candidate detection", () => {
    let state = upsertSubscription(emptyState(), {
      title: "IPVA",
      expected_amount: 1200,
      category_id: null,
      billing_day: 15,
      active: true,
      frequency: "annual",
      billing_month: 1,
      payment_method: "boleto",
      card_id: null,
    });
    const ipva = state.recurring_subscriptions[0];
    expect(subscriptionAppliesToMonth(ipva, "2027-01")).toBe(true);
    expect(subscriptionAppliesToMonth(ipva, "2027-02")).toBe(false);
    expect(committedFor(state, "2027-01", "2026-12", "2026-11-24").subscriptions).toBe(1200);
    expect(committedFor(state, "2027-02", "2026-12", "2026-11-24").subscriptions).toBe(0);

    state = paySubscription(state, ipva.id, { date: "2027-01-15", amount: 1200, invoice_month: "2027-01" });
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].subscription_id).toBe(ipva.id);

    // Two distinct months with consistent Spotify charge -> detected as recurring candidate.
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      date: "2026-10-10",
      invoice_month: "2026-11",
      title: "Spotify",
      amount: 21.9,
      category_id: null,
      notes: "",
      recurrence: { kind: "single" },
    });
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      date: "2026-11-10",
      invoice_month: "2026-12",
      title: "Spotify",
      amount: 21.9,
      category_id: null,
      notes: "",
      recurrence: { kind: "single" },
    });
    const candidates = detectRecurringCandidates(state);
    expect(candidates.some((c) => c.title === "Spotify" && c.monthsCount === 2)).toBe(true);
  });

  it("projects seasonal annual and one-off income sources in the right months", () => {
    let state = upsertIncomeSource(emptyState(), {
      title: "Salário",
      kind: "salary",
      expected_amount: 5000,
      pay_day: 5,
      active: true,
      frequency: "monthly",
    });
    state = upsertIncomeSource(state, {
      title: "13º Salário",
      kind: "salary",
      expected_amount: 4500,
      pay_day: 20,
      active: true,
      frequency: "annual",
      pay_month: 12,
    });
    state = upsertIncomeSource(state, {
      title: "Restituição IR",
      kind: "other",
      expected_amount: 1200,
      pay_day: 30,
      active: true,
      frequency: "once",
      scheduled_month: "2027-06",
    });

    expect(expectedIncomeForMonth(state, "2026-11")).toBe(5000);
    expect(expectedIncomeForMonth(state, "2026-12")).toBe(9500);
    expect(expectedIncomeForMonth(state, "2027-06")).toBe(6200);
  });

  it("matches smart rules (regex, amount bounds, subscription, ignore) and previews changes", () => {
    expect(isValidRulePattern("^uber\\b", true)).toBe(true);
    expect(isValidRulePattern("[invalid", true)).toBe(false);

    let state = upsertCategory(emptyState(), { name: "Assinaturas", color: "#8B5CF6", icon: "repeat", monthly_limit: 200 });
    const cat = state.categories[0];
    state = upsertSubscription(state, { title: "Amazon Prime", expected_amount: 19.9, category_id: cat.id, billing_day: 5, active: true });
    const sub = state.recurring_subscriptions[0];
    state = upsertRule(state, {
      pattern: "^amazon",
      is_regex: true,
      min_amount: 15,
      max_amount: 25,
      payment_method: "credit_card",
      clean_name_override: "Amazon Prime",
      category_id: cat.id,
      subscription_id: sub.id,
      mark_ignored: false,
      priority: 100,
    });

    const matched = categorize("AMAZON BR", state.categorization_rules, { amount: 19.9, paymentMethod: "credit_card" });
    expect(matched.cleanTitle).toBe("Amazon Prime");
    expect(matched.subscriptionId).toBe(sub.id);

    const unmatched = categorize("AMAZON BR", state.categorization_rules, { amount: 250, paymentMethod: "credit_card" });
    expect(unmatched.subscriptionId).toBeNull();

    // Seed an imported transaction and check preview + single-rule reapply.
    state = {
      ...state,
      transactions: [
        {
          id: "tx-1",
          batch_id: null,
          date: "2026-11-05",
          invoice_month: "2026-12",
          raw_title: "AMAZON BR",
          clean_title: "Amazon Br",
          amount: 19.9,
          type: "expense",
          payment_method: "credit_card",
          card_id: null,
          category_id: null,
          source: "csv",
          is_user_edited: false,
          locked_fields: [],
          is_ignored: false,
          subscription_id: null,
          income_source_id: null,
          notes: "",
          tags: [],
          split_group_id: null,
          refund_of_transaction_id: null,
          installment_group_id: null,
          installment_current: null,
          installment_total: null,
          unique_hash: null,
          created_at: "2026-11-05T00:00:00Z",
          updated_at: "2026-11-05T00:00:00Z",
        },
      ],
    };

    const preview = previewReapplyRules(state, state.categorization_rules[0].id);
    expect(preview).toHaveLength(1);
    expect(preview[0].afterTitle).toBe("Amazon Prime");
    const applied = reapplyRules(state, undefined, state.categorization_rules[0].id);
    expect(applied.changed).toBe(1);
    expect(applied.state.transactions[0].subscription_id).toBe(sub.id);
  });

  it("tracks savings goals, invoice reconciliations, tags, annual analytics, budget suggestions, alerts and CSV export", () => {
    let state = upsertCategory(emptyState(), { name: "Alimentação", color: "#F97316", icon: "utensils", monthly_limit: 500 });
    const food = state.categories[0];

    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      date: "2026-11-08",
      invoice_month: "2026-12",
      title: "iFood",
      amount: 420,
      category_id: food.id,
      notes: "",
      tags: parseTagInput("#viagem, #fds"),
      recurrence: { kind: "single" },
    });
    state = bulkAddTag(state, [state.transactions[0].id], "#delivery");
    expect(state.transactions[0].tags).toEqual(["viagem", "fds", "delivery"]);

    // Burn-rate alert on day 9 of cycle (420 / 500 = 84% already spent!).
    const alerts = buildAlerts(state, "2026-12", "2026-11-10");
    expect(alerts.some((a) => a.kind === "budget_pace")).toBe(true);

    // Annual analytics + suggested limits + CSV export.
    const analytics = annualAnalytics(state, "2026-12", 12);
    expect(analytics.topMerchants[0].merchant).toBe("iFood");
    expect(analytics.tagBreakdown.find((t) => t.tag === "viagem")?.total).toBe(420);
    expect(suggestedCategoryLimits(state, "2026-12").get(food.id)).toBe(420);
    expect(transactionsToCsv(state.transactions, state)).toContain("#viagem");

    // Savings goals & invoice reconciliation.
    state = upsertSavingsGoal(state, {
      title: "Reserva",
      target_amount: 10000,
      current_amount: 2000,
      monthly_contribution: 500,
      target_month: "2028-01",
      color: "#10B981",
    });
    state = contributeSavingsGoal(state, (state.savings_goals ?? [])[0].id, 500);
    expect((state.savings_goals ?? [])[0].current_amount).toBe(2500);

    state = upsertInvoiceReconciliation(state, {
      invoice_month: "2026-12",
      card_id: null,
      expected_total: 420,
      status: "paid",
      notes: "Tudo certo",
    });
    expect(state.invoice_reconciliations).toHaveLength(1);
    expect(parseFinanceState(JSON.parse(JSON.stringify(state)))?.savings_goals).toHaveLength(1);
  });

  it("parses bank-account OFX statements into income, pix/boleto expenses, and invoice payments", async () => {
    const bankOfx = `<OFX>
<BANKMSGSRSV1>
<STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>260</BANKID><ACCTID>12345678</ACCTID></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><DTPOSTED>20261105</DTPOSTED><TRNAMT>5000.00</TRNAMT><MEMO>Salario Empresa XYZ</MEMO></STMTTRN>
<STMTTRN><DTPOSTED>20261106</DTPOSTED><TRNAMT>-150.00</TRNAMT><MEMO>Pagamento Boleto Internet</MEMO></STMTTRN>
<STMTTRN><DTPOSTED>20261110</DTPOSTED><TRNAMT>-1200.00</TRNAMT><MEMO>Pagamento de fatura cartao</MEMO></STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
    const detection = detectStatement("extrato_nubank.ofx", bankOfx);
    expect(detection.statementKind).toBe("bank_account");
    const parsed = await parseStatement(detection.format, bankOfx, detection.issuer, detection.statementKind);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0].type).toBe("income");
    expect(parsed.rows[1].type).toBe("expense");
    expect(parsed.rows[1].paymentMethod).toBe("boleto");
    expect(parsed.rows[2].type).toBe("payment");
  });

  it("paginates SupabaseRepository.fetchAll beyond 1,000 rows without truncation", async () => {
    const fakeTransactions = Array.from({ length: FETCH_PAGE_SIZE + 250 }, (_, index) => ({
      id: `tx-${String(index).padStart(5, "0")}`,
      user_id: "u1",
      batch_id: null,
      date: "2026-11-01",
      invoice_month: "2026-11",
      raw_title: `Item ${index}`,
      clean_title: `Item ${index}`,
      amount: 10,
      type: "expense",
      payment_method: "credit_card",
      card_id: null,
      category_id: null,
      source: "manual",
      is_user_edited: false,
      locked_fields: [],
      is_ignored: false,
      subscription_id: null,
      income_source_id: null,
      notes: "",
      tags: [],
      split_group_id: null,
      refund_of_transaction_id: null,
      installment_group_id: null,
      installment_current: null,
      installment_total: null,
      unique_hash: null,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    }));

    const mockClient = {
      from(table: string) {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    display_name: "Tester",
                    avatar_style: null,
                    avatar_seed: null,
                    theme: "light",
                    closing_day: 2,
                    monthly_income: 0,
                    dismissed_alerts: [],
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                range: async (from: number, to: number) => ({
                  data: table === "transactions" ? fakeTransactions.slice(from, to + 1) : [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;

    const repo = new SupabaseRepository(mockClient, "u1");
    const loaded = await repo.load();
    expect(loaded?.transactions).toHaveLength(FETCH_PAGE_SIZE + 250);
  });
});

