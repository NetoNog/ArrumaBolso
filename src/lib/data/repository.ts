import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Account,
  AccountKind,
  Card,
  CardBrand,
  CategorizationRule,
  Category,
  CategoryNature,
  DeletedCsvHash,
  FinanceState,
  ImportBatch,
  IncomeFrequency,
  IncomeSource,
  InvoiceReconciliation,
  PaymentMethod,
  Pet,
  PetExpenseKind,
  PetSpecies,
  QuickTemplate,
  RecurrenceFrequency,
  RecurringSubscription,
  SavingsGoal,
  ThemePreference,
  Transaction,
  TransactionLineItem,
} from "@/lib/domain/types";

function normalizeTheme(value: unknown): ThemePreference {
  return value === "dark" ? "dark" : "light";
}

/** `nubank_card` was the only card method before multi-card support. */
function normalizePaymentMethod(method: unknown): PaymentMethod {
  if (method === "nubank_card") return "credit_card";
  if (method === "credit_card" || method === "pix_debit" || method === "cash" || method === "boleto") return method;
  return "credit_card";
}

function normalizeRecurrenceFrequency(value: unknown): RecurrenceFrequency {
  if (value === "quarterly" || value === "semiannual" || value === "annual") return value;
  return "monthly";
}

function normalizeIncomeFrequency(value: unknown): IncomeFrequency {
  if (value === "annual" || value === "once") return value;
  return "monthly";
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().replace(/^#/, "").toLowerCase())
        .filter(Boolean),
    ),
  );
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBrand(value: unknown): CardBrand | null {
  if (value === "visa" || value === "mastercard" || value === "elo" || value === "amex" || value === "hipercard" || value === "other") {
    return value;
  }
  return null;
}

function normalizeCategoryNature(value: unknown): CategoryNature {
  if (value === "essential" || value === "financial") return value;
  return "lifestyle";
}

function normalizeAccountKind(value: unknown): AccountKind {
  if (value === "cash" || value === "savings" || value === "voucher" || value === "investment") return value;
  return "checking";
}

function normalizePetSpecies(value: unknown): PetSpecies {
  if (value === "cat" || value === "bird" || value === "rodent" || value === "reptile" || value === "fish" || value === "other") {
    return value;
  }
  return "dog";
}

function normalizePetExpenseKind(value: unknown): PetExpenseKind | null {
  if (
    value === "food" ||
    value === "vet" ||
    value === "grooming" ||
    value === "meds" ||
    value === "accessories" ||
    value === "boarding" ||
    value === "other"
  ) {
    return value;
  }
  return null;
}

function normalizePetRow(pet: Pet): Pet {
  return {
    ...pet,
    name: String(pet.name ?? "").trim(),
    species: normalizePetSpecies(pet.species),
    breed: String(pet.breed ?? "").trim(),
    birth_date: typeof pet.birth_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(pet.birth_date) ? pet.birth_date : null,
    weight_kg: optionalNumber(pet.weight_kg),
    monthly_budget: Number(pet.monthly_budget ?? 0),
    color: pet.color || "#F59E0B",
    notes: String(pet.notes ?? ""),
    is_archived: Boolean(pet.is_archived),
  };
}

function normalizeLineItems(value: unknown): TransactionLineItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.name === "string" && item.name.trim() !== "")
    .map((item) => ({
      name: String(item.name).trim(),
      qty: Math.max(1, Number(item.qty ?? 1) || 1),
      unit_price: Math.max(0, Number(item.unit_price ?? 0) || 0),
    }));
}

function normalizeCardRow(card: Card): Card {
  return {
    ...card,
    brand: normalizeBrand(card.brand),
    closing_day: optionalNumber(card.closing_day),
    due_day: optionalNumber(card.due_day),
    credit_limit: optionalNumber(card.credit_limit),
    is_default: Boolean(card.is_default),
    is_archived: Boolean(card.is_archived),
    parent_card_id: card.parent_card_id ?? null,
    holder_name: card.holder_name?.trim() || null,
    cashback_rate: optionalNumber(card.cashback_rate),
    points_per_dollar: optionalNumber(card.points_per_dollar),
    annual_fee: optionalNumber(card.annual_fee),
    waiver_monthly_spend: optionalNumber(card.waiver_monthly_spend),
  };
}

/**
 * Persistence boundary. The store holds an in-memory `FinanceState` and asks the
 * repository to persist each new snapshot; implementations decide how to diff.
 */
