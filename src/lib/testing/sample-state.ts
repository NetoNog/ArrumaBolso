/**
 * Test fixture only: a realistic two-invoice state used by the parser and
 * reconciliation tests. Never loaded by the app.
 */
import type {
  Card,
  CategorizationRule,
  Category,
  FinanceState,
  RecurringSubscription,
  Transaction,
} from "@/lib/domain/types";
import { newId } from "@/lib/hash";
import { applyImport, parseNubankCsv, reconcile } from "@/lib/nubank-parser";

/** Invoice Nov/2026 (cycle 02/10 – 01/11): 20 purchases totalling R$ 1.012,67. */
export const SAMPLE_CSV_NOV_2026 = `date,title,amount
2026-10-03,Totalpass,99.90
2026-10-04,Economiafarma - Parcela 1/2,39.86
2026-10-05,MACK VII,180.00
2026-10-06,Ifd*Outback,112.40
2026-10-08,Mp *Mercadolivre,89.90
2026-10-09,Google One,9.99
2026-10-10,Supermercado Dia,76.35
2026-10-11,Pagamento recebido,-1320.45
2026-10-11,Uber *Trip,22.10
2026-10-12,YouTube Music,26.90
2026-10-14,99food *Habibs,31.50
2026-10-15,Tim*Tim Controle,59.00
2026-10-16,Padaria Real,9.80
2026-10-18,Drogasil,18.90
2026-10-20,Cinemark,64.00
2026-10-22,Ifd*Sushi House,71.20
2026-10-24,Uber *Trip,16.45
2026-10-26,Estacionamento Centro,15.00
2026-10-28,Mp *Shopee,27.32
2026-10-30,Lavanderia Bolha,28.00
2026-11-01,Ifd*Burger King,14.10
`;

/** Open invoice Dez/2026 (cycle 02/11 – 01/12): 23 purchases totalling R$ 1.154,97 + one payment. */
export const SAMPLE_CSV_DEC_2026 = `date,title,amount
2026-11-03,Totalpass,99.90
2026-11-03,Ifd*Burger King,38.90
2026-11-04,Pix no Crédito - Carloslimadesouza - Parcela 1/2,375.00
2026-11-04,Economiafarma - Parcela 2/2,39.86
2026-11-05,99food *Habibs,27.49
2026-11-05,Mp *Mercadolivre,45.80
2026-11-06,Uber *Trip,18.73
2026-11-07,64900927edinelma,15.00
2026-11-07,64900927edinelma,15.00
2026-11-07,Padaria Real,12.50
2026-11-08,MACK VII,103.92
2026-11-09,Google One,9.99
2026-11-09,Ifd*Pizzaria Bella,54.90
2026-11-10,Drogasil,23.47
2026-11-10,Mp *Shopee,33.00
2026-11-11,Uber *Trip,14.22
2026-11-11,Pagamento recebido,-1500.12
2026-11-12,Cinemark,32.00
2026-11-12,YouTube Music,26.90
2026-11-13,Supermercado Dia,41.18
2026-11-14,99food *Mc Donalds,22.13
2026-11-14,Estacionamento Centro,18.00
2026-11-15,Tim*Tim Controle,59.00
2026-11-16,Lavanderia Bolha,28.08
`;

type CategoryKey =
  | "food"
  | "transport"
  | "health"
  | "subscriptions"
  | "shopping"
  | "leisure"
  | "transfers"
  | "other";

const SAMPLE_CATEGORIES: Record<CategoryKey, Omit<Category, "id">> = {
  food: { name: "Alimentação", color: "#F97316", icon: "utensils", monthly_limit: 900 },
  transport: { name: "Transporte", color: "#0EA5E9", icon: "car", monthly_limit: 160 },
  health: { name: "Saúde", color: "#10B981", icon: "heart-pulse", monthly_limit: 300 },
  subscriptions: { name: "Assinaturas", color: "#8B5CF6", icon: "repeat", monthly_limit: 300 },
  shopping: { name: "Compras", color: "#EC4899", icon: "shopping-bag", monthly_limit: 590 },
  leisure: { name: "Lazer", color: "#EAB308", icon: "clapperboard", monthly_limit: 150 },
  transfers: { name: "Transferências / Pix", color: "#2563EB", icon: "arrow-left-right", monthly_limit: 500 },
  other: { name: "Outros", color: "#64748B", icon: "shapes", monthly_limit: 100 },
};

