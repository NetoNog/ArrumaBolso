/** Invoice/cycle month in the `YYYY-MM` format (e.g. `2026-12`). */
export type InvoiceMonth = string;

/** Calendar date in the `YYYY-MM-DD` format. */
export type IsoDate = string;

export type TransactionType = "expense" | "income" | "payment";
export type PaymentMethod = "credit_card" | "pix_debit" | "cash" | "boleto";

/** Banks whose card statements the importer recognises. */
export type CardIssuer =
  | "nubank"
  | "inter"
  | "itau"
  | "bradesco"
  | "santander"
  | "c6"
  | "bb"
  | "caixa"
  | "xp"
  | "other";
export type CardBrand = "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "other";
export type CategoryNature = "essential" | "lifestyle" | "financial";
export type AccountKind = "checking" | "cash" | "savings" | "voucher" | "investment";
export type PetSpecies = "dog" | "cat" | "bird" | "rodent" | "reptile" | "fish" | "other";
export type PetExpenseKind = "food" | "vet" | "grooming" | "meds" | "accessories" | "boarding" | "other";
export type TransactionSource = "csv" | "manual" | "projected";

export type RecurrenceFrequency = "monthly" | "quarterly" | "semiannual" | "annual";
export type IncomeFrequency = "monthly" | "annual" | "once";

/** Fields the user can edit; once edited they are listed in `locked_fields`. */
export type EditableField =
  | "clean_title"
  | "amount"
  | "date"
  | "invoice_month"
  | "category_id"
  | "notes"
  | "tags"
  | "type"
  | "payment_method"
  | "card_id"
  | "account_id"
  | "transfer_account_id"
  | "refund_of_transaction_id"
  | "original_currency"
  | "original_amount"
  | "iof_amount"
  | "receipt_path"
  | "line_items"
  | "pet_id"
  | "pet_expense_kind"
  | "installment_current"
  | "installment_total";

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  monthly_limit: number;
  /** Optional parent category id (for 2-level Category → Subcategory hierarchy). */
  parent_id?: string | null;
  /** 50/30/20 classification: essential (50%), lifestyle (30%), financial/goals (20%). */
  nature?: CategoryNature;
}

/** A bank account, wallet, voucher or investment account holding a real balance. */
export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  initial_balance: number;
  color: string;
  is_archived?: boolean;
}

/** A pet tracked inside the "Meu Pet" module with its own profile and budget. */
export interface Pet {
  id: string;
  name: string;
  species: PetSpecies;
  breed: string;
  birth_date: IsoDate | null;
  weight_kg: number | null;
  monthly_budget: number;
  color: string;
  notes: string;
  is_archived?: boolean;
}

/** One itemised line inside a purchase receipt (e.g. grocery or pharmacy receipt item). */
export interface TransactionLineItem {
  name: string;
  qty: number;
  unit_price: number;
}

/** Saved 1-click favourite expense/income template for zero-friction daily tracking. */
export interface QuickTemplate {
  id: string;
  title: string;
  amount: number;
  type: "expense" | "income";
  payment_method: PaymentMethod;
  category_id: string | null;
  card_id: string | null;
  account_id: string | null;
  tags: string[];
}

/** A credit card (or virtual/additional subcard) the user imports statements from. */
export interface Card {
  id: string;
  name: string;
  issuer: CardIssuer;
  /** Card network (Visa, Mastercard, Elo, Amex...). */
  brand?: CardBrand | null;
  /** Last four digits, used to tell apart two cards of the same bank. */
  last_four: string | null;
  color: string;
  /** Card-specific closing day (1–28); inherits parent card or falls back to profile `closing_day`. */
  closing_day?: number | null;
  /** Card-specific due day (1–31); inherits parent card when null. */
  due_day?: number | null;
  /** Optional credit limit in BRL to track utilization. */
  credit_limit?: number | null;
  /** Pre-selected automatically when creating new credit card expenses. */
  is_default?: boolean;
  /** Archived cards stay hidden from new selectors while keeping full history. */
  is_archived?: boolean;
  /** Parent card id for virtual or additional family cards sharing the main card's limit/cycle. */
  parent_card_id?: string | null;
  /** Optional holder or virtual purpose label (e.g. "Adicional Maria", "Virtual Assinaturas"). */
  holder_name?: string | null;
  /** Optional cashback percentage (e.g. `1` for 1%). */
  cashback_rate?: number | null;
  /** Optional loyalty points earned per USD spent (e.g. `2.2`). */
  points_per_dollar?: number | null;
  /** Optional annual fee in BRL. */
  annual_fee?: number | null;
  /** Optional monthly spend target in BRL that waives the annual fee. */
  waiver_monthly_spend?: number | null;
}

