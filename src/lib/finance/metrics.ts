import {
  addMonths,
  compareMonths,
  cycleBounds,
  daysInMonth,
  eachDay,
  formatDateBR,
  formatMonthLabel,
  monthRange,
  parseIsoDate,
  parseMonth,
} from "@/lib/dates";
import { activeCards, closingDayForCard, effectiveCardConfig, expectedPayDate } from "@/lib/domain/operations";
import {
  PAYMENT_METHOD_LABEL,
  PET_EXPENSE_KIND_LABEL,
  type Account,
  type Card,
  type Category,
  type CategoryNature,
  type FinanceState,
  type IncomeSource,
  type InvoiceMonth,
  type IsoDate,
  type PaymentMethod,
  type Pet,
  type PetExpenseKind,
  type RecurringSubscription,
  type Transaction,
} from "@/lib/domain/types";
import { findCategoryForPreset, inferPetExpenseKind, matchPreset, presetFromCategoryId } from "@/lib/import/merchant-categories";
import { formatBRL, sumMoney } from "@/lib/money";

/**
 * Per-state memoized O(1) lookup indices. Because `FinanceState` is immutable
 * (every mutation creates a new reference), a WeakMap avoids all memory leaks
 * while eliminating repeated O(N²) scans across refunds, months, and card families.
 */
interface StateIndex {
  refundTotals: Map<string, number>;
  txByMonth: Map<InvoiceMonth, Transaction[]>;
  cardFamilies: Map<string, Set<string>>;
}

const STATE_INDEX_CACHE = new WeakMap<FinanceState, StateIndex>();

function getStateIndex(state: FinanceState): StateIndex {
  const cached = STATE_INDEX_CACHE.get(state);
  if (cached) return cached;

  const refundBuckets = new Map<string, number[]>();
  const txByMonth = new Map<InvoiceMonth, Transaction[]>();

  for (const tx of state.transactions) {
    let monthList = txByMonth.get(tx.invoice_month);
    if (!monthList) {
      monthList = [];
      txByMonth.set(tx.invoice_month, monthList);
    }
    monthList.push(tx);

    if (tx.refund_of_transaction_id && tx.type === "income" && !tx.is_ignored) {
      let refunds = refundBuckets.get(tx.refund_of_transaction_id);
      if (!refunds) {
        refunds = [];
        refundBuckets.set(tx.refund_of_transaction_id, refunds);
      }
      refunds.push(Math.abs(tx.amount));
    }
  }

  const refundTotals = new Map<string, number>();
  for (const [expenseId, amounts] of refundBuckets) {
    refundTotals.set(expenseId, sumMoney(amounts));
  }

  const cardFamilies = new Map<string, Set<string>>();
  for (const card of state.cards) {
    const ids = new Set<string>([card.id]);
    if (!card.parent_card_id) {
      for (const child of state.cards) {
        if (child.parent_card_id === card.id) ids.add(child.id);
      }
    }
    cardFamilies.set(card.id, ids);
  }

  const index: StateIndex = { refundTotals, txByMonth, cardFamilies };
  STATE_INDEX_CACHE.set(state, index);
  return index;
}

export function isCountedExpense(tx: Transaction): boolean {
  return tx.type === "expense" && !tx.is_ignored;
}

/** True when an income entry is linked as a refund/reimbursement of an expense. */
export function isLinkedRefund(tx: Transaction): boolean {
  return tx.type === "income" && !tx.is_ignored && Boolean(tx.refund_of_transaction_id);
}

/**
 * Total reimbursements linked to `expenseId` in O(1) via the per-state index.
 * Linked refunds offset the expense's net amount instead of inflating monthly income.
 */
export function refundAmountFor(state: FinanceState, expenseId: string): number {
  return getStateIndex(state).refundTotals.get(expenseId) ?? 0;
}

/** Expense amount after subtracting any linked reimbursements (never negative). */
export function netExpenseAmount(state: FinanceState, tx: Transaction): number {
  if (!isCountedExpense(tx)) return tx.amount;
  const refunded = refundAmountFor(state, tx.id);
  return refunded > 0 ? Math.max(0, sumMoney([tx.amount, -refunded])) : tx.amount;
}

/**
 * Returns the set of card ids belonging to `cardId`: for a main card, includes
 * its virtual/additional child cards; for a child card, returns only itself.
 */
export function cardFamilyIds(state: FinanceState, cardId: string): Set<string> {
  return getStateIndex(state).cardFamilies.get(cardId) ?? new Set<string>([cardId]);
}

export function transactionsOfMonth(
  state: FinanceState,
  month: InvoiceMonth,
  cardId?: string | null,
): Transaction[] {
  const monthTxs = getStateIndex(state).txByMonth.get(month);
  if (!monthTxs || monthTxs.length === 0) return [];
  if (!cardId) return monthTxs;
  const family = cardFamilyIds(state, cardId);
  return monthTxs.filter((tx) => tx.card_id !== null && family.has(tx.card_id));
}

export function expensesOfMonth(
  state: FinanceState,
  month: InvoiceMonth,
  cardId?: string | null,
): Transaction[] {
  return transactionsOfMonth(state, month, cardId).filter(isCountedExpense);
}

export function invoiceTotal(
  state: FinanceState,
  month: InvoiceMonth,
  cardId?: string | null,
): number {
  return sumMoney(expensesOfMonth(state, month, cardId).map((tx) => netExpenseAmount(state, tx)));
}

export function paymentsTotal(
  state: FinanceState,
  month: InvoiceMonth,
  cardId?: string | null,
): number {
  return sumMoney(
    transactionsOfMonth(state, month, cardId)
      .filter((tx) => tx.type === "payment" && !tx.is_ignored)
      .map((tx) => Math.abs(tx.amount)),
  );
}

export function incomeTotal(state: FinanceState, month: InvoiceMonth): number {
  return sumMoney(incomeOfMonth(state, month).map((tx) => tx.amount));
}

// ---------------------------------------------------------------- cash flow

