import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { emptyState } from "@/lib/data/initial-state";
import { parseFinanceState, SupabaseRepository } from "@/lib/data/repository";

describe("parseFinanceState", () => {
  it("upgrades backups made before per-user themes and cards existed", () => {
    const legacy: Record<string, unknown> = { ...emptyState() };
    const legacySettings: Record<string, unknown> = { ...emptyState().settings };
    delete legacy.cards;
    delete legacySettings.theme;
    const parsed = parseFinanceState({ ...legacy, settings: legacySettings });
    expect(parsed?.settings.theme).toBe("light");
    expect(parsed?.cards).toEqual([]);
  });

  it("keeps a valid theme and rejects unknown values", () => {
    const state = emptyState();
    expect(parseFinanceState({ ...state, settings: { ...state.settings, theme: "dark" } })?.settings.theme).toBe("dark");
    expect(parseFinanceState({ ...state, settings: { ...state.settings, theme: "neon" } })?.settings.theme).toBe("light");
  });

  it("maps the legacy nubank_card method to credit_card", () => {
    const state = emptyState();
    const tx = {
      id: "t1",
      amount: 10,
      date: "2026-11-01",
      invoice_month: "2026-11",
      payment_method: "nubank_card",
    };
    expect(parseFinanceState({ ...state, transactions: [tx] })?.transactions[0].payment_method).toBe("credit_card");
  });
});

describe("SupabaseRepository legacy schema compatibility", () => {
  it("loads cleanly when newer optional tables and profile columns do not exist yet", async () => {
    const missingTables = new Set([
      "cards",
      "accounts",
      "pets",
      "savings_goals",
      "invoice_reconciliations",
      "quick_templates",
    ]);

    const fakeClient = {
      from(table: string) {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    display_name: "Conta Produção",
                    avatar_style: null,
                    avatar_seed: null,
                    closing_day: 5,
                    monthly_income: 8000,
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
                range: async () => {
                  if (missingTables.has(table)) {
                    return {
                      data: null,
                      error: { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` },
                    };
                  }
                  if (table === "transactions") {
                    return {
                      data: [
                        {
                          id: "tx-1",
                          user_id: "u1",
                          date: "2026-11-10",
                          invoice_month: "2026-11",
                          raw_title: "Mercado",
                          clean_title: "Mercado",
                          amount: 120.5,
                          type: "expense",
                          payment_method: "nubank_card",
                          category_id: null,
                          source: "manual",
                          is_user_edited: false,
                          locked_fields: [],
                          is_ignored: false,
                          subscription_id: null,
                          notes: "",
                        },
                      ],
                      error: null,
                    };
                  }
                  return { data: [], error: null };
                },
              }),
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;

    const repo = new SupabaseRepository(fakeClient, "u1");
    const state = await repo.load();
    expect(state?.settings.display_name).toBe("Conta Produção");
    expect(state?.settings.theme).toBe("light");
    expect(state?.cards).toEqual([]);
    expect(state?.accounts).toEqual([]);
    expect(state?.pets).toEqual([]);
    expect(state?.transactions).toHaveLength(1);
    expect(state?.transactions[0].payment_method).toBe("credit_card");
  });

  it("strips unmigrated columns and maps credit_card to nubank_card on legacy databases", async () => {
    const writtenPayloads: Array<{ table: string; rows: Record<string, unknown>[] }> = [];
    const allowedTxColumns = new Set([
      "id",
      "user_id",
      "date",
      "invoice_month",
      "raw_title",
      "clean_title",
      "amount",
      "type",
      "payment_method",
      "category_id",
      "source",
      "is_user_edited",
      "locked_fields",
      "is_ignored",
      "subscription_id",
      "notes",
      "batch_id",
      "installment_group_id",
      "installment_current",
      "installment_total",
      "unique_hash",
      "income_source_id",
      "created_at",
      "updated_at",
    ]);

    const fakeClient = {
      from(table: string) {
        return {
          upsert: async (rows: Record<string, unknown>[]) => {
            if (table === "profiles" && rows.some((row) => "theme" in row)) {
              return { error: { code: "PGRST204", message: "Could not find the 'theme' column of 'profiles' in the schema cache" } };
            }
            if (table === "transactions") {
              for (const row of rows) {
                for (const key of Object.keys(row)) {
                  if (!allowedTxColumns.has(key)) {
                    return { error: { code: "PGRST204", message: `Could not find the '${key}' column of 'transactions' in the schema cache` } };
                  }
                }
                if (row.payment_method === "credit_card") {
                  return {
                    error: {
                      code: "23514",
                      message: 'new row for relation "transactions" violates check constraint "transactions_payment_method_check"',
                    },
                  };
                }
              }
            }
            writtenPayloads.push({ table, rows });
            return { error: null };
          },
        };
      },
    } as unknown as SupabaseClient;

    const repo = new SupabaseRepository(fakeClient, "u1");
    const prev = emptyState();
    const next = {
      ...prev,
      settings: { ...prev.settings, display_name: "Atualizado", theme: "dark" as const },
      transactions: [
        {
          id: "tx-new",
          date: "2026-11-15",
          invoice_month: "2026-11",
          raw_title: "Padaria",
          clean_title: "Padaria",
          amount: 25,
          type: "expense" as const,
          payment_method: "credit_card" as const,
          category_id: null,
          source: "manual" as const,
          is_user_edited: false,
          locked_fields: [],
          is_ignored: false,
          subscription_id: null,
          income_source_id: null,
          card_id: null,
          account_id: null,
          transfer_account_id: null,
          notes: "",
          batch_id: null,
          installment_group_id: null,
          installment_current: null,
          installment_total: null,
          unique_hash: null,
          tags: [],
          split_group_id: null,
          refund_of_transaction_id: null,
          original_currency: null,
          original_amount: null,
          iof_amount: null,
          receipt_path: null,
          line_items: [],
          pet_id: null,
          pet_expense_kind: null,
          created_at: "2026-11-15T12:00:00.000Z",
          updated_at: "2026-11-15T12:00:00.000Z",
        },
      ],
    };

    await repo.save(prev, next);

    const profileWrite = writtenPayloads.find((item) => item.table === "profiles");
    expect(profileWrite?.rows[0]).not.toHaveProperty("theme");
    expect(profileWrite?.rows[0].display_name).toBe("Atualizado");

    const txWrite = writtenPayloads.find((item) => item.table === "transactions");
    expect(txWrite?.rows[0].payment_method).toBe("nubank_card");
    expect(txWrite?.rows[0]).not.toHaveProperty("pet_id");
    expect(txWrite?.rows[0]).not.toHaveProperty("card_id");
  });
});