export interface Transaction {
  id: string;
  batch_id: string | null;
  date: IsoDate;
  invoice_month: InvoiceMonth;
  raw_title: string;
  clean_title: string;
  amount: number;
  type: TransactionType;
  payment_method: PaymentMethod;
  /** Card the expense was charged to (credit card entries only). */
  card_id: string | null;
  /** Wallet/bank account debited (expense/payment/transfer out) or credited (income). */
  account_id?: string | null;
  /** Destination wallet/bank account for internal transfers between own accounts. */
  transfer_account_id?: string | null;
  category_id: string | null;
  source: TransactionSource;
  is_user_edited: boolean;
  locked_fields: EditableField[];
  is_ignored: boolean;
  subscription_id: string | null;
  /** Income source this entry was received from (salary management). */
  income_source_id: string | null;
  notes: string;
  /** Cross-cutting labels (e.g. `#viagem`, `#reembolsavel`, `#irpf`). */
  tags?: string[];
  /** Shared id when one purchase was split across multiple categories. */
  split_group_id?: string | null;
  /** When an income/reimbursement offsets a specific expense instead of counting as plain income. */
  refund_of_transaction_id?: string | null;
  /** Original foreign currency ISO code (e.g. `USD`, `EUR`) for international purchases. */
  original_currency?: string | null;
  /** Original purchase amount in foreign currency. */
  original_amount?: number | null;
  /** IOF tax amount in BRL associated with an international purchase. */
  iof_amount?: number | null;
  /** Storage path inside the private `receipts` bucket for an attached receipt/invoice. */
  receipt_path?: string | null;
  /** Optional itemised receipt lines (searchable across the app). */
  line_items?: TransactionLineItem[];
  /** Linked pet id for the "Meu Pet" module. */
  pet_id?: string | null;
  /** Pet expense subtype (food, vet, grooming, meds, accessories, boarding, other). */
  pet_expense_kind?: PetExpenseKind | null;
  installment_group_id: string | null;
  installment_current: number | null;
  installment_total: number | null;
  unique_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportBatch {
  id: string;
  filename: string;
  invoice_month: InvoiceMonth;
  /** Card whose statement was imported. */
  card_id: string | null;
  new_count: number;
  skipped_count: number;
  protected_count: number;
  /** Projected installments that this batch converted into real CSV rows. */
  replaced_projection_ids: string[];
  undone_at: string | null;
  created_at: string;
}

export interface DeletedCsvHash {
  unique_hash: string;
  raw_title: string;
  deleted_at: string;
}

export interface RecurringSubscription {
  id: string;
  title: string;
  expected_amount: number;
  category_id: string | null;
  billing_day: number;
  active: boolean;
  /** Defaults to `monthly`. */
  frequency?: RecurrenceFrequency;
  /** Anchor month (1–12) for quarterly/semiannual/annual bills (e.g. 1 = Jan for IPVA). */
  billing_month?: number | null;
  /** Payment method used to pay this bill/subscription. */
  payment_method?: PaymentMethod;
  /** Linked card when `payment_method` is `credit_card`. */
  card_id?: string | null;
}

export type IncomeKind = "salary" | "freelance" | "benefit" | "other";

/** A recurring or scheduled income: salary, freelance contract, 13th salary, PLR, tax refund... */
export interface IncomeSource {
  id: string;
  title: string;
  kind: IncomeKind;
  /** Net amount expected. */
  expected_amount: number;
  /** Day of the month the money usually arrives. */
  pay_day: number;
  active: boolean;
  /** Defaults to `monthly`. `annual` fires every `pay_month`; `once` fires on `scheduled_month`. */
  frequency?: IncomeFrequency;
  /** Month of year (1–12) for `annual` income (e.g. 12 for 13th salary). */
  pay_month?: number | null;
  /** Exact `YYYY-MM` invoice month for `once` scheduled income. */
  scheduled_month?: InvoiceMonth | null;
}

export interface CategorizationRule {
  id: string;
  pattern: string;
  clean_name_override: string | null;
  category_id: string | null;
  priority: number;
  /** When true, `pattern` is evaluated as a case-insensitive regular expression. */
  is_regex?: boolean;
  /** Optional minimum absolute amount for this rule to match. */
  min_amount?: number | null;
  /** Optional maximum absolute amount for this rule to match. */
  max_amount?: number | null;
  /** Optional payment method filter. */
  payment_method?: PaymentMethod | null;
  /** Optional subscription to link automatically when matched. */
  subscription_id?: string | null;
  /** When true, matched imported items are automatically flagged as ignored. */
  mark_ignored?: boolean;
}

/** A savings/accumulation goal tracked alongside budgets and free cash flow. */
export interface SavingsGoal {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  target_month: InvoiceMonth | null;
  color: string;
}

export type ReconciliationStatus = "checked" | "paid";

/** User reconciliation record comparing a bank's closed invoice total against the app. */
export interface InvoiceReconciliation {
  id: string;
  invoice_month: InvoiceMonth;
  card_id: string | null;
  expected_total: number;
  status: ReconciliationStatus;
  notes: string;
  checked_at: string;
}

/** Colour theme of the signed-in app, stored per user. */
export type ThemePreference = "light" | "dark";

export interface UserSettings {
  /** Nickname shown in the app (the "Apelido"). */
  display_name: string;
  /** DiceBear style id of the profile picture; `null` shows the initials. */
  avatar_style: string | null;
  /** Seed that selects one avatar within the style. */
  avatar_seed: string | null;
  /** The user's own theme; public pages are always light. */
  theme: ThemePreference;
  /** Day of the month on which the card invoice closes (default when a card has no override). */
  closing_day: number;
  /** Fallback expected income, used only while no income source is registered. */
  monthly_income: number;
  dismissed_alerts: string[];
}

export interface FinanceState {
  settings: UserSettings;
  categories: Category[];
  cards: Card[];
  transactions: Transaction[];
  import_batches: ImportBatch[];
  deleted_csv_hashes: DeletedCsvHash[];
  recurring_subscriptions: RecurringSubscription[];
  income_sources: IncomeSource[];
  categorization_rules: CategorizationRule[];
  savings_goals?: SavingsGoal[];
  invoice_reconciliations?: InvoiceReconciliation[];
  accounts?: Account[];
  quick_templates?: QuickTemplate[];
  pets?: Pet[];
}

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  expense: "Despesa",
  income: "Receita / Entrada",
  payment: "Pagamento de Fatura",
};