export interface FinanceRepository {
  load(): Promise<FinanceState | null>;
  save(previous: FinanceState | null, next: FinanceState): Promise<void>;
  clear(): Promise<void>;
}

// --------------------------------------------------------------- validation

const STATE_ARRAY_KEYS = [
  "categories",
  "transactions",
  "import_batches",
  "deleted_csv_hashes",
  "recurring_subscriptions",
  "categorization_rules",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Minimal structural validation for untrusted persisted/imported JSON. Backups
 * made before newer tables/columns existed are upgraded cleanly.
 */
export function parseFinanceState(input: unknown): FinanceState | null {
  if (!isRecord(input) || !isRecord(input.settings)) return null;
  const value: Record<string, unknown> = {
    income_sources: [],
    cards: [],
    savings_goals: [],
    invoice_reconciliations: [],
    accounts: [],
    quick_templates: [],
    pets: [],
    ...input,
  };
  if (
    ![
      ...STATE_ARRAY_KEYS,
      "income_sources",
      "cards",
      "savings_goals",
      "invoice_reconciliations",
      "accounts",
      "quick_templates",
      "pets",
    ].every((key) => Array.isArray(value[key]))
  ) {
    return null;
  }
  const settings = input.settings;
  if (typeof settings.closing_day !== "number" || typeof settings.display_name !== "string") return null;
  const transactions = value.transactions as unknown[];
  const validTx = transactions.every(
    (tx) =>
      isRecord(tx) &&
      typeof tx.id === "string" &&
      typeof tx.amount === "number" &&
      typeof tx.date === "string" &&
      typeof tx.invoice_month === "string",
  );
  if (!validTx) return null;
  const state = value as unknown as FinanceState;
  return {
    ...state,
    settings: {
      ...state.settings,
      avatar_style: state.settings.avatar_style ?? null,
      avatar_seed: state.settings.avatar_seed ?? null,
      theme: normalizeTheme(state.settings.theme),
    },
    categories: state.categories.map((cat) => ({
      ...cat,
      monthly_limit: Number(cat.monthly_limit ?? 0),
      parent_id: cat.parent_id ?? null,
      nature: normalizeCategoryNature(cat.nature),
    })),
    cards: state.cards.map(normalizeCardRow),
    transactions: state.transactions.map((tx) => ({
      ...tx,
      income_source_id: tx.income_source_id ?? null,
      card_id: tx.card_id ?? null,
      account_id: tx.account_id ?? null,
      transfer_account_id: tx.transfer_account_id ?? null,
      payment_method: normalizePaymentMethod(tx.payment_method),
      tags: normalizeTags(tx.tags),
      split_group_id: tx.split_group_id ?? null,
      refund_of_transaction_id: tx.refund_of_transaction_id ?? null,
      original_currency: typeof tx.original_currency === "string" && /^[A-Z]{3}$/.test(tx.original_currency) ? tx.original_currency : null,
      original_amount: optionalNumber(tx.original_amount),
      iof_amount: optionalNumber(tx.iof_amount),
      receipt_path: tx.receipt_path ?? null,
      line_items: normalizeLineItems(tx.line_items),
      pet_id: tx.pet_id ?? null,
      pet_expense_kind: normalizePetExpenseKind(tx.pet_expense_kind),
    })),
    import_batches: state.import_batches.map((batch) => ({ ...batch, card_id: batch.card_id ?? null })),
    recurring_subscriptions: state.recurring_subscriptions.map((sub) => ({
      ...sub,
      expected_amount: Number(sub.expected_amount),
      frequency: normalizeRecurrenceFrequency(sub.frequency),
      billing_month: optionalNumber(sub.billing_month),
      payment_method: normalizePaymentMethod(sub.payment_method ?? "credit_card"),
      card_id: sub.card_id ?? null,
    })),
    income_sources: state.income_sources.map((src) => ({
      ...src,
      expected_amount: Number(src.expected_amount),
      frequency: normalizeIncomeFrequency(src.frequency),
      pay_month: optionalNumber(src.pay_month),
      scheduled_month: src.scheduled_month ?? null,
    })),
    categorization_rules: state.categorization_rules.map((rule) => ({
      ...rule,
      is_regex: Boolean(rule.is_regex),
      min_amount: optionalNumber(rule.min_amount),
      max_amount: optionalNumber(rule.max_amount),
      payment_method: rule.payment_method ? normalizePaymentMethod(rule.payment_method) : null,
      subscription_id: rule.subscription_id ?? null,
      mark_ignored: Boolean(rule.mark_ignored),
    })),
    savings_goals: (state.savings_goals ?? []).map((goal) => ({
      ...goal,
      target_amount: Number(goal.target_amount),
      current_amount: Number(goal.current_amount ?? 0),
      monthly_contribution: Number(goal.monthly_contribution ?? 0),
      target_month: goal.target_month ?? null,
      color: goal.color || "#10B981",
    })),
    invoice_reconciliations: (state.invoice_reconciliations ?? []).map((rec) => ({
      ...rec,
      card_id: rec.card_id ?? null,
      expected_total: Number(rec.expected_total),
      status: rec.status === "paid" ? "paid" : "checked",
      notes: rec.notes ?? "",
    })),
    accounts: (state.accounts ?? []).map((acc) => ({
      ...acc,
      kind: normalizeAccountKind(acc.kind),
      initial_balance: Number(acc.initial_balance ?? 0),
      color: acc.color || "#2563EB",
      is_archived: Boolean(acc.is_archived),
    })),
    quick_templates: (state.quick_templates ?? []).map((tpl) => ({
      ...tpl,
      amount: Number(tpl.amount),
      type: tpl.type === "income" ? "income" : "expense",
      payment_method: normalizePaymentMethod(tpl.payment_method),
      category_id: tpl.category_id ?? null,
      card_id: tpl.card_id ?? null,
      account_id: tpl.account_id ?? null,
      tags: normalizeTags(tpl.tags),
    })),
    pets: (state.pets ?? []).map(normalizePetRow),
  };
}

// ----------------------------------------------------------------- Supabase

type TableName =
  | "categories"
  | "cards"
  | "accounts"
  | "pets"
  | "recurring_subscriptions"
  | "income_sources"
  | "import_batches"
  | "transactions"
  | "categorization_rules"
  | "deleted_csv_hashes"
  | "savings_goals"
  | "invoice_reconciliations"
  | "quick_templates";

interface TableSpec<T> {
  table: TableName;
  key: (item: T) => string;
  keyColumn: string;
  select: (state: FinanceState) => readonly T[];
}

const CHUNK_SIZE = 500;
/** Matches PostgREST's default `max_rows` so pagination never truncates large accounts. */
export const FETCH_PAGE_SIZE = 1000;

function chunk<T>(items: readonly T[]): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += CHUNK_SIZE) chunks.push(items.slice(index, index + CHUNK_SIZE));
  return chunks;
}

