import { describe, expect, it } from "vitest";

import { emptyState } from "@/lib/data/initial-state";
import { parseFinanceState } from "@/lib/data/repository";
import {
  archivePet,
  assignTransactionToPet,
  createTransaction,
  deletePet,
  ensurePetCategory,
  upsertPet,
} from "@/lib/domain/operations";
import { parseQuickAdd } from "@/lib/domain/quick-add";
import { allPetsSummary, petAgeLabel, petMonthlySummary } from "@/lib/finance/metrics";
import { inferPetExpenseKind } from "@/lib/import/merchant-categories";

describe("Meu Pet module", () => {
  it("manages pet CRUD, archiving, deletion without losing transactions, and age labels", () => {
    let state = emptyState();
    state = upsertPet(state, {
      name: "Thor",
      species: "dog",
      breed: "Golden Retriever",
      birth_date: "2024-07-10",
      weight_kg: 28.5,
      monthly_budget: 500,
      color: "#F59E0B",
      notes: "Ração hipoalergênica",
    });
    expect(state.pets).toHaveLength(1);
    const thor = state.pets![0];
    expect(petAgeLabel(thor.birth_date, "2026-11-25")).toBe("2 anos e 4 meses");
    expect(petAgeLabel("2026-03-10", "2026-11-25")).toBe("8 meses");

    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      date: "2026-11-10",
      invoice_month: "2026-12",
      title: "Petz Ração Golden 15kg",
      amount: 240,
      category_id: null,
      pet_id: thor.id,
      notes: "",
      recurrence: { kind: "single" },
    });
    expect(state.transactions[0].pet_expense_kind).toBe("food");

    state = archivePet(state, thor.id, true);
    expect(state.pets![0].is_archived).toBe(true);

    // Deleting a pet keeps the transaction intact while clearing pet_id
    state = deletePet(state, thor.id);
    expect(state.pets).toHaveLength(0);
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].pet_id).toBeNull();
  });

  it("summarizes pet expenses by pet, kind, 6m trend, and detects unlinked pet transactions", () => {
    let state = emptyState();
    const ensured = ensurePetCategory(state);
    state = ensured.state;
    const petCatId = ensured.categoryId;

    state = upsertPet(state, {
      name: "Luna",
      species: "cat",
      breed: "Siamês",
      birth_date: "2023-05-01",
      weight_kg: 4.2,
      monthly_budget: 300,
      color: "#8B5CF6",
      notes: "",
    });
    const luna = state.pets![0];

    // Linked grooming expense
    state = createTransaction(state, {
      type: "expense",
      payment_method: "pix_debit",
      date: "2026-11-08",
      invoice_month: "2026-12",
      title: "Banho e Tosa",
      amount: 95,
      category_id: petCatId,
      pet_id: luna.id,
      notes: "",
      recurrence: { kind: "single" },
    });

    // Unlinked imported pet store purchase (e.g. from CSV)
    state = createTransaction(state, {
      type: "expense",
      payment_method: "credit_card",
      date: "2026-11-12",
      invoice_month: "2026-12",
      title: "Cobasi Vacina V10",
      amount: 150,
      category_id: null,
      notes: "",
      recurrence: { kind: "single" },
    });
    const unlinkedId = state.transactions[1].id;

    const beforeAssign = allPetsSummary(state, "2026-12");
    expect(beforeAssign.unlinkedPetTransactions).toHaveLength(1);
    expect(beforeAssign.unlinkedPetTransactions[0].id).toBe(unlinkedId);
    expect(beforeAssign.totalMonth).toBe(245);
    expect(beforeAssign.monthlyTrend6m).toHaveLength(6);

    // 1-click link to Luna infers "meds"
    state = assignTransactionToPet(state, unlinkedId, luna.id);
    const afterAssign = allPetsSummary(state, "2026-12");
    expect(afterAssign.unlinkedPetTransactions).toHaveLength(0);

    const lunaSummary = petMonthlySummary(state, luna, "2026-12");
    expect(lunaSummary.spent).toBe(245);
    expect(lunaSummary.count).toBe(2);
    expect(lunaSummary.budgetRatio).toBeCloseTo(245 / 300);
    expect(lunaSummary.byKind.map((k) => k.kind).sort()).toEqual(["grooming", "meds"]);
  });

  it("recognizes pet names in Quick Add, infers expense kinds, and upgrades legacy backups", () => {
    let state = emptyState();
    state = upsertPet(state, {
      name: "Rex",
      species: "dog",
      breed: "SRD",
      birth_date: null,
      weight_kg: 14,
      monthly_budget: 400,
      color: "#F59E0B",
      notes: "",
    });
    const rex = state.pets![0];

    const quick = parseQuickAdd("120 ração rex pix", state);
    expect(quick).not.toBeNull();
    expect(quick!.petId).toBe(rex.id);
    expect(quick!.petName).toBe("Rex");
    expect(quick!.petExpenseKind).toBe("food");
    expect(quick!.categoryLabel).toBe("Pets");

    expect(inferPetExpenseKind("Consulta Veterinária Dr. João")).toBe("vet");
    expect(inferPetExpenseKind("Bravecto antipulgas")).toBe("meds");
    expect(inferPetExpenseKind("Zee.Dog peitoral")).toBe("accessories");
    expect(inferPetExpenseKind("DogHero hospedagem")).toBe("boarding");

    // Legacy backup without `pets` array upgrades cleanly
    const legacy = {
      settings: emptyState().settings,
      categories: [],
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
    expect(parsed!.pets).toEqual([]);
  });
});

