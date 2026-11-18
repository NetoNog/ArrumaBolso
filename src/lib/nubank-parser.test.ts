import { describe, expect, it } from "vitest";

import { buildSampleState, SAMPLE_CSV_DEC_2026 } from "@/lib/testing/sample-state";
import { deleteTransactions, updateTransaction } from "@/lib/domain/operations";
import type { FinanceState } from "@/lib/domain/types";
import { committedFor, invoiceTotal, expensesOfMonth } from "@/lib/finance/metrics";
import { applyImport, parseNubankCsv, reconcile, undoImportBatch } from "@/lib/nubank-parser";

const NO_DECISIONS = { categoryOverrides: {}, restoreHashes: new Set<string>() };

async function importCsv(state: FinanceState, csv: string, month = "2026-12") {
  const report = reconcile(await parseNubankCsv(csv), state, { filename: "Nubank_2026-12-09.csv", invoiceMonth: month });
  return { report, ...applyImport(state, report, NO_DECISIONS) };
}

describe("parseNubankCsv", () => {
  it("parses Brazilian amounts and assigns same-day occurrence indexes", async () => {
    const csv = `date,title,amount\n07/11/2026,Loja,"33,00"\n2026-11-07,Loja,"33,00"\n2026-11-08,Pagamento recebido,"- 1.500,12"\n2026-11-09,Posto,"103,92"`;
    const { rows, errors } = await parseNubankCsv(csv);
    expect(errors).toEqual([]);
    expect(rows.map((row) => row.amount)).toEqual([33, 33, -1500.12, 103.92]);
    expect(rows[0].occurrenceIndex).toBe(1);
    expect(rows[1].occurrenceIndex).toBe(2);
    expect(rows[0].uniqueHash).not.toBe(rows[1].uniqueHash);
    expect(rows[2].type).toBe("payment");
  });

  it("reports invalid rows instead of silently dropping them", async () => {
    const { rows, errors } = await parseNubankCsv("date,title,amount\nxx,Loja,10\n2026-11-01,,10\n2026-11-01,Loja,abc");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(3);
  });

  it("rejects files without the expected header", async () => {
    const { errors } = await parseNubankCsv("foo,bar\n1,2");
    expect(errors[0].message).toMatch(/Cabeçalho/);
  });
});

describe("sample state", () => {
  it("matches the reference December invoice", async () => {
    const state = await buildSampleState();
    expect(expensesOfMonth(state, "2026-12")).toHaveLength(23);
    expect(invoiceTotal(state, "2026-12")).toBe(1154.97);
    expect(invoiceTotal(state, "2026-11")).toBe(1012.67);
    expect(committedFor(state, "2027-01", "2026-12", "2026-11-17").total).toBe(570.79);
    expect(committedFor(state, "2026-12", "2026-12", "2026-11-17").total).toBe(610.65);
  });

  it("replaced the Economiafarma 2/2 projection with the real CSV row", async () => {
    const state = await buildSampleState();
    const parcels = state.transactions.filter((tx) => tx.raw_title.startsWith("Economiafarma"));
    expect(parcels).toHaveLength(2);
    expect(parcels.every((tx) => tx.source === "csv")).toBe(true);
  });
});

