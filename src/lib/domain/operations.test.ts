import { describe, expect, it } from "vitest";

import { emptyState } from "@/lib/data/initial-state";
import {
  createTransaction,
  deleteCategory,
  deleteTransactions,
  splitInstallments,
  upsertCategory,
} from "@/lib/domain/operations";
import { parseAmount } from "@/lib/money";
import { cleanTitle, extractInstallment } from "@/lib/categorization";
import { cycleBounds, invoiceMonthForDate, detectInvoiceMonthFromFilename } from "@/lib/dates";

describe("money & dates", () => {
  it("parses amounts", () => {
    expect(parseAmount("- 1.500,12")).toBe(-1500.12);
    expect(parseAmount("R$ 1.154,97")).toBe(1154.97);
    expect(parseAmount("1.500")).toBe(1500);
    expect(parseAmount("15.00")).toBe(15);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("derives the invoice cycle from the closing day", () => {
    expect(invoiceMonthForDate("2026-11-07", 2)).toBe("2026-12");
    expect(invoiceMonthForDate("2026-11-01", 2)).toBe("2026-11");
    expect(invoiceMonthForDate("2026-12-15", 2)).toBe("2027-01");
    expect(cycleBounds("2026-12", 2)).toEqual({ start: "2026-11-02", end: "2026-12-01" });
    expect(detectInvoiceMonthFromFilename("Nubank_2026-12-09.csv")).toBe("2026-12");
    expect(detectInvoiceMonthFromFilename("fatura.csv")).toBeNull();
  });

  it("cleans titles and extracts installments", () => {
    expect(cleanTitle("Pix no Crédito - Carloslimadesouza - Parcela 1/2")).toBe("Carloslimadesouza");
    expect(cleanTitle("Mp *Mercadolivre")).toBe("Mercadolivre");
    expect(cleanTitle("Tim*Tim Controle")).toBe("Tim Controle");
    expect(extractInstallment("Economiafarma - Parcela 2/2")).toEqual({ current: 2, total: 2, baseTitle: "Economiafarma" });
    expect(extractInstallment("Parcela 3/2")).toBeNull();
  });
});

describe("transactions CRUD", () => {
  it("splits manual installments exactly and links them", () => {
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
    const state = createTransaction(emptyState(), {
      type: "expense",
      payment_method: "boleto",
      date: "2026-11-20",
      title: "Geladeira",
      amount: 1000,
      category_id: null,
      notes: "",
      recurrence: { kind: "installments", count: 4 },
    });
    expect(state.transactions).toHaveLength(4);
    expect(new Set(state.transactions.map((tx) => tx.installment_group_id)).size).toBe(1);
    expect(state.transactions.map((tx) => tx.invoice_month)).toEqual(["2026-12", "2027-01", "2027-02", "2027-03"]);
  });

  it("deletes this and following parcels", () => {
    const state = createTransaction(emptyState(), {
      type: "expense",
      payment_method: "cash",
      date: "2026-11-20",
      title: "Curso",
      amount: 300,
      category_id: null,
      notes: "",
      recurrence: { kind: "installments", count: 3 },
    });
    const second = state.transactions.find((tx) => tx.installment_current === 2);
    if (!second) throw new Error("missing");
    expect(deleteTransactions(state, [second.id], "following").transactions).toHaveLength(1);
    expect(deleteTransactions(state, [second.id], "single").transactions).toHaveLength(2);
  });

  it("stores payments as negative amounts and subscriptions as recurring", () => {
    const state = createTransaction(emptyState(), {
      type: "expense",
      payment_method: "nubank_card",
      date: "2026-11-20",
      title: "Netflix",
      amount: 39.9,
      category_id: null,
      notes: "",
      recurrence: { kind: "subscription" },
    });
    expect(state.recurring_subscriptions).toHaveLength(1);
    expect(state.transactions[0].subscription_id).toBe(state.recurring_subscriptions[0].id);
  });

  it("migrates transactions when a category is deleted", () => {
    let state = upsertCategory(emptyState(), { name: "A", color: "#000", icon: "tag", monthly_limit: 10 });
    state = upsertCategory(state, { name: "B", color: "#000", icon: "tag", monthly_limit: 10 });
    const [a, b] = state.categories;
    state = createTransaction(state, {
      type: "expense",
      payment_method: "cash",
      date: "2026-11-20",
      title: "X",
      amount: 5,
      category_id: a.id,
      notes: "",
      recurrence: { kind: "single" },
    });
    const next = deleteCategory(state, a.id, b.id);
    expect(next.categories).toHaveLength(1);
    expect(next.transactions[0].category_id).toBe(b.id);
  });
});
