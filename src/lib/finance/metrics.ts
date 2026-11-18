import {
  addMonths,
  compareMonths,
  cycleBounds,
  eachDay,
  formatDateBR,
  formatMonthLabel,
  monthRange,
} from "@/lib/dates";
import { expectedPayDate } from "@/lib/domain/operations";
import {
  PAYMENT_METHOD_LABEL,
  type Category,
  type FinanceState,
  type IncomeSource,
  type InvoiceMonth,
  type IsoDate,
  type PaymentMethod,
  type Transaction,
} from "@/lib/domain/types";
import { formatBRL, sumMoney } from "@/lib/money";

export function isCountedExpense(tx: Transaction): boolean {
  return tx.type === "expense" && !tx.is_ignored;
}

export function transactionsOfMonth(state: FinanceState, month: InvoiceMonth): Transaction[] {
  return state.transactions.filter((tx) => tx.invoice_month === month);
}

export function expensesOfMonth(state: FinanceState, month: InvoiceMonth): Transaction[] {
  return transactionsOfMonth(state, month).filter(isCountedExpense);
}

export function invoiceTotal(state: FinanceState, month: InvoiceMonth): number {
  return sumMoney(expensesOfMonth(state, month).map((tx) => tx.amount));
}

export function paymentsTotal(state: FinanceState, month: InvoiceMonth): number {
  return sumMoney(
    transactionsOfMonth(state, month)
      .filter((tx) => tx.type === "payment" && !tx.is_ignored)
      .map((tx) => Math.abs(tx.amount)),
  );
}

export function incomeTotal(state: FinanceState, month: InvoiceMonth): number {
  return sumMoney(
    transactionsOfMonth(state, month)
      .filter((tx) => tx.type === "income" && !tx.is_ignored)
      .map((tx) => tx.amount),
  );
}

// ---------------------------------------------------------------- cash flow
//
// Entradas e saídas use the same competence as the rest of the app (the
// invoice month). Card invoice payments are transfers between your own money
// and the card, so they are neither an inflow nor an outflow.

export function isCountedIncome(tx: Transaction): boolean {
  return tx.type === "income" && !tx.is_ignored;
}

export function incomeOfMonth(state: FinanceState, month: InvoiceMonth): Transaction[] {
  return transactionsOfMonth(state, month).filter(isCountedIncome);
}

export interface CashFlowSummary {
  inflow: number;
  outflow: number;
  balance: number;
  /** Share of the inflow that was kept; `null` when nothing came in. */
  savingsRate: number | null;
  outflowByMethod: { method: PaymentMethod; label: string; amount: number }[];
  inflowByOrigin: { label: string; amount: number }[];
}