const TABLES = {
  categories: { table: "categories", keyColumn: "id", key: (item: Category) => item.id, select: (s: FinanceState) => s.categories },
  cards: { table: "cards", keyColumn: "id", key: (item: Card) => item.id, select: (s: FinanceState) => s.cards },
  subscriptions: {
    table: "recurring_subscriptions",
    keyColumn: "id",
    key: (item: RecurringSubscription) => item.id,
    select: (s: FinanceState) => s.recurring_subscriptions,
  },
  incomeSources: {
    table: "income_sources",
    keyColumn: "id",
    key: (item: IncomeSource) => item.id,
    select: (s: FinanceState) => s.income_sources,
  },
  batches: { table: "import_batches", keyColumn: "id", key: (item: ImportBatch) => item.id, select: (s: FinanceState) => s.import_batches },
  transactions: { table: "transactions", keyColumn: "id", key: (item: Transaction) => item.id, select: (s: FinanceState) => s.transactions },
  rules: {
    table: "categorization_rules",
    keyColumn: "id",
    key: (item: CategorizationRule) => item.id,
    select: (s: FinanceState) => s.categorization_rules,
  },
  deleted: {
    table: "deleted_csv_hashes",
    keyColumn: "unique_hash",
    key: (item: DeletedCsvHash) => item.unique_hash,
    select: (s: FinanceState) => s.deleted_csv_hashes,
  },
  savingsGoals: {
    table: "savings_goals",
    keyColumn: "id",
    key: (item: SavingsGoal) => item.id,
    select: (s: FinanceState) => s.savings_goals ?? [],
  },
  reconciliations: {
    table: "invoice_reconciliations",
    keyColumn: "id",
    key: (item: InvoiceReconciliation) => item.id,
    select: (s: FinanceState) => s.invoice_reconciliations ?? [],
  },
  accounts: {
    table: "accounts",
    keyColumn: "id",
    key: (item: Account) => item.id,
    select: (s: FinanceState) => s.accounts ?? [],
  },
  quickTemplates: {
    table: "quick_templates",
    keyColumn: "id",
    key: (item: QuickTemplate) => item.id,
    select: (s: FinanceState) => s.quick_templates ?? [],
  },
  pets: {
    table: "pets",
    keyColumn: "id",
    key: (item: Pet) => item.id,
    select: (s: FinanceState) => s.pets ?? [],
  },
} as const;

