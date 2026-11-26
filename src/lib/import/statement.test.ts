import { describe, expect, it } from "vitest";

import { emptyState } from "@/lib/data/initial-state";
import type { Category, FinanceState } from "@/lib/domain/types";
import { sha256Hex } from "@/lib/hash";
import { issuerFromBankCode, issuerFromText, matchCard } from "@/lib/import/issuers";
import { matchPreset, presetCategoryId, suggestCategoryId } from "@/lib/import/merchant-categories";
import { decodeStatementBytes, detectStatement, parseStatement } from "@/lib/import/statement";
import { applyImport, parseNubankCsv, reconcile } from "@/lib/nubank-parser";

const INTER_CSV = `"Data","Lançamento","Categoria","Tipo","Valor"
"05/11/2026","IFOOD *RESTAURANTE","RESTAURANTES","Compra à vista","R$ 45,90"
"06/11/2026","SHOPEE *LOJAXYZ","COMPRAS","Parcela 2/3","R$ 120,00"
"08/11/2026","PAGAMENTO ON LINE","OUTROS","Pagamento","R$ 900,00"
"09/11/2026","LOJA DESCONHECIDA","VESTUARIO","Compra à vista","R$ 80,00"`;

const BRADESCO_CSV = `Extrato de: Cartão Visa Platinum
Situação da Fatura: Fechada

Data;Histórico;Valor(US$);Valor(R$);
03/11/2026;UBER   *TRIP;0,00;23,40;
04/11/2026;NETFLIX.COM;0,00;55,90;
05/11/2026;MAGAZINE LUIZA 02/10;0,00;150,00;
;Total para FULANO;;229,30;
Data;Histórico;Valor(US$);Valor(R$);
07/11/2026;DROGASIL 123;0,00;30,00;`;

