import { describe, expect, it } from "vitest";

import { emptyState } from "@/lib/data/initial-state";
import { addPresetCategories, autoCategorizeUncategorized, createTransaction, upsertCategory } from "@/lib/domain/operations";
import { autoSuggestCategory, CATEGORY_PRESETS, defaultNatureForPreset, matchPreset } from "@/lib/import/merchant-categories";
import { applyImport, parseNubankCsv, reconcile } from "@/lib/nubank-parser";

describe("automatic categorisation on import and existing items", () => {
  it("recognises expanded Brazilian merchants including Pix, personal care, services/IOF and tech subscriptions", () => {
    expect(matchPreset("Pix no Crédito - Joao Silva")?.key).toBe("transferencias");
    expect(matchPreset("Barbearia Navalha")?.key).toBe("cuidados");
    expect(matchPreset("O Boticario Shopping")?.key).toBe("cuidados");
    expect(matchPreset("IOF Compra Internacional")?.key).toBe("servicos");
    expect(matchPreset("CURSOR AI SUBSCRIPTION")?.key).toBe("assinaturas");
    expect(matchPreset("PICHAU INFORMATICA")?.key).toBe("compras");
  });

  it("learns automatically from previously categorised merchants in user history", async () => {
    let state = upsertCategory(emptyState(), { name: "Padaria & Café", color: "#F97316", icon: "utensils", monthly_limit: 200 });
    const cat = state.categories[0];

    // User categorised "Banca do Ze" manually in a previous invoice (no rule created).
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      date: "2026-10-10",
      invoice_month: "2026-11",
      title: "Banca do Ze",
      amount: 15,
      category_id: cat.id,
      notes: "",
      recurrence: { kind: "single" },
    });

    const parsed = await parseNubankCsv("date,title,amount\n2026-11-10,Banca do Ze,18.50\n");
    const report = reconcile(parsed, state, { filename: "Nubank_2026-12-09.csv", invoiceMonth: "2026-12" });
    expect(report.rows[0].suggestedCategoryId).toBe(cat.id);
    expect(report.rows[0].suggestedCategorySource).toBe("history");
  });

  it("matches custom user category names automatically", () => {
    const state = upsertCategory(emptyState(), { name: "Consultoria", color: "#2563EB", icon: "tag", monthly_limit: 0 });
    const suggestion = autoSuggestCategory({
      rawTitle: "CONSULTORIA ACME LTDA",
      cleanTitle: "Consultoria Acme Ltda",
      bankCategory: null,
      categories: state.categories,
      transactions: [],
    });
    expect(suggestion.categoryId).toBe(state.categories[0].id);
    expect(suggestion.source).toBe("user_category");
  });

  it("learns manual overrides as reusable rules and optionally classifies remaining items as Outros", async () => {
    let state = upsertCategory(emptyState(), { name: "Lazer", color: "#EAB308", icon: "clapperboard", monthly_limit: 300 });
    const lazer = state.categories[0];

    const csv = `date,title,amount
2026-11-05,Clube Secreto XYZ,95.00
2026-11-06,Loja Desconhecida ABC,40.00
2026-11-07,Ifd*Outback,110.00`;
    const parsed = await parseNubankCsv(csv);
    const report = reconcile(parsed, state, { filename: "Nubank_2026-12-09.csv", invoiceMonth: "2026-12" });

    // Row 3 (Ifd*Outback) auto-categorised via dictionary; row 1 manually overridden to Lazer; row 2 falls back to Outros.
    const row1 = report.rows[0];
    const applied = applyImport(state, report, {
      categoryOverrides: { [row1.lineNumber]: lazer.id },
      restoreHashes: new Set(),
      cardId: null,
      learnRules: true,
      fallbackToOther: true,
    });
    state = applied.state;

    // Learned rule was persisted automatically for "clube secreto xyz".
    expect(state.categorization_rules.some((r) => r.pattern === "clube secreto xyz" && r.category_id === lazer.id)).toBe(true);
    // All 3 expenses have a category (Lazer, Outros, Alimentação).
    expect(state.transactions.every((tx) => tx.category_id !== null)).toBe(true);
    expect(state.categories.some((c) => c.name === "Outros")).toBe(true);
    expect(state.categories.some((c) => c.name === "Alimentação")).toBe(true);
  });

  it("auto-categorises existing uncategorised expenses in one click", () => {
    let state = createTransaction(emptyState(), {
      type: "expense",
      payment_method: "credit_card",
      date: "2026-11-05",
      invoice_month: "2026-12",
      title: "Uber *Trip",
      amount: 25,
      category_id: null,
      notes: "",
      recurrence: { kind: "single" },
    });
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      date: "2026-11-06",
      invoice_month: "2026-12",
      title: "Drogasil",
      amount: 40,
      category_id: null,
      notes: "",
      recurrence: { kind: "single" },
    });

    const result = autoCategorizeUncategorized(state);
    expect(result.categorized).toBe(2);
    expect(result.createdCategories).toEqual(expect.arrayContaining(["Transporte", "Saúde"]));
    expect(result.state.transactions.every((tx) => tx.category_id !== null)).toBe(true);
  });

  it("recognises specific new categories (Video Game, Manutenção de Carro, Esporte, Combustível, Investimentos) and supports batch preset creation", () => {
    expect(CATEGORY_PRESETS.length).toBeGreaterThanOrEqual(28);
    expect(matchPreset("Steam Games Compra")?.key).toBe("videogame");
    expect(matchPreset("PlayStation Store BR")?.key).toBe("videogame");
    expect(matchPreset("Xbox Game Pass Ultimate")?.key).toBe("videogame");
    expect(matchPreset("Auto Center DPaschoal Troca de Oleo")?.key).toBe("manutencao_carro");
    expect(matchPreset("Borracharia e Alinhamento")?.key).toBe("manutencao_carro");
    expect(matchPreset("Posto Shell Box Gasolina")?.key).toBe("combustivel");
    expect(matchPreset("Growth Suplementos Whey")?.key).toBe("esportes");
    expect(matchPreset("Quadra Beach Tennis")?.key).toBe("esportes");
    expect(matchPreset("Tesouro Direto Aporte")?.key).toBe("investimentos");
    expect(defaultNatureForPreset("investimentos")).toBe("financial");
    expect(defaultNatureForPreset("manutencao_carro")).toBe("essential");

    const added1 = addPresetCategories(emptyState(), ["videogame", "manutencao_carro", "esportes"]);
    expect(added1.added).toEqual(["Manutenção de Carro", "Video Game", "Esporte"]);
    expect(added1.state.categories).toHaveLength(3);

    // Calling again is idempotent (no duplicates).
    const added2 = addPresetCategories(added1.state, ["videogame", "manutencao_carro", "combustivel"]);
    expect(added2.added).toEqual(["Combustível"]);
    expect(added2.state.categories).toHaveLength(4);
  });
});