const OPTIONAL_TABLES = new Set<TableName>([
  "cards",
  "accounts",
  "pets",
  "savings_goals",
  "invoice_reconciliations",
  "quick_templates",
]);

interface PostgrestErrorLike {
  code?: string | null;
  message?: string | null;
}

function isMissingTableError(error: PostgrestErrorLike): boolean {
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  const message = error.message ?? "";
  return /could not find the table|relation .* does not exist/i.test(message);
}

function extractMissingColumn(error: PostgrestErrorLike): string | null {
  const message = error.message ?? "";
  const pgrst = message.match(/Could not find the '([^']+)' column/i);
  if (pgrst?.[1]) return pgrst[1];
  const pg = message.match(/column "([^"]+)" of relation .* does not exist/i);
  if (pg?.[1]) return pg[1];
  if (error.code === "PGRST204" || error.code === "42703") {
    const fallback = message.match(/['"]([a-zA-Z0-9_]+)['"]/);
    if (fallback?.[1]) return fallback[1];
  }
  return null;
}

function isLegacyPaymentMethodConstraintError(error: PostgrestErrorLike): boolean {
  const message = error.message ?? "";
  return (
    (error.code === "23514" || /violates check constraint/i.test(message)) &&
    /transactions_payment_method_check/i.test(message)
  );
}

const SCHEMA_COMPAT_STORAGE_PREFIX = "arrumabolso.schema_compat.v1.";
const SCHEMA_COMPAT_TTL_MS = 24 * 60 * 60 * 1000;

export class SupabaseRepository implements FinanceRepository {
  private readonly missingTables = new Set<TableName>();
  private readonly missingColumns = new Map<string, Set<string>>();
  private readonly schemaCompatKey: string | null;
  private useLegacyPaymentMethod = false;

  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {
    const host = (client as unknown as { supabaseUrl?: string }).supabaseUrl;
    this.schemaCompatKey = host ? `${SCHEMA_COMPAT_STORAGE_PREFIX}${host}` : null;
    this.hydrateMissingTables();
  }

  private hydrateMissingTables(): void {
    if (!this.schemaCompatKey || typeof window === "undefined" || typeof window.sessionStorage === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(this.schemaCompatKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ts?: number; tables?: string[] };
      if (!parsed || typeof parsed.ts !== "number" || Date.now() - parsed.ts > SCHEMA_COMPAT_TTL_MS) {
        window.sessionStorage.removeItem(this.schemaCompatKey);
        return;
      }
      if (Array.isArray(parsed.tables)) {
        for (const table of parsed.tables) {
          if (OPTIONAL_TABLES.has(table as TableName)) {
            this.missingTables.add(table as TableName);
          }
        }
      }
    } catch {
      // Ignore storage access/parse errors in restricted browsing contexts.
    }
  }

  private markMissingTable(table: TableName): void {
    if (this.missingTables.has(table)) return;
    this.missingTables.add(table);
    if (!this.schemaCompatKey || typeof window === "undefined" || typeof window.sessionStorage === "undefined") return;
    try {
      window.sessionStorage.setItem(
        this.schemaCompatKey,
        JSON.stringify({ ts: Date.now(), tables: Array.from(this.missingTables) }),
      );
    } catch {
      // Ignore quota/privacy-mode storage errors.
    }
  }

  private stripMissingColumns(table: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const missing = this.missingColumns.get(table);
    const mapLegacyMethod = table === "transactions" && this.useLegacyPaymentMethod;
    if ((!missing || missing.size === 0) && !mapLegacyMethod) return rows;
    return rows.map((row) => {
      const copy: Record<string, unknown> = { ...row };
      if (missing) {
        for (const col of missing) delete copy[col];
      }
      if (mapLegacyMethod && copy.payment_method === "credit_card") {
        copy.payment_method = "nubank_card";
      }
      return copy;
    });
  }

  /**
   * Upserts rows while gracefully adapting to remote databases that do not yet
   * have the newest additive tables/columns applied.
   */
  private async upsertWithSchemaFallback(
    table: string,
    rows: Record<string, unknown>[],
    onConflict?: string,
  ): Promise<void> {
    const MAX_SCHEMA_RETRIES = 25;
    for (let attempt = 0; attempt <= MAX_SCHEMA_RETRIES; attempt += 1) {
      const payload = this.stripMissingColumns(table, rows);
      const query = onConflict
        ? this.client.from(table).upsert(payload, { onConflict })
        : this.client.from(table).upsert(payload);
      const { error } = await query;
      if (!error) return;

      if (OPTIONAL_TABLES.has(table as TableName) && isMissingTableError(error)) {
        this.markMissingTable(table as TableName);
        return;
      }
      if (table === "transactions" && !this.useLegacyPaymentMethod && isLegacyPaymentMethodConstraintError(error)) {
        this.useLegacyPaymentMethod = true;
        continue;
      }
      const missingCol = extractMissingColumn(error);
      if (missingCol) {
        let set = this.missingColumns.get(table);
        if (!set) {
          set = new Set();
          this.missingColumns.set(table, set);
        }
        if (!set.has(missingCol)) {
          set.add(missingCol);
          continue;
        }
      }
      throw new Error(`Falha ao salvar ${table}: ${error.message}`);
    }
  }

  /**
   * Fetches every row of `table` in pages of `FETCH_PAGE_SIZE`, avoiding
   * PostgREST's silent 1,000-row truncation on accounts with long histories.
   */
  private async fetchAll<T>(table: TableName, orderColumn: string): Promise<T[]> {
    if (this.missingTables.has(table)) return [];
    const all: T[] = [];
    for (let offset = 0; ; offset += FETCH_PAGE_SIZE) {
      const { data, error } = await this.client
        .from(table)
        .select("*")
        .eq("user_id", this.userId)
        .order(orderColumn, { ascending: true })
        .range(offset, offset + FETCH_PAGE_SIZE - 1);
      if (error) {
        if (OPTIONAL_TABLES.has(table) && isMissingTableError(error)) {
          this.markMissingTable(table);
          return [];
        }
        throw new Error(`Falha ao carregar ${table}: ${error.message}`);
      }
      const page = data ?? [];
      for (const row of page as Record<string, unknown>[]) {
        const entity = { ...row };
        delete entity.user_id;
        all.push(entity as T);
      }
      if (page.length < FETCH_PAGE_SIZE) break;
    }
    return all;
  }

  async load(): Promise<FinanceState | null> {
    const [
      profileResult,
      categories,
      cards,
      accounts,
      pets,
      transactions,
      importBatches,
      deleted,
      subscriptions,
      incomeSources,
      rules,
      savingsGoals,
      reconciliations,
      quickTemplates,
    ] = await Promise.all([
      this.client.from("profiles").select("*").eq("id", this.userId).maybeSingle(),
      this.fetchAll<Category>("categories", "id"),
      this.fetchAll<Card>("cards", "id"),
      this.fetchAll<Account>("accounts", "id"),
      this.fetchAll<Pet>("pets", "id"),
      this.fetchAll<Transaction>("transactions", "id"),
      this.fetchAll<ImportBatch>("import_batches", "id"),
      this.fetchAll<DeletedCsvHash>("deleted_csv_hashes", "unique_hash"),
      this.fetchAll<RecurringSubscription>("recurring_subscriptions", "id"),
      this.fetchAll<IncomeSource>("income_sources", "id"),
      this.fetchAll<CategorizationRule>("categorization_rules", "id"),
      this.fetchAll<SavingsGoal>("savings_goals", "id"),
      this.fetchAll<InvoiceReconciliation>("invoice_reconciliations", "id"),
      this.fetchAll<QuickTemplate>("quick_templates", "id"),
    ]);

    if (profileResult.error) throw new Error(`Falha ao carregar perfil: ${profileResult.error.message}`);
    const profileRow = profileResult.data as Partial<FinanceState["settings"]> | null;

    const isEmpty =
      categories.length === 0 &&
      cards.length === 0 &&
      accounts.length === 0 &&
      pets.length === 0 &&
      transactions.length === 0 &&
      rules.length === 0 &&
      incomeSources.length === 0 &&
      savingsGoals.length === 0;
    if (!profileRow && isEmpty) return null;

    return {
      settings: {
        display_name: profileRow?.display_name ?? "Minha Carteira",
        avatar_style: profileRow?.avatar_style ?? null,
        avatar_seed: profileRow?.avatar_seed ?? null,
        theme: normalizeTheme(profileRow?.theme),
        closing_day: profileRow?.closing_day ?? 2,
        monthly_income: Number(profileRow?.monthly_income ?? 0),
        dismissed_alerts: profileRow?.dismissed_alerts ?? [],
      },
      categories: categories.map((item) => ({
        ...item,
        monthly_limit: Number(item.monthly_limit),
        parent_id: item.parent_id ?? null,
        nature: normalizeCategoryNature(item.nature),
      })),
      cards: cards.map(normalizeCardRow),
      accounts: accounts.map((item) => ({
        ...item,
        kind: normalizeAccountKind(item.kind),
        initial_balance: Number(item.initial_balance ?? 0),
        color: item.color || "#2563EB",
        is_archived: Boolean(item.is_archived),
      })),
      pets: pets.map(normalizePetRow),
      transactions: transactions.map((item) => ({
        ...item,
        amount: Number(item.amount),
        income_source_id: item.income_source_id ?? null,
        card_id: item.card_id ?? null,
        account_id: item.account_id ?? null,
        transfer_account_id: item.transfer_account_id ?? null,
        payment_method: normalizePaymentMethod(item.payment_method),
        tags: normalizeTags(item.tags),
        split_group_id: item.split_group_id ?? null,
        refund_of_transaction_id: item.refund_of_transaction_id ?? null,
        original_currency: typeof item.original_currency === "string" && /^[A-Z]{3}$/.test(item.original_currency) ? item.original_currency : null,
        original_amount: optionalNumber(item.original_amount),
        iof_amount: optionalNumber(item.iof_amount),
        receipt_path: item.receipt_path ?? null,
        line_items: normalizeLineItems(item.line_items),
        pet_id: item.pet_id ?? null,
        pet_expense_kind: normalizePetExpenseKind(item.pet_expense_kind),
      })),
      import_batches: importBatches.map((item) => ({ ...item, card_id: item.card_id ?? null })),
      deleted_csv_hashes: deleted,
      recurring_subscriptions: subscriptions.map((item) => ({
        ...item,
        expected_amount: Number(item.expected_amount),
        frequency: normalizeRecurrenceFrequency(item.frequency),
        billing_month: optionalNumber(item.billing_month),
        payment_method: normalizePaymentMethod(item.payment_method ?? "credit_card"),
        card_id: item.card_id ?? null,
      })),
      income_sources: incomeSources.map((item) => ({
        ...item,
        expected_amount: Number(item.expected_amount),
        frequency: normalizeIncomeFrequency(item.frequency),
        pay_month: optionalNumber(item.pay_month),
        scheduled_month: item.scheduled_month ?? null,
      })),
      categorization_rules: rules.map((item) => ({
        ...item,
        is_regex: Boolean(item.is_regex),
        min_amount: optionalNumber(item.min_amount),
        max_amount: optionalNumber(item.max_amount),
        payment_method: item.payment_method ? normalizePaymentMethod(item.payment_method) : null,
        subscription_id: item.subscription_id ?? null,
        mark_ignored: Boolean(item.mark_ignored),
      })),
      savings_goals: savingsGoals.map((item) => ({
        ...item,
        target_amount: Number(item.target_amount),
        current_amount: Number(item.current_amount ?? 0),
        monthly_contribution: Number(item.monthly_contribution ?? 0),
        target_month: item.target_month ?? null,
        color: item.color || "#10B981",
      })),
      invoice_reconciliations: reconciliations.map((item) => ({
        ...item,
        card_id: item.card_id ?? null,
        expected_total: Number(item.expected_total),
        status: item.status === "paid" ? "paid" : "checked",
        notes: item.notes ?? "",
      })),
      quick_templates: quickTemplates.map((item) => ({
        ...item,
        amount: Number(item.amount),
        type: item.type === "income" ? "income" : "expense",
        payment_method: normalizePaymentMethod(item.payment_method),
        category_id: item.category_id ?? null,
        card_id: item.card_id ?? null,
        account_id: item.account_id ?? null,
        tags: normalizeTags(item.tags),
      })),
    };
  }

  private async syncTable<T extends object>(
    spec: TableSpec<T>,
    previous: FinanceState | null,
    next: FinanceState,
    phase: "upsert" | "delete",
  ): Promise<void> {
    if (this.missingTables.has(spec.table)) return;
    const before = new Map((previous ? spec.select(previous) : []).map((item) => [spec.key(item), JSON.stringify(item)]));
    const after = spec.select(next);

    if (phase === "upsert") {
      const changed = after
        .filter((item) => before.get(spec.key(item)) !== JSON.stringify(item))
        .map((item) => ({ ...item, user_id: this.userId }));
      // Self-referencing tables: write parent rows before child rows inside the same save.
      const ordered =
        spec.table === "transactions"
          ? [...changed].sort((a, b) => {
              const aHasRef = Boolean((a as { refund_of_transaction_id?: string | null }).refund_of_transaction_id);
              const bHasRef = Boolean((b as { refund_of_transaction_id?: string | null }).refund_of_transaction_id);
              return Number(aHasRef) - Number(bHasRef);
            })
          : spec.table === "cards"
            ? [...changed].sort((a, b) => {
                const aHasParent = Boolean((a as { parent_card_id?: string | null }).parent_card_id);
                const bHasParent = Boolean((b as { parent_card_id?: string | null }).parent_card_id);
                return Number(aHasParent) - Number(bHasParent);
              })
            : spec.table === "categories"
              ? [...changed].sort((a, b) => {
                  const aHasParent = Boolean((a as { parent_id?: string | null }).parent_id);
                  const bHasParent = Boolean((b as { parent_id?: string | null }).parent_id);
                  return Number(aHasParent) - Number(bHasParent);
                })
              : changed;
      const onConflict = spec.keyColumn === "id" ? "id" : `user_id,${spec.keyColumn}`;
      for (const rows of chunk(ordered)) {
        await this.upsertWithSchemaFallback(spec.table, rows as Record<string, unknown>[], onConflict);
        if (this.missingTables.has(spec.table)) return;
      }
      return;
    }

    const afterKeys = new Set(after.map(spec.key));
    const removed = Array.from(before.keys()).filter((key) => !afterKeys.has(key));
    for (const keys of chunk(removed)) {
      const { error } = await this.client
        .from(spec.table)
        .delete()
        .eq("user_id", this.userId)
        .in(spec.keyColumn, keys);
      if (error) {
        if (OPTIONAL_TABLES.has(spec.table) && isMissingTableError(error)) {
          this.markMissingTable(spec.table);
          return;
        }
        throw new Error(`Falha ao remover de ${spec.table}: ${error.message}`);
      }
    }
  }

  async save(previous: FinanceState | null, next: FinanceState): Promise<void> {
    if (!previous || JSON.stringify(previous.settings) !== JSON.stringify(next.settings)) {
      await this.upsertWithSchemaFallback("profiles", [{ id: this.userId, ...next.settings }]);
    }

    // Parents first on upsert, children first on delete (foreign keys).
    const upsertOrder = [
      TABLES.categories,
      TABLES.cards,
      TABLES.accounts,
      TABLES.pets,
      TABLES.subscriptions,
      TABLES.incomeSources,
      TABLES.batches,
      TABLES.transactions,
      TABLES.rules,
      TABLES.deleted,
      TABLES.savingsGoals,
      TABLES.reconciliations,
      TABLES.quickTemplates,
    ];
    for (const spec of upsertOrder) await this.syncTable(spec as TableSpec<object>, previous, next, "upsert");
    for (const spec of [...upsertOrder].reverse()) await this.syncTable(spec as TableSpec<object>, previous, next, "delete");
  }

  async clear(): Promise<void> {
    const tables: TableName[] = [
      "quick_templates",
      "invoice_reconciliations",
      "savings_goals",
      "deleted_csv_hashes",
      "categorization_rules",
      "transactions",
      "import_batches",
      "recurring_subscriptions",
      "income_sources",
      "pets",
      "accounts",
      "cards",
      "categories",
    ];
    for (const table of tables) {
      if (this.missingTables.has(table)) continue;
      const { error } = await this.client.from(table).delete().eq("user_id", this.userId);
      if (error) {
        if (OPTIONAL_TABLES.has(table) && isMissingTableError(error)) {
          this.missingTables.add(table);
          continue;
        }
        throw new Error(`Falha ao limpar ${table}: ${error.message}`);
      }
    }
  }
}
