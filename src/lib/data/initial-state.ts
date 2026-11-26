import type { FinanceState } from "@/lib/domain/types";

/** State every new account starts with: no categories, transactions, rules or subscriptions. */
export function emptyState(): FinanceState {
  return {
    settings: {
      display_name: "Minha Carteira",
      avatar_style: null,
      avatar_seed: null,
      theme: "light",
      closing_day: 2,
      monthly_income: 0,
      dismissed_alerts: [],
    },
    categories: [],
    cards: [],
    transactions: [],
    import_batches: [],
    deleted_csv_hashes: [],
    recurring_subscriptions: [],
    income_sources: [],
    categorization_rules: [],
    savings_goals: [],
    invoice_reconciliations: [],
    accounts: [],
    quick_templates: [],
    pets: [],
  };
}