const SAMPLE_RULES: readonly [pattern: string, category: CategoryKey, cleanName: string | null][] = [
  ["carloslimadesouza", "transfers", null],
  ["edinelma", "transfers", null],
  ["mack vii", "transport", "Posto Mack VII"],
  ["uber", "transport", "Uber"],
  ["estacionamento", "transport", null],
  ["totalpass", "subscriptions", "Totalpass"],
  ["google one", "subscriptions", "Google One"],
  ["youtube", "subscriptions", "YouTube Music"],
  ["tim*tim", "subscriptions", "Tim Controle"],
  ["economiafarma", "health", "Economiafarma"],
  ["drogasil", "health", null],
  ["ifd*", "food", null],
  ["99food", "food", null],
  ["padaria", "food", null],
  ["supermercado", "food", null],
  ["mercadolivre", "shopping", "Mercado Livre"],
  ["shopee", "shopping", "Shopee"],
  ["cinemark", "leisure", null],
  ["lavanderia", "other", null],
];

const SAMPLE_SUBSCRIPTIONS: readonly [title: string, amount: number, category: CategoryKey, day: number][] = [
  ["Totalpass", 99.9, "subscriptions", 3],
  ["Google One", 9.99, "subscriptions", 9],
  ["YouTube Music", 26.9, "subscriptions", 12],
  ["Tim Controle", 59.0, "subscriptions", 15],
];

export async function buildSampleState(): Promise<FinanceState> {
  const categoryIds = Object.fromEntries(
    (Object.keys(SAMPLE_CATEGORIES) as CategoryKey[]).map((key) => [key, newId()]),
  ) as Record<CategoryKey, string>;

  const categories: Category[] = (Object.keys(SAMPLE_CATEGORIES) as CategoryKey[]).map((key) => ({
    id: categoryIds[key],
    ...SAMPLE_CATEGORIES[key],
  }));

  const rules: CategorizationRule[] = SAMPLE_RULES.map(([pattern, category, cleanName], index) => ({
    id: newId(),
    pattern,
    clean_name_override: cleanName,
    category_id: categoryIds[category],
    priority: SAMPLE_RULES.length - index,
  }));

  const subscriptions: RecurringSubscription[] = SAMPLE_SUBSCRIPTIONS.map(([title, amount, category, day]) => ({
    id: newId(),
    title,
    expected_amount: amount,
    category_id: categoryIds[category],
    billing_day: day,
    active: true,
  }));

  const card: Card = { id: newId(), name: "Nubank", issuer: "nubank", last_four: null, color: "#820AD1" };

  let state: FinanceState = {
    settings: {
      display_name: "Minha Carteira",
      avatar_style: null,
      avatar_seed: null,
      theme: "light",
      closing_day: 2,
      monthly_income: 4800,
      dismissed_alerts: [],
    },
    categories,
    cards: [card],
    transactions: [],
    import_batches: [],
    deleted_csv_hashes: [],
    recurring_subscriptions: subscriptions,
    income_sources: [],
    categorization_rules: rules,
  };

  const imports = [
    { csv: SAMPLE_CSV_NOV_2026, filename: "Nubank_2026-11-09.csv", month: "2026-11", at: "2026-11-02T09:15:00.000Z" },
    { csv: SAMPLE_CSV_DEC_2026, filename: "Nubank_2026-12-09.csv", month: "2026-12", at: "2026-11-16T21:40:00.000Z" },
  ];
  for (const item of imports) {
    const parsed = await parseNubankCsv(item.csv);
    const report = reconcile(parsed, state, { filename: item.filename, invoiceMonth: item.month });
    state = applyImport(state, report, { categoryOverrides: {}, restoreHashes: new Set(), cardId: card.id }, item.at).state;
  }

  const salary: Transaction = {
    id: newId(),
    batch_id: null,
    date: "2026-11-05",
    invoice_month: "2026-12",
    raw_title: "Salário",
    clean_title: "Salário",
    amount: 4800,
    type: "income",
    payment_method: "pix_debit",
    card_id: null,
    category_id: null,
    source: "manual",
    is_user_edited: false,
    locked_fields: [],
    is_ignored: false,
    subscription_id: null,
    income_source_id: null,
    notes: "Entrada registrada manualmente",
    installment_group_id: null,
    installment_current: null,
    installment_total: null,
    unique_hash: null,
    created_at: "2026-11-05T12:00:00.000Z",
    updated_at: "2026-11-05T12:00:00.000Z",
  };

  return { ...state, transactions: [...state.transactions, salary] };
}