export const INCOME_KIND_LABEL: Record<IncomeKind, string> = {
  salary: "Salário",
  freelance: "Freelance / PJ",
  benefit: "Benefício",
  other: "Outra renda",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  credit_card: "Cartão de crédito",
  pix_debit: "Pix / Débito",
  cash: "Dinheiro",
  boleto: "Boleto",
};

export const RECURRENCE_FREQUENCY_LABEL: Record<RecurrenceFrequency, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export const INCOME_FREQUENCY_LABEL: Record<IncomeFrequency, string> = {
  monthly: "Mensal",
  annual: "Anual (13º, PLR, férias...)",
  once: "Pontual (mês específico)",
};

export const CARD_BRAND_LABEL: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  elo: "Elo",
  amex: "American Express",
  hipercard: "Hipercard",
  other: "Outra",
};

export const CATEGORY_NATURE_LABEL: Record<CategoryNature, string> = {
  essential: "Essencial (50%)",
  lifestyle: "Estilo de Vida (30%)",
  financial: "Patrimônio / Metas (20%)",
};

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  checking: "Conta Corrente",
  cash: "Dinheiro",
  savings: "Reserva / Caixinha",
  voucher: "Vale (VR / VA)",
  investment: "Investimentos",
};

export const PET_SPECIES_LABEL: Record<PetSpecies, string> = {
  dog: "Cachorro",
  cat: "Gato",
  bird: "Ave",
  rodent: "Roedor / Coelho",
  reptile: "Réptil",
  fish: "Peixe",
  other: "Outro",
};

export const PET_EXPENSE_KIND_LABEL: Record<PetExpenseKind, string> = {
  food: "Ração & Alimentação",
  vet: "Veterinário & Exames",
  grooming: "Banho & Tosa",
  meds: "Vacinas & Medicamentos",
  accessories: "Brinquedos & Acessórios",
  boarding: "Creche / Hotel / Passeio",
  other: "Outros Pet",
};