const ITAU_OFX = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX>
<SIGNONMSGSRSV1><SONRS><FI><ORG>Itau<FID>341</FI></SONRS></SIGNONMSGSRSV1>
<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
<CCACCTFROM><ACCTID>5502********4321</CCACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261103120000[-3:BRT]<TRNAMT>-89.90<FITID>1<MEMO>MERCADOLIVRE*VENDEDOR</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261104<TRNAMT>-12.50<FITID>2<MEMO>SPOTIFY</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261110<TRNAMT>500.00<FITID>3<MEMO>PAGAMENTO EFETUADO</STMTTRN>
</BANKTRANLIST>
</CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>
</OFX>`;

function stateWith(categories: Category[] = []): FinanceState {
  return { ...emptyState(), categories };
}

describe("issuer detection", () => {
  it("maps COMPE codes and names to issuers", () => {
    expect(issuerFromBankCode("0260")).toBe("nubank");
    expect(issuerFromBankCode("77")).toBe("inter");
    expect(issuerFromBankCode("341")).toBe("itau");
    expect(issuerFromBankCode("999")).toBeNull();
    expect(issuerFromText("Fatura_Inter_2026-11")).toBe("inter");
    expect(issuerFromText("internacional")).toBeNull();
    expect(issuerFromText("ITAU UNIBANCO S.A.")).toBe("itau");
  });

  it("detects the bank from OFX, file names and CSV headers", () => {
    expect(detectStatement("extrato.ofx", ITAU_OFX)).toEqual({
      format: "ofx",
      statementKind: "credit_card",
      issuer: "itau",
      source: "ofx_bank_code",
      lastFour: "4321",
    });
    expect(detectStatement("Nubank_2026-12-09.csv", "date,title,amount\n")).toMatchObject({ format: "csv", issuer: "nubank", source: "filename" });
    expect(detectStatement("fatura.csv", "date,title,amount\n")).toMatchObject({ issuer: "nubank", source: "csv_header" });
    expect(detectStatement("fatura.csv", INTER_CSV)).toMatchObject({ issuer: "inter", source: "csv_header" });
    expect(detectStatement("fatura.csv", BRADESCO_CSV)).toMatchObject({ issuer: "bradesco" });
    expect(detectStatement("fatura.csv", "data;descricao;valor\n")).toMatchObject({ issuer: null, source: null });
  });

  it("prefers the card with the same last four digits", () => {
    const cards = [
      { id: "a", name: "Itaú", issuer: "itau" as const, last_four: "1111", color: "#000000" },
      { id: "b", name: "Itaú 2", issuer: "itau" as const, last_four: "4321", color: "#000000" },
    ];
    expect(matchCard(cards, "itau", "4321")?.id).toBe("b");
    expect(matchCard(cards, "itau", null)?.id).toBe("a");
    expect(matchCard(cards, "inter", null)).toBeNull();
  });

  it("falls back to Windows-1252 when the file is not UTF-8", () => {
    const latin1 = new Uint8Array([0x48, 0x69, 0x73, 0x74, 0xf3, 0x72, 0x69, 0x63, 0x6f]); // "Histórico"
    expect(decodeStatementBytes(latin1.buffer)).toBe("Histórico");
  });
});

describe("statement parsing", () => {
  it("parses Inter CSV: R$ values, payment type and installments from the type column", async () => {
    const { rows, errors } = await parseStatement("csv", INTER_CSV, "inter");
    expect(errors).toEqual([]);
    expect(rows.map((row) => row.amount)).toEqual([45.9, 120, -900, 80]);
    expect(rows[1].rawTitle).toBe("SHOPEE *LOJAXYZ - Parcela 2/3");
    expect(rows[1].installment).toMatchObject({ current: 2, total: 3 });
    expect(rows[2].type).toBe("payment");
    expect(rows[3].bankCategory).toBe("VESTUARIO");
  });

  it("parses Bradesco CSV: preamble, ';' delimiter, R$ column, repeated headers and footers", async () => {
    const { rows, errors } = await parseStatement("csv", BRADESCO_CSV, "bradesco");
    expect(errors).toEqual([]);
    expect(rows.map((row) => [row.date, row.amount])).toEqual([
      ["2026-11-03", 23.4],
      ["2026-11-04", 55.9],
      ["2026-11-05", 150],
      ["2026-11-07", 30],
    ]);
    expect(rows[2].installment).toMatchObject({ current: 2, total: 10, baseTitle: "MAGAZINE LUIZA" });
  });

  it("flips statements exported with the debit convention", async () => {
    const csv = "data;lancamento;valor\n01/11/2026;LOJA A;-10,00\n02/11/2026;LOJA B;-20,00\n03/11/2026;PAGAMENTO;30,00";
    const { rows } = await parseStatement("csv", csv, "itau");
    expect(rows.map((row) => row.amount)).toEqual([10, 20, -30]);
    expect(rows[2].type).toBe("payment");
  });

  it("parses OFX credit card statements with purchases positive", async () => {
    const { rows, errors } = await parseStatement("ofx", ITAU_OFX, "itau");
    expect(errors).toEqual([]);
    expect(rows.map((row) => [row.date, row.rawTitle, row.amount, row.type])).toEqual([
      ["2026-11-03", "MERCADOLIVRE*VENDEDOR", 89.9, "expense"],
      ["2026-11-04", "SPOTIFY", 12.5, "expense"],
      ["2026-11-10", "PAGAMENTO EFETUADO", -500, "payment"],
    ]);
  });

  it("scopes hashes by bank but keeps Nubank hashes unchanged", async () => {
    const csv = "date,title,amount\n2026-11-01,Loja,10.00";
    const nubank = await parseNubankCsv(csv);
    const inter = await parseStatement("csv", csv, "inter");
    expect(nubank.rows[0].uniqueHash).toBe(await sha256Hex("2026-11-01|Loja|10.00|1"));
    expect(inter.rows[0].uniqueHash).not.toBe(nubank.rows[0].uniqueHash);
  });
});

describe("automatic categorisation", () => {
  it("matches merchants by keyword, preferring the most specific one", () => {
    expect(matchPreset("IFD*BURGER KING")?.key).toBe("alimentacao");
    expect(matchPreset("Shopee *Loja")?.key).toBe("compras");
    expect(matchPreset("UBER *TRIP")?.key).toBe("transporte");
    expect(matchPreset("UBER EATS")?.key).toBe("alimentacao");
    expect(matchPreset("Drogasil 123")?.key).toBe("saude");
    expect(matchPreset("NETFLIX.COM")?.key).toBe("assinaturas");
    expect(matchPreset("Mp *Mercadolivre")?.key).toBe("compras");
    expect(matchPreset("PAG*JOAOSILVA")).toBeNull();
  });

  it("reuses the user's category with the same name or alias, otherwise suggests a virtual one", () => {
    const food: Category = { id: "food", name: "Restaurantes", icon: "utensils", color: "#F97316", monthly_limit: 0 };
    expect(suggestCategoryId("IFOOD *X", null, [food])).toBe("food");
    expect(suggestCategoryId("SHOPEE *X", null, [food])).toBe(presetCategoryId("compras"));
    expect(suggestCategoryId("LOJA DESCONHECIDA", "VESTUARIO", [])).toBe(presetCategoryId("vestuario"));
    expect(suggestCategoryId("LOJA DESCONHECIDA", null, [])).toBeNull();
  });

  it("creates suggested categories once on import and links rows to the card", async () => {
    const state = stateWith();
    const parsed = await parseStatement("csv", INTER_CSV, "inter");
    const report = reconcile(parsed, state, { filename: "inter.csv", invoiceMonth: "2026-12" });
    expect(report.rows[0].suggestedCategoryId).toBe(presetCategoryId("alimentacao"));

    const { state: next, batch } = applyImport(state, report, {
      categoryOverrides: { [report.rows[3].lineNumber]: presetCategoryId("compras") },
      restoreHashes: new Set(),
      cardId: "card-inter",
    });

    expect(next.categories.map((category) => category.name).sort()).toEqual(["Alimentação", "Compras"]);
    const byTitle = new Map(next.transactions.filter((tx) => tx.source === "csv").map((tx) => [tx.raw_title, tx]));
    const compras = next.categories.find((category) => category.name === "Compras")?.id;
    expect(byTitle.get("SHOPEE *LOJAXYZ - Parcela 2/3")?.category_id).toBe(compras);
    expect(byTitle.get("LOJA DESCONHECIDA")?.category_id).toBe(compras);
    expect(byTitle.get("PAGAMENTO ON LINE")?.category_id).toBeNull();
    expect(next.transactions.every((tx) => tx.card_id === "card-inter" && tx.payment_method === "credit_card")).toBe(true);
    // The remaining parcel 3/3 is projected on the same card.
    expect(next.transactions.filter((tx) => tx.source === "projected")).toHaveLength(1);
    expect(batch.card_id).toBe("card-inter");
  });
});
