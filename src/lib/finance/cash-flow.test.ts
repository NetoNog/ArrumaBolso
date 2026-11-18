import { describe, expect, it } from "vitest";

import { emptyState } from "@/lib/data/initial-state";
import { parseFinanceState } from "@/lib/data/repository";
import {
  createTransaction,
  deleteIncomeSource,
  expectedPayDate,
  receiveIncome,
  upsertIncomeSource,
  type NewTransactionInput,
} from "@/lib/domain/operations";
import type { FinanceState } from "@/lib/domain/types";
import {
  cashFlowHistory,
  cashFlowSummary,
  dailyCashFlowSeries,
  expectedMonthlyIncome,
  incomeSourceMonth,
} from "@/lib/finance/metrics";

// Closing day 2: invoice 2026-12 covers 2026-11-02 .. 2026-12-01.
const MONTH = "2026-12";

function add(state: FinanceState, input: Partial<NewTransactionInput> & Pick<NewTransactionInput, "date" | "amount">): FinanceState {
  return createTransaction(state, {
    type: "expense",
    payment_method: "pix_debit",
    title: "Item",
    category_id: null,
    notes: "",
    recurrence: { kind: "single" },
    ...input,
  });
}

function withSalary(state: FinanceState = emptyState()) {
  const next = upsertIncomeSource(state, { title: "Salário ACME", kind: "salary", expected_amount: 5000, pay_day: 5, active: true });
  return { state: next, source: next.income_sources[0] };
}

describe("expected pay date", () => {
  it("places the pay day inside the invoice cycle", () => {
    // Day 5 >= closing day 2: falls in the previous calendar month of the cycle.
    expect(expectedPayDate(MONTH, 5, 2)).toBe("2026-11-05");
    // Day 1 < closing day 2: falls in the invoice month itself.
    expect(expectedPayDate(MONTH, 1, 2)).toBe("2026-12-01");
  });

  it("clamps to the last day of short months", () => {
    expect(expectedPayDate("2027-03", 31, 2)).toBe("2027-02-28");
  });
});

describe("income sources", () => {
  it("records a receipt linked to the source in the right competence", () => {
    const { state, source } = withSalary();
    const next = receiveIncome(state, source.id, { date: "2026-11-05", amount: 5000 });
    const [tx] = next.transactions;
    expect(tx).toMatchObject({ type: "income", amount: 5000, income_source_id: source.id, invoice_month: MONTH, clean_title: "Salário ACME" });
  });

  it("rejects unknown sources, invalid dates and non-positive amounts", () => {
    const { state, source } = withSalary();
    expect(receiveIncome(state, "missing", { date: "2026-11-05", amount: 10 })).toBe(state);
    expect(receiveIncome(state, source.id, { date: "2026-13-40", amount: 10 })).toBe(state);
    expect(receiveIncome(state, source.id, { date: "2026-11-05", amount: 0 })).toBe(state);
  });

  it("reports received, partial, overdue and upcoming", () => {
    const { state, source } = withSalary();
    expect(incomeSourceMonth(state, source, MONTH, "2026-11-04").status).toBe("upcoming");
    expect(incomeSourceMonth(state, source, MONTH, "2026-11-06").status).toBe("overdue");

    const partial = receiveIncome(state, source.id, { date: "2026-11-05", amount: 3000 });
    expect(incomeSourceMonth(partial, source, MONTH, "2026-11-06")).toMatchObject({ status: "partial", receivedTotal: 3000 });

    const full = receiveIncome(partial, source.id, { date: "2026-11-20", amount: 2000 });
    expect(incomeSourceMonth(full, source, MONTH, "2026-11-21")).toMatchObject({ status: "received", receivedTotal: 5000 });
  });

  it("expects the active sources, falling back to the manual income while none exist", () => {
    const base = { ...emptyState(), settings: { ...emptyState().settings, monthly_income: 1200 } };
    expect(expectedMonthlyIncome(base)).toBe(1200);
    const { state } = withSalary(base);
    const withPaused = upsertIncomeSource(state, { title: "Freela", kind: "freelance", expected_amount: 800, pay_day: 20, active: false });
    expect(expectedMonthlyIncome(withPaused)).toBe(5000);
  });

  it("keeps received entries as plain income when the source is deleted", () => {
    const { state, source } = withSalary();
    const next = deleteIncomeSource(receiveIncome(state, source.id, { date: "2026-11-05", amount: 5000 }), source.id);
    expect(next.income_sources).toHaveLength(0);
    expect(next.transactions[0]).toMatchObject({ type: "income", income_source_id: null });
  });
});

describe("cash flow", () => {
  function scenario() {
    const { state, source } = withSalary();
    let next = receiveIncome(state, source.id, { date: "2026-11-05", amount: 5000 });
    next = add(next, { type: "income", date: "2026-11-10", amount: 300, title: "Venda" });
    next = add(next, { date: "2026-11-06", amount: 1200.5, payment_method: "boleto" });
    next = add(next, { date: "2026-11-06", amount: 99.5, payment_method: "nubank_card" });
    // Card payment: a transfer, not an outflow.
    next = add(next, { type: "payment", date: "2026-11-11", amount: 900 });
    return next;
  }

  it("sums inflows and outflows, excluding invoice payments", () => {
    const summary = cashFlowSummary(scenario(), MONTH);
    expect(summary).toMatchObject({ inflow: 5300, outflow: 1300, balance: 4000 });
    expect(summary.savingsRate).toBeCloseTo(4000 / 5300);
    expect(summary.outflowByMethod.map((row) => row.method)).toEqual(["boleto", "nubank_card"]);
    expect(summary.inflowByOrigin).toEqual([
      { label: "Salário ACME", amount: 5000 },
      { label: "Outras entradas", amount: 300 },
    ]);
  });

  it("has no savings rate without inflow", () => {
    expect(cashFlowSummary(add(emptyState(), { date: "2026-11-06", amount: 10 }), MONTH).savingsRate).toBeNull();
  });

  it("builds a daily series with a running balance that stops today", () => {
    const series = dailyCashFlowSeries(scenario(), MONTH, "2026-11-10");
    expect(series[0].date).toBe("2026-11-02");
    expect(series.at(-1)?.date).toBe("2026-12-01");
    const byDate = new Map(series.map((point) => [point.date, point]));
    expect(byDate.get("2026-11-05")).toMatchObject({ inflow: 5000, outflow: 0, balance: 5000 });
    expect(byDate.get("2026-11-06")).toMatchObject({ inflow: 0, outflow: 1300, balance: 3700 });
    expect(byDate.get("2026-11-10")?.balance).toBe(4000);
    expect(byDate.get("2026-11-11")?.balance).toBeNull();
  });

  it("returns one point per month for the history", () => {
    const history = cashFlowHistory(scenario(), MONTH, 3);
    expect(history.map((point) => point.month)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(history.at(-1)).toMatchObject({ inflow: 5300, outflow: 1300, balance: 4000 });
  });
});

describe("backup compatibility", () => {
  it("upgrades backups made before income sources existed", () => {
    const json = JSON.parse(JSON.stringify(add(emptyState(), { date: "2026-11-06", amount: 10 })));
    delete json.income_sources;
    delete json.transactions[0].income_source_id;
    const parsed = parseFinanceState(json);
    expect(parsed?.income_sources).toEqual([]);
    expect(parsed?.transactions[0].income_source_id).toBeNull();
  });
});