export function isCountedIncome(tx: Transaction): boolean {
  return tx.type === "income" && !tx.is_ignored && !tx.refund_of_transaction_id;
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

  const methodBuckets = new Map<PaymentMethod, number[]>();
  const expenseNets: number[] = [];
  for (const tx of expenses) {
    const net = netExpenseAmount(state, tx);
    expenseNets.push(net);
    let list = methodBuckets.get(tx.payment_method);
    if (!list) {
      list = [];
      methodBuckets.set(tx.payment_method, list);
    }
    list.push(net);
  }
  const outflow = sumMoney(expenseNets);
  const balance = sumMoney([inflow, -outflow]);

  const outflowByMethod = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[])
    .map((method) => ({
      method,
      label: PAYMENT_METHOD_LABEL[method],
      amount: sumMoney(methodBuckets.get(method) ?? []),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const sourcesById = new Map(state.income_sources.map((source) => [source.id, source]));
  const byOrigin = new Map<string, number[]>();
  for (const tx of incomes) {
    const label = (tx.income_source_id && sourcesById.get(tx.income_source_id)?.title) || "Outras entradas";
    let list = byOrigin.get(label);
    if (!list) {
      list = [];
      byOrigin.set(label, list);
    }
    list.push(tx.amount);
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
    const day = tx.date < start || tx.date > end ? start : tx.date;
    const bucket = tx.type === "income" ? inByDay : outByDay;
    const value = tx.type === "expense" ? netExpenseAmount(state, tx) : tx.amount;
    bucket.set(day, [...(bucket.get(day) ?? []), value]);
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

/** True when an income source is scheduled to pay in `month`. */
export function incomeSourceAppliesToMonth(source: IncomeSource, month: InvoiceMonth): boolean {
  if (!source.active) return false;
  const freq = source.frequency ?? "monthly";
  if (freq === "monthly") return true;
  if (freq === "annual") return parseMonth(month).month === (source.pay_month ?? 12);
  return source.scheduled_month === month;
}

/** Baseline monthly recurring income (monthly active sources, or manual fallback while none exist). */
export function expectedMonthlyIncome(state: FinanceState): number {
  if (state.income_sources.length === 0) return state.settings.monthly_income;
  return sumMoney(
    state.income_sources
      .filter((source) => source.active && (source.frequency ?? "monthly") === "monthly")
      .map((source) => source.expected_amount),
  );
}

/** Expected income for a specific month (monthly + matching annual/once sources). */
export function expectedIncomeForMonth(state: FinanceState, month: InvoiceMonth): number {
  if (state.income_sources.length === 0) return state.settings.monthly_income;
  return sumMoney(
    state.income_sources
      .filter((source) => incomeSourceAppliesToMonth(source, month))
      .map((source) => source.expected_amount),
  );
}

export type IncomeStatus = "received" | "partial" | "overdue" | "upcoming";

export interface IncomeSourceMonth {
  source: IncomeSource;
  expectedDate: IsoDate;
  received: Transaction[];
  receivedTotal: number;
  status: IncomeStatus;
  dueInMonth: boolean;
}

/** What a source paid in the cycle of `month` and whether it is on time. */
export function incomeSourceMonth(state: FinanceState, source: IncomeSource, month: InvoiceMonth, today: IsoDate): IncomeSourceMonth {
  const expectedDate = expectedPayDate(month, source.pay_day, state.settings.closing_day);
  const dueInMonth = incomeSourceAppliesToMonth(source, month);
  const received = state.transactions
    .filter((tx) => tx.income_source_id === source.id && tx.invoice_month === month && isCountedIncome(tx))
    .sort((a, b) => a.date.localeCompare(b.date));
  const receivedTotal = sumMoney(received.map((tx) => tx.amount));
  const status: IncomeStatus =
    received.length > 0 && receivedTotal >= source.expected_amount
      ? "received"
      : received.length > 0
        ? "partial"
        : dueInMonth && expectedDate < today
          ? "overdue"
          : "upcoming";
  return { source, expectedDate, received, receivedTotal, status, dueInMonth };
}

// -------------------------------------------------- subscriptions & periodicity

/** True when a recurring subscription/fixed bill falls due in `month`. */
export function subscriptionAppliesToMonth(sub: RecurringSubscription, month: InvoiceMonth): boolean {
  if (!sub.active) return false;
  const freq = sub.frequency ?? "monthly";
  if (freq === "monthly") return true;
  const m = parseMonth(month).month;
  const anchor = sub.billing_month ?? 1;
  if (freq === "annual") return m === anchor;
  if (freq === "semiannual") return (((m - anchor) % 6) + 6) % 6 === 0;
  return (((m - anchor) % 3) + 3) % 3 === 0;
}

/** Monthlyised cost of a subscription (annual / 12, quarterly / 3, etc.). */
export function monthlyEquivalentAmount(sub: RecurringSubscription): number {
  const freq = sub.frequency ?? "monthly";
  if (freq === "annual") return sub.expected_amount / 12;
  if (freq === "semiannual") return sub.expected_amount / 6;
  if (freq === "quarterly") return sub.expected_amount / 3;
  return sub.expected_amount;
}

export interface SubscriptionMonthStatus {
  dueInMonth: boolean;
  paid: boolean;
  paidTransaction: Transaction | null;
  expectedDate: IsoDate;
}

export function subscriptionMonthStatus(
  state: FinanceState,
  sub: RecurringSubscription,
  month: InvoiceMonth,
): SubscriptionMonthStatus {
  const closingDay = closingDayForCard(state, sub.card_id);
  const expectedDate = expectedPayDate(month, sub.billing_day, closingDay);
  const paidTransaction =
    state.transactions.find(
      (tx) => tx.subscription_id === sub.id && tx.invoice_month === month && isCountedExpense(tx),
    ) ?? null;
  return {
    dueInMonth: subscriptionAppliesToMonth(sub, month),
    paid: Boolean(paidTransaction),
    paidTransaction,
    expectedDate,
  };
}

export interface RecurringCandidate {
  title: string;
  averageAmount: number;
  monthsCount: number;
  latestDate: IsoDate;
  billingDay: number;
  categoryId: string | null;
  paymentMethod: PaymentMethod;
  cardId: string | null;
  transactionIds: string[];
}

/**
 * Scans history for non-installment merchants charged in >= 2 distinct months
 * with a consistent value (within ±15%), suggesting them as recurring subscriptions.
 */
export function detectRecurringCandidates(state: FinanceState): RecurringCandidate[] {
  const existingTitles = new Set(state.recurring_subscriptions.map((sub) => sub.title.trim().toLowerCase()));
  const byTitle = new Map<string, Transaction[]>();

  for (const tx of state.transactions) {
    if (!isCountedExpense(tx)) continue;
    if (tx.subscription_id) continue;
    if ((tx.installment_total ?? 0) > 1) continue;
    const key = tx.clean_title.trim().toLowerCase();
    if (!key || existingTitles.has(key)) continue;
    byTitle.set(key, [...(byTitle.get(key) ?? []), tx]);
  }

  const candidates: RecurringCandidate[] = [];
  for (const [, list] of byTitle) {
    const distinctMonths = new Set(list.map((tx) => tx.invoice_month));
    if (distinctMonths.size < 2) continue;
    // Skip high-frequency merchants (e.g. Uber/iFood with 5+ rides per month).
    if (list.length > distinctMonths.size * 1.5) continue;

    const amounts = list.map((tx) => Math.abs(tx.amount));
    const avg = sumMoney(amounts) / amounts.length;
    if (avg <= 0) continue;
    const consistent = amounts.every((val) => Math.abs(val - avg) / avg <= 0.15);
    if (!consistent) continue;

    const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];
    candidates.push({
      title: latest.clean_title,
      averageAmount: Number(avg.toFixed(2)),
      monthsCount: distinctMonths.size,
      latestDate: latest.date,
      billingDay: Number(latest.date.slice(8, 10)),
      categoryId: latest.category_id,
      paymentMethod: latest.payment_method,
      cardId: latest.card_id,
      transactionIds: sorted.map((tx) => tx.id),
    });
  }

  return candidates.sort((a, b) => b.monthsCount - a.monthsCount || b.averageAmount - a.averageAmount).slice(0, 8);
}

// ------------------------------------------------------------------ general

export function averageTicket(state: FinanceState, month: InvoiceMonth, cardId?: string | null): number {
  const expenses = expensesOfMonth(state, month, cardId);
  return expenses.length === 0 ? 0 : sumMoney(expenses.map((tx) => netExpenseAmount(state, tx))) / expenses.length;
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
 * Recurring obligations of a month: installments, subscriptions due in `month`
 * (real charge if already present, otherwise the expected amount) and manual items dated in the future.
 */
export function committedFor(
  state: FinanceState,
  month: InvoiceMonth,
  currentMonth: InvoiceMonth,
  today: IsoDate,
  cardId?: string | null,
): CommitmentBreakdown {
  const expenses = expensesOfMonth(state, month, cardId);
  const installments = sumMoney(
    expenses.filter((tx) => (tx.installment_total ?? 0) > 1).map((tx) => netExpenseAmount(state, tx)),
  );

  const chargedSubscriptions = new Set<string>();
  const subscriptionCharges: number[] = [];
  for (const tx of expenses) {
    if (tx.subscription_id && (tx.installment_total ?? 0) <= 1) {
      chargedSubscriptions.add(tx.subscription_id);
      subscriptionCharges.push(netExpenseAmount(state, tx));
    }
  }
  if (compareMonths(month, currentMonth) >= 0) {
    for (const sub of state.recurring_subscriptions) {
      if (cardId && sub.card_id !== cardId) continue;
      if (subscriptionAppliesToMonth(sub, month) && !chargedSubscriptions.has(sub.id)) {
        subscriptionCharges.push(sub.expected_amount);
      }
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
      .map((tx) => netExpenseAmount(state, tx)),
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
  cardId?: string | null,
): DailyPoint[] {
  const closingDay = closingDayForCard(state, cardId);
  const { start, end } = cycleBounds(month, closingDay);
  const expenses = expensesOfMonth(state, month, cardId);
  const byDay = new Map<IsoDate, number[]>();
  for (const tx of expenses) byDay.set(tx.date, [...(byDay.get(tx.date) ?? []), netExpenseAmount(state, tx)]);
  const outside = expenses.filter((tx) => tx.date < start || tx.date > end).map((tx) => netExpenseAmount(state, tx));
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
export function twelveMonthSeries(
  state: FinanceState,
  currentMonth: InvoiceMonth,
  today: IsoDate,
  cardId?: string | null,
): MonthlyPoint[] {
  const budget = totalBudget(state.categories);
  return monthRange(addMonths(currentMonth, -2), 12).map((month) => {
    const position = compareMonths(month, currentMonth);
    const realized = position <= 0 ? invoiceTotal(state, month, cardId) : null;
    const committed =
      position > 0 ? committedFor(state, month, currentMonth, today, cardId).total : position === 0 ? realized : null;
    return { month, label: formatMonthLabel(month), realized, committed, budget };
  });
}

export interface CategoryBreakdown {
  category: Category | null;
  spent: number;
  limit: number;
  ratio: number;
}

export function categoryBreakdown(
  state: FinanceState,
  month: InvoiceMonth,
  cardId?: string | null,
): CategoryBreakdown[] {
  const expenses = expensesOfMonth(state, month, cardId);
  const rows: CategoryBreakdown[] = state.categories.map((category) => {
    const spent = sumMoney(expenses.filter((tx) => tx.category_id === category.id).map((tx) => netExpenseAmount(state, tx)));
    return { category, spent, limit: category.monthly_limit, ratio: category.monthly_limit > 0 ? spent / category.monthly_limit : 0 };
  });
  const knownIds = new Set(state.categories.map((category) => category.id));
  const uncategorized = sumMoney(
    expenses.filter((tx) => !tx.category_id || !knownIds.has(tx.category_id)).map((tx) => netExpenseAmount(state, tx)),
  );
  if (uncategorized > 0) rows.push({ category: null, spent: uncategorized, limit: 0, ratio: 1 });
  return rows.sort((a, b) => b.spent - a.spent);
}

/** Suggests monthly limits per category from the 3-month average (rounded up to nearest R$ 10). */
export function suggestedCategoryLimits(state: FinanceState, referenceMonth: InvoiceMonth): Map<string, number> {
  const lookback = [addMonths(referenceMonth, -3), addMonths(referenceMonth, -2), addMonths(referenceMonth, -1)];
  const activeMonths = lookback.filter((month) => expensesOfMonth(state, month).length > 0);
  const monthsToUse = activeMonths.length > 0 ? activeMonths : [referenceMonth];

  const suggestions = new Map<string, number>();
  for (const category of state.categories) {
    const totals = monthsToUse.map((month) =>
      sumMoney(
        expensesOfMonth(state, month)
          .filter((tx) => tx.category_id === category.id)
          .map((tx) => netExpenseAmount(state, tx)),
      ),
    );
    const avg = sumMoney(totals) / monthsToUse.length;
    if (avg > 0) {
      suggestions.set(category.id, Math.ceil(avg / 10) * 10);
    }
  }
  return suggestions;
}

const USD_BRL_REF = 5.5;

function diffDays(fromIso: IsoDate, toIso: IsoDate): number {
  const a = parseIsoDate(fromIso);
  const b = parseIsoDate(toIso);
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((utcB - utcA) / 86_400_000);
}

function clampDayDate(month: InvoiceMonth, day: number): IsoDate {
  const { year, month: m } = parseMonth(month);
  const clamped = Math.min(day, daysInMonth(year, m));
  return `${month}-${String(clamped).padStart(2, "0")}`;
}

/** Due date of `invoiceMonth` given closing & due days (if dueDay < closingDay, falls in the next calendar month). */
export function invoiceDueDate(invoiceMonth: InvoiceMonth, closingDay: number, dueDay: number): IsoDate {
  const targetMonth = dueDay <= closingDay ? invoiceMonth : invoiceMonth;
  return clampDayDate(targetMonth, dueDay);
}

/** Next upcoming closing date on or after `today`, plus days until closing and grace days if bought today. */
export function cardCycleCountdown(
  closingDay: number,
  dueDay: number | null,
  today: IsoDate,
): {
  nextClosingDate: IsoDate;
  daysToClose: number;
  nextDueDate: IsoDate | null;
  daysToDue: number | null;
  daysUntilPaymentIfBoughtToday: number;
} {
  const { year, month, day } = parseIsoDate(today);
  const thisMonth = `${year}-${String(month).padStart(2, "0")}`;
  const closingMonth = day < closingDay ? thisMonth : addMonths(thisMonth, 1);
  const nextClosingDate = clampDayDate(closingMonth, closingDay);
  const daysToClose = diffDays(today, nextClosingDate);

  const effectiveDueDay = dueDay ?? Math.min(28, closingDay + 7);
  // Due date for the invoice closing at `nextClosingDate`:
  // If dueDay > closingDay, it's in the same calendar month as `closingMonth`; otherwise in `closingMonth + 1`.
  const dueMonth = effectiveDueDay > closingDay ? closingMonth : addMonths(closingMonth, 1);
  const dueDateForOpenCycle = clampDayDate(dueMonth, effectiveDueDay);
  const daysUntilPaymentIfBoughtToday = diffDays(today, dueDateForOpenCycle);

  // Next upcoming bill payment due date (could be the previously closed bill still due this month).
  let nextDueDate: IsoDate | null = null;
  let daysToDue: number | null = null;
  if (dueDay !== null) {
    const candidateThisMonth = clampDayDate(thisMonth, dueDay);
    nextDueDate = candidateThisMonth >= today ? candidateThisMonth : clampDayDate(addMonths(thisMonth, 1), dueDay);
    daysToDue = diffDays(today, nextDueDate);
  }

  return { nextClosingDate, daysToClose, nextDueDate, daysToDue, daysUntilPaymentIfBoughtToday };
}

export interface SubcardSpend {
  card: Card;
  spent: number;
  count: number;
}

export interface CardMonthlySummary {
  card: Card;
  closingDay: number;
  dueDay: number | null;
  spent: number;
  payments: number;
  count: number;
  /** Closed invoices prior to `month` that are still unpaid and consume real credit limit. */
  unpaidPastBalance: number;
  futureInstallments: number;
  /** Real credit limit consumed: unpaid past + open month + future installments. */
  totalUsed: number;
  limit: number | null;
  limitAvailable: number | null;
  limitRatio: number | null;
  isPaid: boolean;
  daysToClose: number | null;
  daysToDue: number | null;
  nextDueDate: IsoDate | null;
  daysUntilPaymentIfBoughtToday: number | null;
  estimatedCashback: number;
  estimatedPoints: number;
  waiverTarget: number | null;
  waiverRemaining: number | null;
  waiverRatio: number | null;
  subcards: SubcardSpend[];
}

export function cardMonthlySummary(
  state: FinanceState,
  card: Card,
  month: InvoiceMonth,
  today?: IsoDate,
): CardMonthlySummary {
  const cfg = effectiveCardConfig(state, card);
  const family = cardFamilyIds(state, card.id);
  const expenses = expensesOfMonth(state, month, card.id);
  const spent = sumMoney(expenses.map((tx) => netExpenseAmount(state, tx)));
  const payments = paymentsTotal(state, month, card.id);

  // Unpaid closed past invoices (months < `month` not reconciled as paid and with balance > 0).
  const pastMonths = Array.from(
    new Set(
      state.transactions
        .filter((tx) => tx.card_id !== null && family.has(tx.card_id) && compareMonths(tx.invoice_month, month) < 0)
        .map((tx) => tx.invoice_month),
    ),
  );
  const unpaidPastAmounts: number[] = [];
  for (const pastMonth of pastMonths) {
    const rec = (state.invoice_reconciliations ?? []).find(
      (r) => r.invoice_month === pastMonth && (r.card_id === card.id || (card.parent_card_id && r.card_id === card.parent_card_id)),
    );
    if (rec?.status === "paid") continue;
    const pastSpent = invoiceTotal(state, pastMonth, card.id);
    const pastPaid = paymentsTotal(state, pastMonth, card.id);
    const owed = sumMoney([pastSpent, -pastPaid]);
    if (owed > 0.01) unpaidPastAmounts.push(owed);
  }
  const unpaidPastBalance = sumMoney(unpaidPastAmounts);

  const futureInstallments = sumMoney(
    state.transactions
      .filter(
        (tx) =>
          tx.card_id !== null &&
          family.has(tx.card_id) &&
          isCountedExpense(tx) &&
          (tx.installment_total ?? 0) > 1 &&
          compareMonths(tx.invoice_month, month) > 0,
      )
      .map((tx) => netExpenseAmount(state, tx)),
  );

  const recCurrent = (state.invoice_reconciliations ?? []).find(
    (r) => r.invoice_month === month && r.card_id === card.id,
  );
  const isPaid = recCurrent?.status === "paid" || (spent > 0 && payments >= spent - 0.01);

  const totalUsed = sumMoney([unpaidPastBalance, isPaid ? 0 : spent, futureInstallments]);
  const limit = cfg.creditLimit;
  const limitAvailable = limit !== null ? Math.max(0, sumMoney([limit, -totalUsed])) : null;
  const limitRatio = limit && limit > 0 ? totalUsed / limit : null;

  const countdown = today ? cardCycleCountdown(cfg.closingDay, cfg.dueDay, today) : null;
  const estimatedCashback = cfg.cashbackRate && cfg.cashbackRate > 0 ? (spent * cfg.cashbackRate) / 100 : 0;
  const estimatedPoints =
    cfg.pointsPerDollar && cfg.pointsPerDollar > 0 ? Math.round((spent / USD_BRL_REF) * cfg.pointsPerDollar) : 0;
  const waiverTarget = cfg.waiverMonthlySpend;
  const waiverRemaining = waiverTarget && waiverTarget > 0 ? Math.max(0, sumMoney([waiverTarget, -spent])) : null;
  const waiverRatio = waiverTarget && waiverTarget > 0 ? spent / waiverTarget : null;

  const childCards = card.parent_card_id ? [] : state.cards.filter((item) => item.parent_card_id === card.id);
  const subcards: SubcardSpend[] = childCards.map((child) => {
    const childExpenses = state.transactions.filter(
      (tx) => tx.invoice_month === month && tx.card_id === child.id && isCountedExpense(tx),
    );
    return {
      card: child,
      spent: sumMoney(childExpenses.map((tx) => netExpenseAmount(state, tx))),
      count: childExpenses.length,
    };
  });

  return {
    card,
    closingDay: cfg.closingDay,
    dueDay: cfg.dueDay,
    spent,
    payments,
    count: expenses.length,
    unpaidPastBalance,
    futureInstallments,
    totalUsed,
    limit,
    limitAvailable,
    limitRatio,
    isPaid,
    daysToClose: countdown?.daysToClose ?? null,
    daysToDue: countdown?.daysToDue ?? null,
    nextDueDate: countdown?.nextDueDate ?? null,
    daysUntilPaymentIfBoughtToday: countdown?.daysUntilPaymentIfBoughtToday ?? null,
    estimatedCashback,
    estimatedPoints,
    waiverTarget,
    waiverRemaining,
    waiverRatio,
    subcards,
  };
}

export interface BestCardRecommendation {
  card: Card;
  closingDay: number;
  dueDay: number | null;
  daysToClose: number;
  daysUntilPayment: number;
  nextClosingDate: IsoDate;
}

/** Ranks active main cards by grace period (longest days until payment if purchased today first). */
export function bestCardToBuyToday(state: FinanceState, today: IsoDate): BestCardRecommendation[] {
  return activeCards(state)
    .filter((card) => !card.parent_card_id)
    .map((card) => {
      const cfg = effectiveCardConfig(state, card);
      const countdown = cardCycleCountdown(cfg.closingDay, cfg.dueDay, today);
      return {
        card,
        closingDay: cfg.closingDay,
        dueDay: cfg.dueDay,
        daysToClose: countdown.daysToClose,
        daysUntilPayment: countdown.daysUntilPaymentIfBoughtToday,
        nextClosingDate: countdown.nextClosingDate,
      };
    })
    .sort((a, b) => b.daysUntilPayment - a.daysUntilPayment || b.daysToClose - a.daysToClose);
}

export interface InstallmentGroup {
  groupId: string;
  title: string;
  categoryId: string | null;
  cardId: string | null;
  total: number;
  parcelAmount: number;
  parcels: Transaction[];
  paidCount: number;
  remainingAmount: number;
  lastMonth: InvoiceMonth;
  currentParcel: number | null;
}

export function installmentGroups(
  state: FinanceState,
  currentMonth: InvoiceMonth,
  cardId?: string | null,
): InstallmentGroup[] {
  const family = cardId ? cardFamilyIds(state, cardId) : null;
  const groups = new Map<string, Transaction[]>();
  for (const tx of state.transactions) {
    if (!tx.installment_group_id || !tx.installment_total || tx.type !== "expense") continue;
    if (family && (!tx.card_id || !family.has(tx.card_id))) continue;
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
        cardId: reference.card_id,
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

export function activeInstallmentGroups(
  state: FinanceState,
  currentMonth: InvoiceMonth,
  cardId?: string | null,
): InstallmentGroup[] {
  return installmentGroups(state, currentMonth, cardId).filter((group) => compareMonths(group.lastMonth, currentMonth) >= 0);
}

// -------------------------------------------------------------------- alerts

export type AlertKind =
  | "negative_free_balance"
  | "card_limit"
  | "invoice_due"
  | "budget_exceeded"
  | "budget_pace"
  | "income_overdue"
  | "subscription_due"
  | "subscription_drift"
  | "pet_budget"
  | "duplicate"
  | "uncategorized"
  | "monthly_close"
  | "installment"
  | "subscription"
  | "ending";

export type AlertSeverity = "critical" | "warning" | "info";

export interface FinanceAlert {
  key: string;
  kind: AlertKind;
  severity: AlertSeverity;
  badges: { label: string; tone: "blue" | "amber" | "violet" | "emerald" | "rose" | "slate" }[];
  title: string;
  description: string;
  transactionIds: string[];
  href?: string;
}

export interface BuildAlertsOptions {
  /** Include alerts currently in `settings.dismissed_alerts` (used by the Notification Center's "Dispensados" tab). */
  includeDismissed?: boolean;
  /** Days in advance to alert for upcoming invoice / subscription due dates (default 5). */
  dueLeadDays?: number;
}

function isoDaysDiff(fromIso: IsoDate, toIso: IsoDate): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

export function duplicateCandidates(
  state: FinanceState,
  month: InvoiceMonth,
  cardId?: string | null,
): Transaction[][] {
  const buckets = new Map<string, Transaction[]>();
  for (const tx of expensesOfMonth(state, month, cardId)) {
    const key = `${tx.date}|${tx.raw_title.trim().toLowerCase()}|${tx.amount.toFixed(2)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), tx]);
  }
  return Array.from(buckets.values()).filter((group) => group.length > 1);
}

export function buildAlerts(
  state: FinanceState,
  month: InvoiceMonth,
  today: IsoDate,
  cardId?: string | null,
  options?: BuildAlertsOptions,
): FinanceAlert[] {
  const alerts: FinanceAlert[] = [];
  const dismissed = new Set(state.settings.dismissed_alerts);
  const includeDismissed = Boolean(options?.includeDismissed);
  const dueLeadDays = options?.dueLeadDays ?? 5;
  const nextMonth = addMonths(month, 1);

  // -1. Critical: Negative "Saldo Livre Real" when the user tracks accounts.
  const hasActiveAccounts = (state.accounts ?? []).some((a) => !a.is_archived);
  if (hasActiveAccounts && !cardId) {
    const free = realFreeBalance(state, month, today);
    if (free.freeToSpend < 0) {
      alerts.push({
        key: `negative_free_balance:${month}`,
        kind: "negative_free_balance",
        severity: "critical",
        badges: [
          { label: "SALDO NEGATIVO", tone: "rose" },
          { label: "FLUXO", tone: "amber" },
        ],
        title: `Saldo Livre Real negativo (${formatBRL(free.freeToSpend)})`,
        description: `Caixa líquido ${formatBRL(free.liquidBalance)} não cobre faturas (${formatBRL(free.openCardInvoices)}) e fixas (${formatBRL(free.pendingFixedBills)})`,
        transactionIds: [],
        href: "/fluxo",
      });
    }
  }

  // 0. Credit card limit (>=80%) and upcoming invoice due alerts.
  for (const card of activeCards(state).filter((c) => !c.parent_card_id)) {
    if (cardId && card.id !== cardId) continue;
    const summary = cardMonthlySummary(state, card, month, today);
    if (summary.limit && summary.limitRatio !== null && summary.limitRatio >= 0.8) {
      alerts.push({
        key: `card_limit:${card.id}:${month}`,
        kind: "card_limit",
        severity: summary.limitRatio >= 0.95 ? "critical" : "warning",
        badges: [
          { label: "LIMITE ALTO", tone: "rose" },
          { label: `${Math.round(summary.limitRatio * 100)}% USADO`, tone: "amber" },
        ],
        title: `${card.name} atingiu ${Math.round(summary.limitRatio * 100)}% do limite`,
        description: `${formatBRL(summary.totalUsed)} comprometidos de ${formatBRL(summary.limit)} (disponível ${formatBRL(summary.limitAvailable ?? 0)})`,
        transactionIds: [],
        href: "/faturas",
      });
    }
    if (
      summary.dueDay &&
      summary.daysToDue !== null &&
      summary.daysToDue <= dueLeadDays &&
      !summary.isPaid &&
      (summary.spent > 0 || summary.unpaidPastBalance > 0)
    ) {
      const amountDue = summary.unpaidPastBalance > 0 ? summary.unpaidPastBalance : summary.spent;
      alerts.push({
        key: `invoice_due:${card.id}:${summary.nextDueDate ?? month}`,
        kind: "invoice_due",
        severity: summary.daysToDue <= 2 ? "critical" : "warning",
        badges: [
          { label: summary.daysToDue === 0 ? "VENCE HOJE" : `VENCE EM ${summary.daysToDue}D`, tone: "rose" },
          { label: "FATURA", tone: "blue" },
        ],
        title: `Fatura ${card.name} vence em ${summary.nextDueDate ? formatDateBR(summary.nextDueDate) : `dia ${summary.dueDay}`}`,
        description: `${formatBRL(amountDue)} em aberto • marque como paga em Faturas & Parcelas`,
        transactionIds: [],
        href: "/faturas",
      });
    }
  }

  // 1. Category budget exceeded (any day of cycle) + burn-rate pace alerts inside current cycle.
  const breakdown = categoryBreakdown(state, month, cardId);
  const exceededCategoryIds = new Set<string>();
  for (const row of breakdown) {
    if (!row.category || row.limit <= 0 || row.spent <= row.limit) continue;
    exceededCategoryIds.add(row.category.id);
    const excess = sumMoney([row.spent, -row.limit]);
    alerts.push({
      key: `budget_exceeded:${month}:${row.category.id}`,
      kind: "budget_exceeded",
      severity: "critical",
      badges: [
        { label: "TETO ESTOURADO", tone: "rose" },
        { label: `${Math.round(row.ratio * 100)}%`, tone: "amber" },
      ],
      title: `${row.category.name} passou ${formatBRL(excess)} do teto`,
      description: `${formatBRL(row.spent)} gastos vs. teto de ${formatBRL(row.limit)} em ${formatMonthLabel(month)}`,
      transactionIds: [],
      href: "/orcamento",
    });
  }

  const { start, end } = cycleBounds(month, closingDayForCard(state, cardId));
  const insideCurrentCycle = today >= start && today <= end;
  if (insideCurrentCycle) {
    const cycleDays = eachDay(start, end);
    const elapsedDays = cycleDays.filter((d) => d <= today).length;
    const elapsedRatio = cycleDays.length > 0 ? elapsedDays / cycleDays.length : 1;
    if (elapsedRatio >= 0.15 && elapsedRatio < 0.95) {
      for (const row of breakdown) {
        if (!row.category || row.limit <= 0 || row.spent <= 0 || exceededCategoryIds.has(row.category.id)) continue;
        const projectedEnd = row.spent / elapsedRatio;
        if (row.ratio >= 0.7 && projectedEnd > row.limit * 1.05) {
          alerts.push({
            key: `budget_pace:${month}:${row.category.id}`,
            kind: "budget_pace",
            severity: "warning",
            badges: [
              { label: "RITMO ALTO", tone: "rose" },
              { label: `${Math.round(row.ratio * 100)}% DO TETO`, tone: "amber" },
            ],
            title: `${row.category.name} pode estourar o teto`,
            description: `${formatBRL(row.spent)} no dia ${elapsedDays}/${cycleDays.length} • projeção ${formatBRL(projectedEnd)} vs. teto ${formatBRL(row.limit)}`,
            transactionIds: [],
            href: "/orcamento",
          });
        }
      }
    }
  }

  // 1b. Overdue income sources (e.g. salary expected earlier this month and not yet recorded).
  if (!cardId) {
    for (const source of state.income_sources) {
      if (!source.active) continue;
      const info = incomeSourceMonth(state, source, month, today);
      if (info.dueInMonth && info.status === "overdue") {
        alerts.push({
          key: `income_overdue:${source.id}:${month}`,
          kind: "income_overdue",
          severity: "warning",
          badges: [
            { label: "RENDA PENDENTE", tone: "amber" },
            { label: "SALÁRIO", tone: "emerald" },
          ],
          title: `${source.title} ainda não foi registrado`,
          description: `Previsto ${formatBRL(source.expected_amount)} em ${formatDateBR(info.expectedDate)} • confirme em Salário & Renda`,
          transactionIds: [],
          href: "/renda",
        });
      }
    }
  }

  // 1c. Upcoming unpaid subscriptions due within `dueLeadDays` (capped to 3..7 days).
  for (const sub of state.recurring_subscriptions) {
    if (!sub.active) continue;
    if (cardId && sub.card_id !== cardId) continue;
    const subStatus = subscriptionMonthStatus(state, sub, month);
    if (!subStatus.dueInMonth || subStatus.paid) continue;
    const daysAhead = isoDaysDiff(today, subStatus.expectedDate);
    if (daysAhead >= 0 && daysAhead <= Math.min(dueLeadDays, 5)) {
      alerts.push({
        key: `sub_due:${sub.id}:${month}`,
        kind: "subscription_due",
        severity: daysAhead === 0 ? "warning" : "info",
        badges: [
          { label: daysAhead === 0 ? "COBRA HOJE" : `EM ${daysAhead}D`, tone: "amber" },
          { label: "ASSINATURA", tone: "violet" },
        ],
        title: `${sub.title} prevista para ${formatDateBR(subStatus.expectedDate)}`,
        description: `${formatBRL(sub.expected_amount)} • acompanhe ou dê baixa em Assinaturas`,
        transactionIds: [],
        href: "/assinaturas",
      });
    }
  }

  // 1d. Pet monthly budget alerts (>= 80% or exceeded).
  if (!cardId) {
    for (const pet of (state.pets ?? []).filter((p) => !p.is_archived)) {
      if (!(pet.monthly_budget > 0)) continue;
      const summary = petMonthlySummary(state, pet, month);
      if (summary.budgetRatio !== null && summary.budgetRatio >= 0.8) {
        const exceeded = summary.budgetRatio > 1;
        alerts.push({
          key: `pet_budget:${pet.id}:${month}`,
          kind: "pet_budget",
          severity: exceeded ? "critical" : "warning",
          badges: [
            { label: exceeded ? "PET ACIMA DO TETO" : "ORÇAMENTO PET", tone: exceeded ? "rose" : "amber" },
            { label: `${Math.round(summary.budgetRatio * 100)}%`, tone: "slate" },
          ],
          title: `Gastos com ${pet.name} em ${Math.round(summary.budgetRatio * 100)}% do orçamento`,
          description: `${formatBRL(summary.spent)} de ${formatBRL(pet.monthly_budget)} em ${formatMonthLabel(month)}`,
          transactionIds: [],
          href: "/meu-pet",
        });
      }
    }
  }

  // 2. Subscription price-increase alerts.
  for (const sub of state.recurring_subscriptions) {
    if (!sub.active) continue;
    const latest = state.transactions
      .filter((tx) => tx.subscription_id === sub.id && isCountedExpense(tx))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latest) continue;
    const diff = sumMoney([Math.abs(latest.amount), -sub.expected_amount]);
    if (diff >= 1 || (sub.expected_amount > 0 && diff / sub.expected_amount >= 0.03)) {
      alerts.push({
        key: `sub_drift:${sub.id}:${latest.id}`,
        kind: "subscription_drift",
        severity: "warning",
        badges: [
          { label: "REAJUSTE", tone: "rose" },
          { label: "ASSINATURA", tone: "violet" },
        ],
        title: `${sub.title} aumentou ${formatBRL(diff)}`,
        description: `Cobrado ${formatBRL(Math.abs(latest.amount))} em ${formatDateBR(latest.date)} (previsto ${formatBRL(sub.expected_amount)})`,
        transactionIds: [latest.id],
        href: "/assinaturas",
      });
    }
  }

  // 3. Uncategorized triage alert.
  const uncategorized = expensesOfMonth(state, month, cardId).filter((tx) => !tx.category_id);
  if (uncategorized.length >= 3) {
    alerts.push({
      key: `uncategorized:${month}:${uncategorized.length}`,
      kind: "uncategorized",
      severity: "warning",
      badges: [
        { label: "TRIAGEM", tone: "amber" },
        { label: `${uncategorized.length} ITENS`, tone: "slate" },
      ],
      title: `${uncategorized.length} lançamentos sem categoria`,
      description: `${formatBRL(sumMoney(uncategorized.map((tx) => tx.amount)))} aguardando classificação em ${formatMonthLabel(month)}`,
      transactionIds: uncategorized.map((tx) => tx.id),
      href: "/fechamento",
    });
  }

  // 3b. Monthly Close reminder during the last 3 days of the current cycle.
  if (insideCurrentCycle && !cardId) {
    const daysLeft = isoDaysDiff(today, end);
    if (daysLeft >= 0 && daysLeft <= 3 && (uncategorized.length > 0 || expensesOfMonth(state, month).length > 0)) {
      alerts.push({
        key: `monthly_close:${month}`,
        kind: "monthly_close",
        severity: "info",
        badges: [
          { label: "FECHAMENTO", tone: "blue" },
          { label: daysLeft === 0 ? "ÚLTIMO DIA" : `${daysLeft}D RESTANTES`, tone: "slate" },
        ],
        title: `Hora de fechar o ciclo ${formatMonthLabel(month)}`,
        description: "Revise pendências, confira faturas e valide seu saldo livre em Fechamento do Mês",
        transactionIds: [],
        href: "/fechamento",
      });
    }
  }

  // 4. Installments & ending installments (grouped when >= 3 to prevent alert fatigue).
  const activeInstTxs: Transaction[] = [];
  const endingInstTxs: Transaction[] = [];
  for (const tx of expensesOfMonth(state, month, cardId)) {
    if (!tx.installment_total || !tx.installment_current) continue;
    if (tx.installment_current < tx.installment_total) activeInstTxs.push(tx);
    else endingInstTxs.push(tx);
  }

  if (activeInstTxs.length >= 3) {
    const totalNext = sumMoney(activeInstTxs.map((tx) => tx.amount));
    alerts.push({
      key: `installments_group:${month}:${activeInstTxs.length}`,
      kind: "installment",
      severity: "info",
      badges: [
        { label: `${activeInstTxs.length} PARCELAMENTOS`, tone: "blue" },
        { label: "PRÓX. CICLO", tone: "slate" },
      ],
      title: `${activeInstTxs.length} parcelas seguem para ${formatMonthLabel(nextMonth)}`,
      description: `${formatBRL(totalNext)} já comprometidos no próximo ciclo • veja detalhes em Faturas`,
      transactionIds: activeInstTxs.map((tx) => tx.id),
      href: "/faturas",
    });
  } else {
    for (const tx of activeInstTxs) {
      const label = `PARCELA ${tx.installment_current}/${tx.installment_total}`;
      alerts.push({
        key: `installment:${tx.id}`,
        kind: "installment",
        severity: "info",
        badges: [
          { label, tone: "blue" },
          { label: tx.payment_method === "credit_card" ? "CRÉDITO" : "MANUAL", tone: "slate" },
        ],
        title: tx.clean_title,
        description: `${formatBRL(tx.amount)} • Projeta ${formatBRL(tx.amount)} em ${formatMonthLabel(nextMonth)}`,
        transactionIds: [tx.id],
      });
    }
  }

  if (endingInstTxs.length >= 3) {
    const relief = sumMoney(endingInstTxs.map((tx) => tx.amount));
    alerts.push({
      key: `ending_group:${month}:${endingInstTxs.length}`,
      kind: "ending",
      severity: "info",
      badges: [
        { label: `${endingInstTxs.length} ENCERRANDO`, tone: "emerald" },
        { label: "ALÍVIO", tone: "slate" },
      ],
      title: `${endingInstTxs.length} parcelamentos terminam neste ciclo`,
      description: `Alívio de ${formatBRL(relief)}/mês a partir de ${formatMonthLabel(nextMonth)}`,
      transactionIds: endingInstTxs.map((tx) => tx.id),
      href: "/faturas",
    });
  } else {
    for (const tx of endingInstTxs) {
      alerts.push({
        key: `ending:${tx.id}`,
        kind: "ending",
        severity: "info",
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

  for (const group of duplicateCandidates(state, month, cardId)) {
    const first = group[0];
    alerts.push({
      key: `duplicate:${group.map((tx) => tx.id).sort().join(",")}`,
      kind: "duplicate",
      severity: "warning",
      badges: [
        { label: "DUPLICIDADE?", tone: "amber" },
        { label: "REVISAR", tone: "slate" },
      ],
      title: `${first.clean_title} (${group.length}x ${formatBRL(first.amount)})`,
      description: `${formatDateBR(first.date)} • Mesmo valor no mesmo dia`,
      transactionIds: group.map((tx) => tx.id),
    });
  }

  const activeSubs = state.recurring_subscriptions.filter((sub) => subscriptionAppliesToMonth(sub, month));
  if (activeSubs.length > 0) {
    const commitment = committedFor(state, month, month, today, cardId);
    const names = activeSubs.map((sub) => sub.title.split(" ")[0]);
    const uniqueNames = Array.from(new Set(names));
    alerts.push({
      key: `subscriptions:${month}:${activeSubs.map((sub) => sub.id).sort().join(",")}`,
      kind: "subscription",
      severity: "info",
      badges: [
        { label: "ASSINATURA", tone: "violet" },
        { label: "RECORRENTE", tone: "slate" },
      ],
      title: uniqueNames.slice(0, 3).join(" + ") + (uniqueNames.length > 3 ? ` +${uniqueNames.length - 3}` : ""),
      description: `${formatBRL(commitment.subscriptions)}/ciclo • Renovação automática`,
      transactionIds: [],
      href: "/assinaturas",
    });
  }

  const order: Record<AlertKind, number> = {
    negative_free_balance: 0,
    invoice_due: 1,
    card_limit: 2,
    budget_exceeded: 3,
    budget_pace: 4,
    income_overdue: 5,
    subscription_drift: 6,
    pet_budget: 7,
    duplicate: 8,
    subscription_due: 9,
    uncategorized: 10,
    monthly_close: 11,
    installment: 12,
    subscription: 13,
    ending: 14,
  };
  return alerts
    .filter((alert) => includeDismissed || !dismissed.has(alert.key))
    .sort((a, b) => order[a.kind] - order[b.kind]);
}

// --------------------------------------------------------- annual analytics

export interface MerchantRankingRow {
  merchant: string;
  total: number;
  count: number;
  average: number;
  categoryId: string | null;
}

export interface CategoryComparisonRow {
  category: Category;
  currentSpent: number;
  average3m: number;
  average6m: number;
  vsAverage3mRatio: number | null;
}

export interface TagSummaryRow {
  tag: string;
  total: number;
  count: number;
}

export interface CardComparisonRow {
  card: Card;
  total: number;
  share: number;
  count: number;
  estimatedCashback: number;
  estimatedPoints: number;
  annualFee: number;
}

export interface InternationalSummary {
  count: number;
  totalBRL: number;
  totalIOF: number;
  byCurrency: { currency: string; originalTotal: number; brlTotal: number; count: number }[];
}

export interface AnnualAnalytics {
  months: CashFlowMonthPoint[];
  totalInflow: number;
  totalOutflow: number;
  totalBalance: number;
  savingsRate: number | null;
  topMerchants: MerchantRankingRow[];
  categoryComparison: CategoryComparisonRow[];
  tagBreakdown: TagSummaryRow[];
  cardComparison: CardComparisonRow[];
  internationalSummary: InternationalSummary;
}

export function annualAnalytics(state: FinanceState, endMonth: InvoiceMonth, monthsCount = 12): AnnualAnalytics {
  const months = cashFlowHistory(state, endMonth, monthsCount);
  const monthSet = new Set(months.map((m) => m.month));
  const totalInflow = sumMoney(months.map((m) => m.inflow));
  const totalOutflow = sumMoney(months.map((m) => m.outflow));
  const totalBalance = sumMoney([totalInflow, -totalOutflow]);
  const savingsRate = totalInflow > 0 ? totalBalance / totalInflow : null;

  const merchantMap = new Map<string, { label: string; amounts: number[]; categoryId: string | null }>();
  const tagMap = new Map<string, number[]>();

  for (const tx of state.transactions) {
    if (!isCountedExpense(tx) || !monthSet.has(tx.invoice_month)) continue;
    const net = netExpenseAmount(state, tx);
    const key = tx.clean_title.trim().toLowerCase();
    const existing = merchantMap.get(key);
    if (existing) {
      existing.amounts.push(net);
    } else {
      merchantMap.set(key, { label: tx.clean_title.trim(), amounts: [net], categoryId: tx.category_id });
    }
    for (const tag of tx.tags ?? []) {
      tagMap.set(tag, [...(tagMap.get(tag) ?? []), net]);
    }
  }

  const topMerchants: MerchantRankingRow[] = Array.from(merchantMap.values())
    .map((entry) => {
      const total = sumMoney(entry.amounts);
      return {
        merchant: entry.label,
        total,
        count: entry.amounts.length,
        average: total / entry.amounts.length,
        categoryId: entry.categoryId,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  const prev3 = monthRange(addMonths(endMonth, -3), 3);
  const prev6 = monthRange(addMonths(endMonth, -6), 6);
  const spentIn = (month: InvoiceMonth, categoryId: string) =>
    sumMoney(
      expensesOfMonth(state, month)
        .filter((tx) => tx.category_id === categoryId)
        .map((tx) => netExpenseAmount(state, tx)),
    );

  const categoryComparison: CategoryComparisonRow[] = state.categories
    .map((category) => {
      const currentSpent = spentIn(endMonth, category.id);
      const average3m = sumMoney(prev3.map((m) => spentIn(m, category.id))) / 3;
      const average6m = sumMoney(prev6.map((m) => spentIn(m, category.id))) / 6;
      const vsAverage3mRatio = average3m > 0 ? (currentSpent - average3m) / average3m : null;
      return { category, currentSpent, average3m, average6m, vsAverage3mRatio };
    })
    .filter((row) => row.currentSpent > 0 || row.average6m > 0)
    .sort((a, b) => b.currentSpent - a.currentSpent);

  const tagBreakdown: TagSummaryRow[] = Array.from(tagMap, ([tag, amounts]) => ({
    tag,
    total: sumMoney(amounts),
    count: amounts.length,
  })).sort((a, b) => b.total - a.total);

  // Card comparison across the 12-month window (consolidating child/virtual cards under parent if desired, or listing each).
  const cardTotals = new Map<string, number[]>();
  const currencyBuckets = new Map<string, { orig: number[]; brl: number[] }>();
  const iofAmounts: number[] = [];
  let intlCount = 0;
  const intlBrl: number[] = [];

  for (const tx of state.transactions) {
    if (!isCountedExpense(tx) || !monthSet.has(tx.invoice_month)) continue;
    const net = netExpenseAmount(state, tx);
    if (tx.card_id) {
      cardTotals.set(tx.card_id, [...(cardTotals.get(tx.card_id) ?? []), net]);
    }
    const isIofRow = /\biof\b/i.test(tx.raw_title);
    if (tx.iof_amount && tx.iof_amount > 0) iofAmounts.push(tx.iof_amount);
    else if (isIofRow) iofAmounts.push(net);
    if (tx.original_currency && tx.original_amount && tx.original_amount > 0) {
      intlCount += 1;
      intlBrl.push(net);
      const bucket = currencyBuckets.get(tx.original_currency) ?? { orig: [], brl: [] };
      bucket.orig.push(tx.original_amount);
      bucket.brl.push(net);
      currencyBuckets.set(tx.original_currency, bucket);
    }
  }

  const totalAllCards = sumMoney(Array.from(cardTotals.values()).flat());
  const cardComparison: CardComparisonRow[] = state.cards
    .map((card) => {
      const list = cardTotals.get(card.id) ?? [];
      const total = sumMoney(list);
      const cfg = effectiveCardConfig(state, card);
      return {
        card,
        total,
        share: totalAllCards > 0 ? total / totalAllCards : 0,
        count: list.length,
        estimatedCashback: cfg.cashbackRate ? (total * cfg.cashbackRate) / 100 : 0,
        estimatedPoints: cfg.pointsPerDollar ? Math.round((total / USD_BRL_REF) * cfg.pointsPerDollar) : 0,
        annualFee: card.parent_card_id ? 0 : (cfg.annualFee ?? 0),
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  const internationalSummary: InternationalSummary = {
    count: intlCount,
    totalBRL: sumMoney(intlBrl),
    totalIOF: sumMoney(iofAmounts),
    byCurrency: Array.from(currencyBuckets, ([currency, bucket]) => ({
      currency,
      originalTotal: sumMoney(bucket.orig),
      brlTotal: sumMoney(bucket.brl),
      count: bucket.orig.length,
    })).sort((a, b) => b.brlTotal - a.brlTotal),
  };

  return {
    months,
    totalInflow,
    totalOutflow,
    totalBalance,
    savingsRate,
    topMerchants,
    categoryComparison,
    tagBreakdown,
    cardComparison,
    internationalSummary,
  };
}

// ---------------------------------------------------------------- CSV export

function escapeCsvCell(value: string): string {
  if (/[;"\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Exports a list of transactions to an Excel-friendly PT-BR CSV string (UTF-8 BOM + `;`). */
export function transactionsToCsv(transactions: readonly Transaction[], state: FinanceState): string {
  const categoriesById = new Map(state.categories.map((cat) => [cat.id, cat.name]));
  const cardsById = new Map(state.cards.map((card) => [card.id, card.name]));
  const header = [
    "Data",
    "Competência",
    "Título",
    "Título Original",
    "Tipo",
    "Forma de Pagamento",
    "Cartão",
    "Categoria",
    "Valor (R$)",
    "Parcela",
    "Tags",
    "Origem",
    "Ignorado",
    "Notas",
  ];

  const rows = transactions.map((tx) => [
    formatDateBR(tx.date),
    tx.invoice_month,
    tx.clean_title,
    tx.raw_title,
    tx.type,
    PAYMENT_METHOD_LABEL[tx.payment_method],
    tx.card_id ? (cardsById.get(tx.card_id) ?? "") : "",
    tx.category_id ? (categoriesById.get(tx.category_id) ?? "") : "",
    tx.amount.toFixed(2).replace(".", ","),
    tx.installment_current && tx.installment_total ? `${tx.installment_current}/${tx.installment_total}` : "",
    (tx.tags ?? []).map((t) => `#${t}`).join(" "),
    tx.source,
    tx.is_ignored ? "Sim" : "Não",
    tx.notes,
  ]);

  return `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsvCell).join(";")).join("\r\n")}`;
}

export function delta(current: number, previous: number): { value: number; ratio: number | null } {
  return { value: sumMoney([current, -previous]), ratio: previous === 0 ? null : (current - previous) / previous };
}

export function invoiceMonthsWithData(state: FinanceState, cardId?: string | null): InvoiceMonth[] {
  const family = cardId ? cardFamilyIds(state, cardId) : null;
  return Array.from(
    new Set(
      state.transactions
        .filter((tx) => !family || (tx.card_id !== null && family.has(tx.card_id)))
        .map((tx) => tx.invoice_month),
    ),
  ).sort();
}

// -------------------------------------------------- 50/30/20 nature analysis

export interface NatureBreakdown {
  essential: number;
  lifestyle: number;
  financial: number;
  uncategorized: number;
  total: number;
  ratios: Record<CategoryNature, number>;
}

/** Groups a month's net expenses into the 50/30/20 buckets (essential / lifestyle / financial). */
export function nature503020Breakdown(
  state: FinanceState,
  month: InvoiceMonth,
  cardId?: string | null,
): NatureBreakdown {
  const categoriesById = new Map(state.categories.map((cat) => [cat.id, cat]));
  const buckets: Record<CategoryNature | "uncategorized", number[]> = {
    essential: [],
    lifestyle: [],
    financial: [],
    uncategorized: [],
  };

  for (const tx of expensesOfMonth(state, month, cardId)) {
    const net = netExpenseAmount(state, tx);
    const cat = tx.category_id ? categoriesById.get(tx.category_id) : undefined;
    if (!cat) {
      buckets.uncategorized.push(net);
      continue;
    }
    const parent = cat.parent_id ? categoriesById.get(cat.parent_id) : undefined;
    const nature: CategoryNature = cat.nature ?? parent?.nature ?? "lifestyle";
    buckets[nature].push(net);
  }

  const essential = sumMoney(buckets.essential);
  const lifestyle = sumMoney(buckets.lifestyle);
  const financial = sumMoney(buckets.financial);
  const uncategorized = sumMoney(buckets.uncategorized);
  const total = sumMoney([essential, lifestyle, financial, uncategorized]);
  const denom = total > 0 ? total : 1;
  return {
    essential,
    lifestyle,
    financial,
    uncategorized,
    total,
    ratios: {
      essential: essential / denom,
      lifestyle: lifestyle / denom,
      financial: financial / denom,
    },
  };
}

// ------------------------------------------- accounts & real free balance

export interface AccountBalance {
  account: Account;
  balance: number;
  inflows: number;
  outflows: number;
}

/** Computes real current balance of each wallet/account from initial_balance + linked transactions & transfers. */
export function accountBalances(state: FinanceState): AccountBalance[] {
  const accounts = state.accounts ?? [];
  return accounts.map((account) => {
    const inflows: number[] = [];
    const outflows: number[] = [];
    for (const tx of state.transactions) {
      if (tx.is_ignored) continue;
      if (tx.transfer_account_id === account.id) {
        inflows.push(Math.abs(tx.amount));
      }
      if (tx.account_id === account.id) {
        if (tx.type === "income") inflows.push(Math.abs(tx.amount));
        else outflows.push(Math.abs(tx.amount));
      }
    }
    const totalIn = sumMoney(inflows);
    const totalOut = sumMoney(outflows);
    return {
      account,
      inflows: totalIn,
      outflows: totalOut,
      balance: sumMoney([account.initial_balance, totalIn, -totalOut]),
    };
  });
}

export interface RealFreeBalance {
  liquidBalance: number;
  savingsBalance: number;
  openCardInvoices: number;
  pendingFixedBills: number;
  freeToSpend: number;
}

/**
 * Saldo Livre Real = liquid cash/checking/voucher balances − unpaid card
 * invoices in the current cycle − unpaid fixed bills due in the cycle.
 */
export function realFreeBalance(state: FinanceState, month: InvoiceMonth, today: IsoDate): RealFreeBalance {
  const balances = accountBalances(state).filter((row) => !row.account.is_archived);
  const liquidBalance = sumMoney(
    balances
      .filter((row) => row.account.kind === "checking" || row.account.kind === "cash" || row.account.kind === "voucher")
      .map((row) => row.balance),
  );
  const savingsBalance = sumMoney(
    balances
      .filter((row) => row.account.kind === "savings" || row.account.kind === "investment")
      .map((row) => row.balance),
  );

  const mainCards = activeCards(state).filter((c) => !c.parent_card_id);
  const openCardInvoices = sumMoney(
    mainCards.map((card) => {
      const s = cardMonthlySummary(state, card, month, today);
      return sumMoney([s.unpaidPastBalance, s.isPaid ? 0 : Math.max(0, sumMoney([s.spent, -s.payments]))]);
    }),
  );

  const pendingFixedBills = sumMoney(
    state.recurring_subscriptions
      .filter((sub) => (sub.payment_method ?? "credit_card") !== "credit_card")
      .filter((sub) => {
        const st = subscriptionMonthStatus(state, sub, month);
        return st.dueInMonth && !st.paid;
      })
      .map((sub) => sub.expected_amount),
  );

  return {
    liquidBalance,
    savingsBalance,
    openCardInvoices,
    pendingFixedBills,
    freeToSpend: sumMoney([liquidBalance, -openCardInvoices, -pendingFixedBills]),
  };
}

// ----------------------------------------- behavioral spending intelligence

export interface CalendarDayCell {
  date: IsoDate;
  dayNumber: number;
  weekday: number;
  spent: number;
  count: number;
  /** 0 = zero-spend day, 1..4 = relative intensity tier. */
  level: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
}

export interface SpendingCalendarSummary {
  days: CalendarDayCell[];
  zeroSpendDays: number;
  activeDays: number;
  peakDay: CalendarDayCell | null;
}

export function spendingCalendar(
  state: FinanceState,
  month: InvoiceMonth,
  today: IsoDate,
  cardId?: string | null,
): SpendingCalendarSummary {
  const { start, end } = cycleBounds(month, closingDayForCard(state, cardId));
  const expenses = expensesOfMonth(state, month, cardId);
  const byDay = new Map<IsoDate, { amounts: number[]; count: number }>();
  for (const tx of expenses) {
    const bucket = byDay.get(tx.date) ?? { amounts: [], count: 0 };
    bucket.amounts.push(netExpenseAmount(state, tx));
    bucket.count += 1;
    byDay.set(tx.date, bucket);
  }

  const rawDays = eachDay(start, end).map((date) => {
    const info = byDay.get(date);
    const spent = info ? sumMoney(info.amounts) : 0;
    const { year, month: m, day } = parseIsoDate(date);
    return {
      date,
      dayNumber: day,
      weekday: new Date(year, m - 1, day).getDay(),
      spent,
      count: info?.count ?? 0,
      isFuture: date > today,
    };
  });

  const nonZero = rawDays.filter((d) => !d.isFuture && d.spent > 0).map((d) => d.spent);
  const maxSpent = nonZero.length > 0 ? Math.max(...nonZero) : 0;

  const days: CalendarDayCell[] = rawDays.map((d) => {
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (!d.isFuture && d.spent > 0 && maxSpent > 0) {
      const ratio = d.spent / maxSpent;
      level = ratio > 0.75 ? 4 : ratio > 0.45 ? 3 : ratio > 0.2 ? 2 : 1;
    }
    return { ...d, level };
  });

  const elapsed = days.filter((d) => !d.isFuture);
  const zeroSpendDays = elapsed.filter((d) => d.spent === 0).length;
  const activeDays = elapsed.filter((d) => d.spent > 0).length;
  const peakDay = elapsed.reduce<CalendarDayCell | null>(
    (best, d) => (d.spent > 0 && (!best || d.spent > best.spent) ? d : best),
    null,
  );
  return { days, zeroSpendDays, activeDays, peakDay };
}

export interface AntExpensesSummary {
  threshold: number;
  count: number;
  total: number;
  shareOfMonth: number;
  annualized: number;
  topMerchants: { merchant: string; total: number; count: number }[];
}

/** Detects "Gastos Formiga" (small recurring/micro purchases <= `threshold` BRL). */
export function antExpensesAnalysis(
  state: FinanceState,
  month: InvoiceMonth,
  threshold = 30,
  cardId?: string | null,
): AntExpensesSummary {
  const expenses = expensesOfMonth(state, month, cardId);
  const monthTotal = sumMoney(expenses.map((tx) => netExpenseAmount(state, tx)));
  const micro = expenses.filter((tx) => {
    const net = netExpenseAmount(state, tx);
    return net > 0 && net <= threshold;
  });
  const total = sumMoney(micro.map((tx) => netExpenseAmount(state, tx)));

  const byMerchant = new Map<string, { label: string; amounts: number[] }>();
  for (const tx of micro) {
    const key = tx.clean_title.trim().toLowerCase();
    const entry = byMerchant.get(key) ?? { label: tx.clean_title.trim(), amounts: [] };
    entry.amounts.push(netExpenseAmount(state, tx));
    byMerchant.set(key, entry);
  }

  const topMerchants = Array.from(byMerchant.values())
    .map((entry) => ({ merchant: entry.label, total: sumMoney(entry.amounts), count: entry.amounts.length }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  return {
    threshold,
    count: micro.length,
    total,
    shareOfMonth: monthTotal > 0 ? total / monthTotal : 0,
    annualized: sumMoney([total * 12]),
    topMerchants,
  };
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface WeekdayPattern {
  weekday: number;
  label: string;
  total: number;
  count: number;
}

export function spendingByWeekday(state: FinanceState, endMonth: InvoiceMonth, monthsCount = 3): WeekdayPattern[] {
  const months = new Set(monthRange(addMonths(endMonth, -(monthsCount - 1)), monthsCount));
  const buckets = Array.from({ length: 7 }, (_, idx) => ({ weekday: idx, label: WEEKDAY_LABELS[idx], amounts: [] as number[] }));

  for (const tx of state.transactions) {
    if (!isCountedExpense(tx) || !months.has(tx.invoice_month)) continue;
    const { year, month, day } = parseIsoDate(tx.date);
    const wd = new Date(year, month - 1, day).getDay();
    buckets[wd].amounts.push(netExpenseAmount(state, tx));
  }

  return buckets.map((b) => ({
    weekday: b.weekday,
    label: b.label,
    total: sumMoney(b.amounts),
    count: b.amounts.length,
  }));
}

export interface MerchantProfile {
  merchant: string;
  total: number;
  count: number;
  average: number;
  min: number;
  max: number;
  monthlyAverageFrequency: number;
  monthlySeries: { month: InvoiceMonth; label: string; total: number; count: number }[];
  transactions: Transaction[];
}

/** Full merchant X-ray across the last 12 months ending at `endMonth`. */
export function merchantProfile(state: FinanceState, merchantName: string, endMonth: InvoiceMonth): MerchantProfile {
  const key = merchantName.trim().toLowerCase();
  const months = monthRange(addMonths(endMonth, -11), 12);
  const monthSet = new Set(months);

  const txs = state.transactions
    .filter((tx) => isCountedExpense(tx) && monthSet.has(tx.invoice_month) && tx.clean_title.trim().toLowerCase() === key)
    .sort((a, b) => b.date.localeCompare(a.date));

  const amounts = txs.map((tx) => netExpenseAmount(state, tx));
  const total = sumMoney(amounts);
  const activeMonthCount = new Set(txs.map((tx) => tx.invoice_month)).size;

  const monthlySeries = months.map((month) => {
    const mTxs = txs.filter((tx) => tx.invoice_month === month);
    return {
      month,
      label: formatMonthLabel(month),
      total: sumMoney(mTxs.map((tx) => netExpenseAmount(state, tx))),
      count: mTxs.length,
    };
  });

  return {
    merchant: txs[0]?.clean_title ?? merchantName,
    total,
    count: txs.length,
    average: amounts.length > 0 ? total / amounts.length : 0,
    min: amounts.length > 0 ? Math.min(...amounts) : 0,
    max: amounts.length > 0 ? Math.max(...amounts) : 0,
    monthlyAverageFrequency: activeMonthCount > 0 ? txs.length / activeMonthCount : 0,
    monthlySeries,
    transactions: txs,
  };
}

// ------------------------------------------------------------------- meu pet

/** Formats a pet's age from `birthDate` relative to `today` (e.g. "2 anos e 4 meses"). */
export function petAgeLabel(birthDate: IsoDate | null | undefined, today: IsoDate): string | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const b = parseIsoDate(birthDate);
  const t = parseIsoDate(today);
  let totalMonths = (t.year - b.year) * 12 + (t.month - b.month);
  if (t.day < b.day) totalMonths -= 1;
  if (totalMonths < 0) return null;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0 && months === 0) return "Recém-nascido";
  if (years === 0) return `${months} ${months === 1 ? "mês" : "meses"}`;
  if (months === 0) return `${years} ${years === 1 ? "ano" : "anos"}`;
  return `${years} ${years === 1 ? "ano" : "anos"} e ${months} ${months === 1 ? "mês" : "meses"}`;
}

/** True when a transaction is explicitly linked to a pet OR belongs to a pet category / pet merchant. */
export function isPetRelatedTransaction(state: FinanceState, tx: Transaction): boolean {
  if (!isCountedExpense(tx)) return false;
  if (tx.pet_id) return true;
  const petPreset = presetFromCategoryId("preset:pets");
  if (petPreset && tx.category_id) {
    const petCat = findCategoryForPreset(state.categories, petPreset);
    if (petCat && tx.category_id === petCat.id) return true;
    // Also match subcategories whose parent is the Pet category.
    const txCat = state.categories.find((c) => c.id === tx.category_id);
    if (petCat && txCat?.parent_id === petCat.id) return true;
  }
  const matched = matchPreset(`${tx.clean_title} ${tx.raw_title}`);
  return matched?.key === "pets";
}

export interface PetExpenseKindRow {
  kind: PetExpenseKind;
  label: string;
  total: number;
  count: number;
  share: number;
}

export interface PetMonthlySummary {
  pet: Pet;
  spent: number;
  previousSpent: number;
  count: number;
  average3m: number;
  total12m: number;
  budgetRatio: number | null;
  byKind: PetExpenseKindRow[];
  lastExpenseDate: IsoDate | null;
  transactions: Transaction[];
}

export interface AllPetsSummary {
  totalMonth: number;
  previousMonth: number;
  average3m: number;
  total12m: number;
  totalBudget: number;
  byPet: PetMonthlySummary[];
  byKind: PetExpenseKindRow[];
  monthlyTrend6m: { month: InvoiceMonth; label: string; total: number; count: number }[];
  unlinkedPetTransactions: Transaction[];
  allPetTransactions: Transaction[];
}

function buildPetKindRows(state: FinanceState, txs: readonly Transaction[]): PetExpenseKindRow[] {
  const buckets = new Map<PetExpenseKind, number[]>();
  for (const tx of txs) {
    const kind: PetExpenseKind = tx.pet_expense_kind ?? inferPetExpenseKind(`${tx.clean_title} ${tx.raw_title}`);
    buckets.set(kind, [...(buckets.get(kind) ?? []), netExpenseAmount(state, tx)]);
  }
  const grandTotal = sumMoney(Array.from(buckets.values()).flat());
  return Array.from(buckets, ([kind, amounts]) => {
    const total = sumMoney(amounts);
    return {
      kind,
      label: PET_EXPENSE_KIND_LABEL[kind],
      total,
      count: amounts.length,
      share: grandTotal > 0 ? total / grandTotal : 0,
    };
  }).sort((a, b) => b.total - a.total);
}

export function petMonthlySummary(state: FinanceState, pet: Pet, month: InvoiceMonth): PetMonthlySummary {
  const prevMonth = addMonths(month, -1);
  const last3 = new Set(monthRange(addMonths(month, -2), 3));
  const last12 = new Set(monthRange(addMonths(month, -11), 12));

  const petTxs = state.transactions
    .filter((tx) => isCountedExpense(tx) && tx.pet_id === pet.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const inMonth = petTxs.filter((tx) => tx.invoice_month === month);
  const inPrev = petTxs.filter((tx) => tx.invoice_month === prevMonth);
  const in3m = petTxs.filter((tx) => last3.has(tx.invoice_month));
  const in12m = petTxs.filter((tx) => last12.has(tx.invoice_month));

  const spent = sumMoney(inMonth.map((tx) => netExpenseAmount(state, tx)));
  const previousSpent = sumMoney(inPrev.map((tx) => netExpenseAmount(state, tx)));
  const average3m = sumMoney(in3m.map((tx) => netExpenseAmount(state, tx))) / 3;
  const total12m = sumMoney(in12m.map((tx) => netExpenseAmount(state, tx)));

  return {
    pet,
    spent,
    previousSpent,
    count: inMonth.length,
    average3m,
    total12m,
    budgetRatio: pet.monthly_budget > 0 ? spent / pet.monthly_budget : null,
    byKind: buildPetKindRows(state, inMonth),
    lastExpenseDate: petTxs[0]?.date ?? null,
    transactions: petTxs,
  };
}

export function allPetsSummary(state: FinanceState, month: InvoiceMonth, selectedPetId?: string | null): AllPetsSummary {
  const pets = state.pets ?? [];
  const prevMonth = addMonths(month, -1);
  const last3 = new Set(monthRange(addMonths(month, -2), 3));
  const last6 = monthRange(addMonths(month, -5), 6);
  const last12 = new Set(monthRange(addMonths(month, -11), 12));

  const byPet = pets.map((pet) => petMonthlySummary(state, pet, month));
  const activePets = pets.filter((p) => !p.is_archived);
  const petTxsAll = state.transactions
    .filter((tx) => isPetRelatedTransaction(state, tx))
    .sort((a, b) => b.date.localeCompare(a.date));

  const scoped = selectedPetId ? petTxsAll.filter((tx) => tx.pet_id === selectedPetId) : petTxsAll;
  const inMonth = scoped.filter((tx) => tx.invoice_month === month);
  const inPrev = scoped.filter((tx) => tx.invoice_month === prevMonth);
  const in3m = scoped.filter((tx) => last3.has(tx.invoice_month));
  const in12m = scoped.filter((tx) => last12.has(tx.invoice_month));

  const totalMonth = sumMoney(inMonth.map((tx) => netExpenseAmount(state, tx)));
  const previousMonth = sumMoney(inPrev.map((tx) => netExpenseAmount(state, tx)));
  const average3m = sumMoney(in3m.map((tx) => netExpenseAmount(state, tx))) / 3;
  const total12m = sumMoney(in12m.map((tx) => netExpenseAmount(state, tx)));

  const totalBudget = selectedPetId
    ? (pets.find((p) => p.id === selectedPetId)?.monthly_budget ?? 0)
    : sumMoney(activePets.map((p) => p.monthly_budget));

  const monthlyTrend6m = last6.map((m) => {
    const list = scoped.filter((tx) => tx.invoice_month === m);
    return {
      month: m,
      label: formatMonthLabel(m),
      total: sumMoney(list.map((tx) => netExpenseAmount(state, tx))),
      count: list.length,
    };
  });

  const unlinkedPetTransactions = petTxsAll.filter((tx) => !tx.pet_id);

  return {
    totalMonth,
    previousMonth,
    average3m,
    total12m,
    totalBudget,
    byPet,
    byKind: buildPetKindRows(state, inMonth),
    monthlyTrend6m,
    unlinkedPetTransactions,
    allPetTransactions: scoped,
  };
}
