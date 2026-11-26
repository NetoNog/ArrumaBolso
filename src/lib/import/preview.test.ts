import { describe, expect, it } from "vitest";

import { suggestInvoiceMonth, summarizeStatement } from "@/lib/import/preview";

const rows = [
  { date: "2026-11-05", amount: 45.9 },
  { date: "2026-10-28", amount: 120 },
  { date: "2026-11-08", amount: -900 },
  { date: "2026-11-01", amount: 0.1 },
  { date: "2026-11-01", amount: 0.2 },
];

describe("statement preview", () => {
  it("summarises totals and period", () => {
    expect(summarizeStatement(rows)).toEqual({
      count: 5,
      purchasesTotal: 166.2,
      creditsTotal: 900,
      firstDate: "2026-10-28",
      lastDate: "2026-11-08",
    });
    expect(summarizeStatement([])).toMatchObject({ count: 0, firstDate: null, lastDate: null });
  });

  it("suggests the cycle of the latest purchase, ignoring payments", () => {
    // Latest purchase 05/11 with closing day 2 → December invoice.
    expect(suggestInvoiceMonth(rows, 2)).toBe("2026-12");
    // Closing day 10 → still the November cycle.
    expect(suggestInvoiceMonth(rows, 10)).toBe("2026-11");
    expect(suggestInvoiceMonth([{ date: "2026-11-08", amount: -900 }], 2)).toBeNull();
  });
});
