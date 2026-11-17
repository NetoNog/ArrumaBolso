/** Invoice/cycle month in the `YYYY-MM` format (e.g. `2026-12`). */
export type InvoiceMonth = string;

/** Calendar date in the `YYYY-MM-DD` format. */
export type IsoDate = string;

export type TransactionType = "expense" | "income" | "payment";
export type PaymentMethod = "nubank_card" | "pix_debit" | "cash" | "boleto";
export type TransactionSource = "csv" | "manual" | "projected";

/** Fields the user can edit; once edited they are listed in `locked_fields`. */
export type EditableField =
  | "clean_title"
  | "amount"
  | "date"
  | "invoice_month"
  | "category_id"
  | "notes"
  | "type"
  | "payment_method"
  | "installment_current"
  | "installment_total";

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  monthly_limit: number;
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
  category_id: string | null;
  source: TransactionSource;
  is_user_edited: boolean;
  locked_fields: EditableField[];
  is_ignored: boolean;
  subscription_id: string | null;
  notes: string;
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
}

export interface CategorizationRule {
  id: string;
  pattern: string;
  clean_name_override: string | null;
  category_id: string | null;
  priority: number;
}

export interface UserSettings {
  display_name: string;
  /** Day of the month on which the card invoice closes. */
  closing_day: number;
  monthly_income: number;
  dismissed_alerts: string[];
}

export interface FinanceState {
  settings: UserSettings;
  categories: Category[];
  transactions: Transaction[];
  import_batches: ImportBatch[];
  deleted_csv_hashes: DeletedCsvHash[];
  recurring_subscriptions: RecurringSubscription[];
  categorization_rules: CategorizationRule[];
}

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  expense: "Despesa",
  income: "Receita / Entrada",
  payment: "Pagamento de Fatura",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  nubank_card: "Cartão Nubank",
  pix_debit: "Pix / Débito",
  cash: "Dinheiro",
  boleto: "Boleto",
};
