import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CategorizationRule,
  Category,
  DeletedCsvHash,
  FinanceState,
  ImportBatch,
  RecurringSubscription,
  Transaction,
} from "@/lib/domain/types";

/**
 * Persistence boundary. The store holds an in-memory `FinanceState` and asks the
 * repository to persist each new snapshot; implementations decide how to diff.
 */
export interface FinanceRepository {
  readonly kind: "local" | "supabase";
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

/** Minimal structural validation for untrusted persisted/imported JSON. */
export function parseFinanceState(value: unknown): FinanceState | null {
  if (!isRecord(value) || !isRecord(value.settings)) return null;
  if (!STATE_ARRAY_KEYS.every((key) => Array.isArray(value[key]))) return null;
  const settings = value.settings;
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
  return validTx ? (value as unknown as FinanceState) : null;
}

// ------------------------------------------------------------- localStorage

const STORAGE_KEY = "arrumabolso:state:v1";

export class LocalStorageRepository implements FinanceRepository {
  readonly kind = "local" as const;

  async load(): Promise<FinanceState | null> {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return parseFinanceState(JSON.parse(raw));
    } catch {
      // Corrupted payload: treated as "no data" so the app can re-seed.
      return null;
    }
  }

  async save(_previous: FinanceState | null, next: FinanceState): Promise<void> {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async clear(): Promise<void> {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

// ----------------------------------------------------------------- Supabase

type TableName =
  | "categories"
  | "recurring_subscriptions"
  | "import_batches"
  | "transactions"
  | "categorization_rules"
  | "deleted_csv_hashes";

interface TableSpec<T> {
  table: TableName;
  key: (item: T) => string;
  keyColumn: string;
  select: (state: FinanceState) => readonly T[];
}

const CHUNK_SIZE = 500;

function chunk<T>(items: readonly T[]): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += CHUNK_SIZE) chunks.push(items.slice(index, index + CHUNK_SIZE));
  return chunks;
}

const TABLES = {
  categories: { table: "categories", keyColumn: "id", key: (item: Category) => item.id, select: (s: FinanceState) => s.categories },
  subscriptions: {
    table: "recurring_subscriptions",
    keyColumn: "id",
    key: (item: RecurringSubscription) => item.id,
    select: (s: FinanceState) => s.recurring_subscriptions,
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
} as const;

export class SupabaseRepository implements FinanceRepository {
  readonly kind = "supabase" as const;

  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  private async fetchAll<T>(table: TableName): Promise<T[]> {
    const { data, error } = await this.client.from(table).select("*").eq("user_id", this.userId);
    if (error) throw new Error(`Falha ao carregar ${table}: ${error.message}`);
    return (data ?? []).map((row: Record<string, unknown>) => {
      const entity = { ...row };
      delete entity.user_id;
      return entity as T;
    });
  }

  async load(): Promise<FinanceState | null> {
    const { data: profile, error } = await this.client
      .from("profiles")
      .select("display_name, closing_day, monthly_income, dismissed_alerts")
      .eq("id", this.userId)
      .maybeSingle();
    if (error) throw new Error(`Falha ao carregar perfil: ${error.message}`);

    const [categories, transactions, importBatches, deleted, subscriptions, rules] = await Promise.all([
      this.fetchAll<Category>("categories"),
      this.fetchAll<Transaction>("transactions"),
      this.fetchAll<ImportBatch>("import_batches"),
      this.fetchAll<DeletedCsvHash>("deleted_csv_hashes"),
      this.fetchAll<RecurringSubscription>("recurring_subscriptions"),
      this.fetchAll<CategorizationRule>("categorization_rules"),
    ]);

    const isEmpty = categories.length === 0 && transactions.length === 0 && rules.length === 0;
    if (isEmpty) return null;

    return {
      settings: {
        display_name: profile?.display_name ?? "Minha Carteira",
        closing_day: profile?.closing_day ?? 2,
        monthly_income: Number(profile?.monthly_income ?? 0),
        dismissed_alerts: profile?.dismissed_alerts ?? [],
      },
      categories: categories.map((item) => ({ ...item, monthly_limit: Number(item.monthly_limit) })),
      transactions: transactions.map((item) => ({ ...item, amount: Number(item.amount) })),
      import_batches: importBatches,
      deleted_csv_hashes: deleted,
      recurring_subscriptions: subscriptions.map((item) => ({ ...item, expected_amount: Number(item.expected_amount) })),
      categorization_rules: rules,
    };
  }

  private async syncTable<T extends object>(
    spec: TableSpec<T>,
    previous: FinanceState | null,
    next: FinanceState,
    phase: "upsert" | "delete",
  ): Promise<void> {
    const before = new Map((previous ? spec.select(previous) : []).map((item) => [spec.key(item), JSON.stringify(item)]));
    const after = spec.select(next);

    if (phase === "upsert") {
      const changed = after
        .filter((item) => before.get(spec.key(item)) !== JSON.stringify(item))
        .map((item) => ({ ...item, user_id: this.userId }));
      for (const rows of chunk(changed)) {
        const { error } = await this.client.from(spec.table).upsert(rows, {
          onConflict: spec.keyColumn === "id" ? "id" : `user_id,${spec.keyColumn}`,
        });
        if (error) throw new Error(`Falha ao salvar ${spec.table}: ${error.message}`);
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
      if (error) throw new Error(`Falha ao remover de ${spec.table}: ${error.message}`);
    }
  }

  async save(previous: FinanceState | null, next: FinanceState): Promise<void> {
    if (!previous || JSON.stringify(previous.settings) !== JSON.stringify(next.settings)) {
      const { error } = await this.client.from("profiles").upsert({ id: this.userId, ...next.settings });
      if (error) throw new Error(`Falha ao salvar perfil: ${error.message}`);
    }

    // Parents first on upsert, children first on delete (foreign keys).
    const upsertOrder = [TABLES.categories, TABLES.subscriptions, TABLES.batches, TABLES.transactions, TABLES.rules, TABLES.deleted];
    for (const spec of upsertOrder) await this.syncTable(spec as TableSpec<object>, previous, next, "upsert");
    for (const spec of [...upsertOrder].reverse()) await this.syncTable(spec as TableSpec<object>, previous, next, "delete");
  }

  async clear(): Promise<void> {
    const tables: TableName[] = [
      "deleted_csv_hashes",
      "categorization_rules",
      "transactions",
      "import_batches",
      "recurring_subscriptions",
      "categories",
    ];
    for (const table of tables) {
      const { error } = await this.client.from(table).delete().eq("user_id", this.userId);
      if (error) throw new Error(`Falha ao limpar ${table}: ${error.message}`);
    }
  }
}