describe("reconciliation matrix", () => {
  it("scenario C: re-importing the same file creates nothing", async () => {
    const state = await buildSampleState();
    const { report, state: next } = await importCsv(state, SAMPLE_CSV_DEC_2026);
    expect(report.summary.newCount).toBe(0);
    expect(report.summary.existingCount).toBe(24);
    expect(next.transactions).toHaveLength(state.transactions.length);
  });

  it("scenario A: only genuinely new rows are inserted from a later export", async () => {
    const state = await buildSampleState();
    const later = `${SAMPLE_CSV_DEC_2026}2026-11-20,Ifd*Nova Loja,42.10\n`;
    const { report, state: next } = await importCsv(state, later);
    expect(report.summary.newCount).toBe(1);
    expect(invoiceTotal(next, "2026-12")).toBe(1197.07);
  });

  it("scenario B: user edits are never overwritten", async () => {
    const seed = await buildSampleState();
    const target = seed.transactions.find((tx) => tx.raw_title === "MACK VII" && tx.invoice_month === "2026-12");
    if (!target) throw new Error("seed row missing");
    const edited = updateTransaction(seed, target.id, { clean_title: "Gasolina carro", amount: 100 });
    const { report, state: next } = await importCsv(edited, SAMPLE_CSV_DEC_2026);
    expect(report.summary.protectedCount).toBe(1);
    const after = next.transactions.find((tx) => tx.id === target.id);
    expect(after?.clean_title).toBe("Gasolina carro");
    expect(after?.amount).toBe(100);
    expect(after?.locked_fields).toEqual(expect.arrayContaining(["clean_title", "amount"]));
  });

  it("scenario D: deleted CSV rows do not resurrect, unless restored", async () => {
    const seed = await buildSampleState();
    const duplicate = seed.transactions.filter((tx) => tx.raw_title === "64900927edinelma")[1];
    const afterDelete = deleteTransactions(seed, [duplicate.id]);
    expect(afterDelete.deleted_csv_hashes).toHaveLength(1);

    const { report, state: next } = await importCsv(afterDelete, SAMPLE_CSV_DEC_2026);
    expect(report.summary.deletedCount).toBe(1);
    expect(next.transactions.filter((tx) => tx.raw_title === "64900927edinelma")).toHaveLength(1);

    const restoreReport = reconcile(await parseNubankCsv(SAMPLE_CSV_DEC_2026), afterDelete, {
      filename: "x.csv",
      invoiceMonth: "2026-12",
    });
    const restored = applyImport(afterDelete, restoreReport, {
      categoryOverrides: {},
      restoreHashes: new Set([duplicate.unique_hash as string]),
    }).state;
    expect(restored.transactions.filter((tx) => tx.raw_title === "64900927edinelma")).toHaveLength(2);
    expect(restored.deleted_csv_hashes).toHaveLength(0);
  });

  it("scenario E: manual transactions are untouched by imports", async () => {
    const seed = await buildSampleState();
    const manual = seed.transactions.filter((tx) => tx.source === "manual");
    const { state: next } = await importCsv(seed, SAMPLE_CSV_DEC_2026);
    expect(next.transactions.filter((tx) => tx.source === "manual")).toEqual(manual);
  });

  it("projects future parcels and swaps the projection for the real row next month", async () => {
    const seed = await buildSampleState();
    const projected = seed.transactions.find((tx) => tx.source === "projected");
    expect(projected?.invoice_month).toBe("2027-01");
    expect(projected?.raw_title).toBe("Pix no Crédito - Carloslimadesouza - Parcela 2/2");

    const january = "date,title,amount\n2026-12-04,Pix no Crédito - Carloslimadesouza - Parcela 2/2,375.00\n";
    const { report, state: next, batch } = await importCsv(seed, january, "2027-01");
    expect(report.rows[0].replacesProjectedId).toBe(projected?.id);
    const parcels = next.transactions.filter((tx) => tx.installment_group_id === projected?.installment_group_id);
    expect(parcels).toHaveLength(2);
    expect(parcels.every((tx) => tx.source === "csv")).toBe(true);

    const undone = undoImportBatch(next, batch.id);
    expect(undone.transactions.find((tx) => tx.id === projected?.id)?.source).toBe("projected");
  });

  it("undo removes only unedited rows of the batch", async () => {
    const seed = await buildSampleState();
    const csv = "date,title,amount\n2026-11-20,Loja A,10.00\n2026-11-20,Loja B,20.00\n";
    const { state: next, batch } = await importCsv(seed, csv);
    const lojaB = next.transactions.find((tx) => tx.raw_title === "Loja B");
    if (!lojaB) throw new Error("missing");
    const edited = updateTransaction(next, lojaB.id, { notes: "manter" });
    const undone = undoImportBatch(edited, batch.id);
    expect(undone.transactions.some((tx) => tx.raw_title === "Loja A")).toBe(false);
    expect(undone.transactions.some((tx) => tx.raw_title === "Loja B")).toBe(true);
  });
});