export function cashFlowSummary(state: FinanceState, month: InvoiceMonth): CashFlowSummary {
  const incomes = incomeOfMonth(state, month);
  const expenses = expensesOfMonth(state, month);
  const inflow = sumMoney(incomes.map((tx) => tx.amount));
  const outflow = sumMoney(expenses.map((tx) => tx.amount));
  const balance = sumMoney([inflow, -outflow]);

  const outflowByMethod = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[])
    .map((method) => ({
      method,
      label: PAYMENT_METHOD_LABEL[method],
      amount: sumMoney(expenses.filter((tx) => tx.payment_method === method).map((tx) => tx.amount)),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const sourcesById = new Map(state.income_sources.map((source) => [source.id, source]));
  const byOrigin = new Map<string, number[]>();
  for (const tx of incomes) {
    const label = (tx.income_source_id && sourcesById.get(tx.income_source_id)?.title) || "Outras entradas";
    byOrigin.set(label, [...(byOrigin.get(label) ?? []), tx.amount]);
  }
  const inflowByOrigin = Array.from(byOrigin, ([label, amounts]) => ({ label, amount: sumMoney(amounts) })).sort(
    (a, b) => b.amount - a.amount,
  );

  return { inflow, outflow, balance, savingsRate: inflow > 0 ? balance / inflow : null, outflowByMethod, inflowByOrigin };
}

export interface CashFlowDailyPoint {
  date: IsoDate;
  label: string;
  inflow: number;
  outflow: number;
  /** Running balance (inflow - outflow); `null` for days that have not happened yet. */
  balance: number | null;
}

/** Day-by-day inflow/outflow over the cycle of `month`, with the running balance. */
export function dailyCashFlowSeries(state: FinanceState, month: InvoiceMonth, today: IsoDate): CashFlowDailyPoint[] {
  const { start, end } = cycleBounds(month, state.settings.closing_day);
  const movements = [...incomeOfMonth(state, month), ...expensesOfMonth(state, month)];
  const inByDay = new Map<IsoDate, number[]>();
  const outByDay = new Map<IsoDate, number[]>();
  for (const tx of movements) {
    // Items whose competence was moved outside the natural cycle count on the first day.
    const day = tx.date < start || tx.date > end ? start : tx.date;
    const bucket = tx.type === "income" ? inByDay : outByDay;
    bucket.set(day, [...(bucket.get(day) ?? []), tx.amount]);
  }

  let running = 0;
  return eachDay(start, end).map((date) => {
    const inflow = sumMoney(inByDay.get(date) ?? []);
    const outflow = sumMoney(outByDay.get(date) ?? []);
    running = sumMoney([running, inflow, -outflow]);
    return { date, label: formatDateBR(date).slice(0, 5), inflow, outflow, balance: date > today ? null : running };
  });
}

export interface CashFlowMonthPoint {
  month: InvoiceMonth;
  label: string;
  inflow: number;
  outflow: number;
  balance: number;
}

/** Inflow vs outflow for the `count` months ending at `lastMonth`. */
export function cashFlowHistory(state: FinanceState, lastMonth: InvoiceMonth, count = 6): CashFlowMonthPoint[] {
  return monthRange(addMonths(lastMonth, -(count - 1)), count).map((month) => {
    const { inflow, outflow, balance } = cashFlowSummary(state, month);
    return { month, label: formatMonthLabel(month), inflow, outflow, balance };
  });
}

// ----------------------------------------------------------- income sources

/** Expected monthly income: the active income sources, or the manual fallback while none exist. */
export function expectedMonthlyIncome(state: FinanceState): number {
  if (state.income_sources.length === 0) return state.settings.monthly_income;
  return sumMoney(state.income_sources.filter((source) => source.active).map((source) => source.expected_amount));
}

export type IncomeStatus = "received" | "partial" | "overdue" | "upcoming";

export interface IncomeSourceMonth {
  source: IncomeSource;
  expectedDate: IsoDate;
  received: Transaction[];
  receivedTotal: number;
  status: IncomeStatus;
}

/** What a source paid in the cycle of `month` and whether it is on time. */
export function incomeSourceMonth(state: FinanceState, source: IncomeSource, month: InvoiceMonth, today: IsoDate): IncomeSourceMonth {
  const expectedDate = expectedPayDate(month, source.pay_day, state.settings.closing_day);
  const received = state.transactions
    .filter((tx) => tx.income_source_id === source.id && tx.invoice_month === month && isCountedIncome(tx))
    .sort((a, b) => a.date.localeCompare(b.date));
  const receivedTotal = sumMoney(received.map((tx) => tx.amount));
  const status: IncomeStatus =
    received.length > 0 && receivedTotal >= source.expected_amount
      ? "received"
      : received.length > 0
        ? "partial"
        : expectedDate < today
          ? "overdue"
          : "upcoming";
  return { source, expectedDate, received, receivedTotal, status };
}

export function averageTicket(state: FinanceState, month: InvoiceMonth): number {
  const expenses = expensesOfMonth(state, month);
  return expenses.length === 0 ? 0 : sumMoney(expenses.map((tx) => tx.amount)) / expenses.length;
}

export function totalBudget(categories: readonly Category[]): number {
  return sumMoney(categories.map((category) => category.monthly_limit));
}

export interface CommitmentBreakdown {
  installments: number;
  subscriptions: number;
  scheduled: number;
  total: number;
}

/**
 * Recurring obligations of a month: installments, subscriptions (real charge if
 * already present, otherwise the expected amount) and manual items dated in the future.
 */
export function committedFor(
  state: FinanceState,
  month: InvoiceMonth,
  currentMonth: InvoiceMonth,
  today: IsoDate,
): CommitmentBreakdown {
  const expenses = expensesOfMonth(state, month);
  const installments = sumMoney(
    expenses.filter((tx) => (tx.installment_total ?? 0) > 1).map((tx) => tx.amount),
  );

  const chargedSubscriptions = new Set<string>();
  const subscriptionCharges: number[] = [];
  for (const tx of expenses) {
    if (tx.subscription_id && (tx.installment_total ?? 0) <= 1) {
      chargedSubscriptions.add(tx.subscription_id);
      subscriptionCharges.push(tx.amount);
    }
  }
  if (compareMonths(month, currentMonth) >= 0) {
    for (const sub of state.recurring_subscriptions) {
      if (sub.active && !chargedSubscriptions.has(sub.id)) subscriptionCharges.push(sub.expected_amount);
    }
  }
  const subscriptions = sumMoney(subscriptionCharges);

  const scheduled = sumMoney(
    expenses
      .filter(
        (tx) =>
          (tx.installment_total ?? 0) <= 1 &&
          !tx.subscription_id &&
          (tx.source === "manual" || tx.source === "projected") &&
          tx.date > today,
      )
      .map((tx) => tx.amount),
  );

  return { installments, subscriptions, scheduled, total: sumMoney([installments, subscriptions, scheduled]) };
}

export interface DailyPoint {
  date: IsoDate;
  label: string;
  spent: number;
  cumulative: number | null;
  ceilingRatio: number | null;
}

export function dailyCumulativeSeries(
  state: FinanceState,
  month: InvoiceMonth,
  today: IsoDate,
): DailyPoint[] {
  const { start, end } = cycleBounds(month, state.settings.closing_day);
  const expenses = expensesOfMonth(state, month);
  const byDay = new Map<IsoDate, number[]>();
  for (const tx of expenses) byDay.set(tx.date, [...(byDay.get(tx.date) ?? []), tx.amount]);
  // Items whose competence was moved outside the natural cycle are added on the first day.
  const outside = expenses.filter((tx) => tx.date < start || tx.date > end).map((tx) => tx.amount);
  const budget = totalBudget(state.categories);

  let running = sumMoney(outside);
  return eachDay(start, end).map((date) => {
    const spent = sumMoney(byDay.get(date) ?? []);
    const isFuture = date > today;
    running = sumMoney([running, spent]);
    return {
      date,
      label: formatDateBR(date).slice(0, 5),
      spent,
      cumulative: isFuture ? null : running,
      ceilingRatio: isFuture || budget === 0 ? null : running / budget,
    };
  });
}

export interface MonthlyPoint {
  month: InvoiceMonth;
  label: string;
  realized: number | null;
  committed: number | null;
  budget: number;
}

/** Realized totals up to the current cycle and committed amounts for the future. */
export function twelveMonthSeries(state: FinanceState, currentMonth: InvoiceMonth, today: IsoDate): MonthlyPoint[] {
  const budget = totalBudget(state.categories);
  return monthRange(addMonths(currentMonth, -2), 12).map((month) => {
    const position = compareMonths(month, currentMonth);
    const realized = position <= 0 ? invoiceTotal(state, month) : null;
    const committed = position > 0 ? committedFor(state, month, currentMonth, today).total : position === 0 ? realized : null;
    return { month, label: formatMonthLabel(month), realized, committed, budget };
  });
}

export interface CategoryBreakdown {
  category: Category | null;
  spent: number;
  limit: number;
  ratio: number;
}

export function categoryBreakdown(state: FinanceState, month: InvoiceMonth): CategoryBreakdown[] {
  const expenses = expensesOfMonth(state, month);
  const rows: CategoryBreakdown[] = state.categories.map((category) => {
    const spent = sumMoney(expenses.filter((tx) => tx.category_id === category.id).map((tx) => tx.amount));
    return { category, spent, limit: category.monthly_limit, ratio: category.monthly_limit > 0 ? spent / category.monthly_limit : 0 };
  });
  const knownIds = new Set(state.categories.map((category) => category.id));
  const uncategorized = sumMoney(
    expenses.filter((tx) => !tx.category_id || !knownIds.has(tx.category_id)).map((tx) => tx.amount),
  );
  if (uncategorized > 0) rows.push({ category: null, spent: uncategorized, limit: 0, ratio: 1 });
  return rows.sort((a, b) => b.spent - a.spent);
}

export interface InstallmentGroup {
  groupId: string;
  title: string;
  categoryId: string | null;
  total: number;
  parcelAmount: number;
  parcels: Transaction[];
  paidCount: number;
  remainingAmount: number;
  lastMonth: InvoiceMonth;
  currentParcel: number | null;
}

export function installmentGroups(state: FinanceState, currentMonth: InvoiceMonth): InstallmentGroup[] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of state.transactions) {
    if (!tx.installment_group_id || !tx.installment_total || tx.type !== "expense") continue;
    groups.set(tx.installment_group_id, [...(groups.get(tx.installment_group_id) ?? []), tx]);
  }
  return Array.from(groups.entries())
    .map(([groupId, parcels]) => {
      const sorted = [...parcels].sort((a, b) => (a.installment_current ?? 0) - (b.installment_current ?? 0));
      const reference = sorted[0];
      const future = sorted.filter((tx) => compareMonths(tx.invoice_month, currentMonth) > 0);
      const inCurrent = sorted.find((tx) => tx.invoice_month === currentMonth);
      return {
        groupId,
        title: reference.clean_title,
        categoryId: reference.category_id,
        total: reference.installment_total ?? sorted.length,
        parcelAmount: reference.amount,
        parcels: sorted,
        paidCount: sorted.filter((tx) => compareMonths(tx.invoice_month, currentMonth) <= 0).length,
        remainingAmount: sumMoney(future.map((tx) => tx.amount)),
        lastMonth: sorted[sorted.length - 1].invoice_month,
        currentParcel: inCurrent?.installment_current ?? null,
      };
    })
    .sort((a, b) => a.lastMonth.localeCompare(b.lastMonth));
}

export function activeInstallmentGroups(state: FinanceState, currentMonth: InvoiceMonth): InstallmentGroup[] {
  return installmentGroups(state, currentMonth).filter((group) => compareMonths(group.lastMonth, currentMonth) >= 0);
}

// -------------------------------------------------------------------- alerts

export type AlertKind = "installment" | "duplicate" | "subscription" | "ending";

export interface FinanceAlert {
  key: string;
  kind: AlertKind;
  badges: { label: string; tone: "blue" | "amber" | "violet" | "emerald" | "rose" | "slate" }[];
  title: string;
  description: string;
  transactionIds: string[];
}

export function duplicateCandidates(state: FinanceState, month: InvoiceMonth): Transaction[][] {
  const buckets = new Map<string, Transaction[]>();
  for (const tx of expensesOfMonth(state, month)) {
    const key = `${tx.date}|${tx.raw_title.trim().toLowerCase()}|${tx.amount.toFixed(2)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), tx]);
  }
  return Array.from(buckets.values()).filter((group) => group.length > 1);
}

export function buildAlerts(state: FinanceState, month: InvoiceMonth, today: IsoDate): FinanceAlert[] {
  const alerts: FinanceAlert[] = [];
  const dismissed = new Set(state.settings.dismissed_alerts);
  const nextMonth = addMonths(month, 1);

  for (const tx of expensesOfMonth(state, month)) {
    if (!tx.installment_total || !tx.installment_current) continue;
    const label = `PARCELA ${tx.installment_current}/${tx.installment_total}`;
    if (tx.installment_current < tx.installment_total) {
      alerts.push({
        key: `installment:${tx.id}`,
        kind: "installment",
        badges: [
          { label, tone: "blue" },
          { label: tx.payment_method === "nubank_card" ? "CRÉDITO" : "MANUAL", tone: "slate" },
        ],
        title: tx.clean_title,
        description: `${formatBRL(tx.amount)} • Projeta ${formatBRL(tx.amount)} em ${formatMonthLabel(nextMonth)}`,
        transactionIds: [tx.id],
      });
    } else {
      alerts.push({
        key: `ending:${tx.id}`,
        kind: "ending",
        badges: [
          { label: "ENCERRANDO", tone: "emerald" },
          { label: "ALÍVIO", tone: "slate" },
        ],
        title: `${tx.clean_title} (Parcela ${tx.installment_current}/${tx.installment_total})`,
        description: `${formatBRL(tx.amount)} • Última parcela neste ciclo`,
        transactionIds: [tx.id],
      });
    }
  }

  for (const group of duplicateCandidates(state, month)) {
    const first = group[0];
    alerts.push({
      key: `duplicate:${group.map((tx) => tx.id).sort().join(",")}`,
      kind: "duplicate",
      badges: [
        { label: "DUPLICIDADE?", tone: "amber" },
        { label: "REVISAR", tone: "slate" },
      ],
      title: `${first.clean_title} (${group.length}x ${formatBRL(first.amount)})`,
      description: `${formatDateBR(first.date)} • Mesmo valor no mesmo dia`,
      transactionIds: group.map((tx) => tx.id),
    });
  }

  const activeSubs = state.recurring_subscriptions.filter((sub) => sub.active);
  if (activeSubs.length > 0) {
    const commitment = committedFor(state, month, month, today);
    const names = activeSubs.map((sub) => sub.title.split(" ")[0]);
    const uniqueNames = Array.from(new Set(names));
    alerts.push({
      key: `subscriptions:${month}:${activeSubs.map((sub) => sub.id).sort().join(",")}`,
      kind: "subscription",
      badges: [
        { label: "ASSINATURA", tone: "violet" },
        { label: "RECORRENTE", tone: "slate" },
      ],
      title: uniqueNames.slice(0, 3).join(" + ") + (uniqueNames.length > 3 ? ` +${uniqueNames.length - 3}` : ""),
      description: `${formatBRL(commitment.subscriptions)}/mês • Renovação automática`,
      transactionIds: [],
    });
  }

  const order: Record<AlertKind, number> = { installment: 0, duplicate: 1, subscription: 2, ending: 3 };
  return alerts.filter((alert) => !dismissed.has(alert.key)).sort((a, b) => order[a.kind] - order[b.kind]);
}

export function delta(current: number, previous: number): { value: number; ratio: number | null } {
  return { value: sumMoney([current, -previous]), ratio: previous === 0 ? null : (current - previous) / previous };
}

export function invoiceMonthsWithData(state: FinanceState): InvoiceMonth[] {
  return Array.from(new Set(state.transactions.map((tx) => tx.invoice_month))).sort();
}
