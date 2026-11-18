"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { emptyState } from "@/lib/data/initial-state";
import { SupabaseRepository, type FinanceRepository } from "@/lib/data/repository";
import { invoiceMonthForDate, todayIso } from "@/lib/dates";
import type { FinanceState, InvoiceMonth, IsoDate } from "@/lib/domain/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = "loading" | "ready" | "error";

interface FinanceContextValue {
  status: Status;
  error: string | null;
  state: FinanceState;
  userEmail: string | null;
  today: IsoDate;
  currentMonth: InvoiceMonth;
  selectedMonth: InvoiceMonth;
  setSelectedMonth: (month: InvoiceMonth) => void;
  /** Applies a pure state operation and persists the result. */
  commit: (operation: (state: FinanceState) => FinanceState) => void;
  /** Replaces the whole state (used by reset/restore flows). */
  replaceState: (next: FinanceState) => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

const PLACEHOLDER_STATE: FinanceState = {
  settings: { display_name: "", closing_day: 2, monthly_income: 0, dismissed_alerts: [] },
  categories: [],
  transactions: [],
  import_batches: [],
  deleted_csv_hashes: [],
  recurring_subscriptions: [],
  income_sources: [],
  categorization_rules: [],
};

/** Raised when there is no signed-in user; the app sends the visitor to the login screen. */
class UnauthenticatedError extends Error {}

async function resolveRepository(): Promise<{ repository: FinanceRepository; email: string | null }> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new UnauthenticatedError("Supabase não configurado.");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new UnauthenticatedError("Sessão expirada.");
  return { repository: new SupabaseRepository(client, data.user.id), email: data.user.email ?? null };
}

interface BootResult {
  repository: FinanceRepository;
  email: string | null;
  state: FinanceState;
}

let bootPromise: Promise<BootResult> | null = null;

/** Loads (or initialises) the data exactly once per page load, even under StrictMode. */
function bootOnce(): Promise<BootResult> {
  bootPromise ??= (async () => {
    const { repository, email } = await resolveRepository();
    const loaded = await repository.load();
    if (loaded) return { repository, email, state: loaded };
    // Every account starts empty: the user feeds the system with their own data.
    const initial = emptyState();
    await repository.save(null, initial);
    return { repository, email, state: initial };
  })();
  bootPromise.catch(() => {
    bootPromise = null;
  });
  return bootPromise;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<FinanceState>(PLACEHOLDER_STATE);
  // Resolved on the client after boot: reading the clock during prerender is not allowed.
  const [today, setToday] = useState<IsoDate>("1970-01-01");
  const [selectedMonth, setSelectedMonth] = useState<InvoiceMonth | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const stateRef = useRef<FinanceState>(PLACEHOLDER_STATE);
  const repositoryRef = useRef<FinanceRepository | null>(null);
  const persistedRef = useRef<FinanceState | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    bootOnce()
      .then(({ repository, email, state: loaded }) => {
        if (cancelled) return;
        repositoryRef.current = repository;
        persistedRef.current = loaded;
        setUserEmail(email);
        setToday(todayIso());
        stateRef.current = loaded;
        setState(loaded);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof UnauthenticatedError) {
          window.location.replace(new URL("/login", window.location.origin));
          return;
        }
        setError(cause instanceof Error ? cause.message : "Erro desconhecido ao carregar os dados.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: FinanceState) => {
    const repository = repositoryRef.current;
    if (!repository) return;
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        await repository.save(persistedRef.current, next);
        persistedRef.current = next;
      } catch (cause) {
        toast.error("Não foi possível salvar", {
          description: cause instanceof Error ? cause.message : "Tente novamente.",
        });
      }
    });
  }, []);

  const replaceState = useCallback(
    (next: FinanceState) => {
      stateRef.current = next;
      setState(next);
      persist(next);
    },
    [persist],
  );

  // Operations run outside the setState updater: they generate ids, so they must
  // run exactly once (StrictMode would invoke an updater twice).
  const commit = useCallback(
    (operation: (current: FinanceState) => FinanceState) => {
      const current = stateRef.current;
      const next = operation(current);
      if (next !== current) replaceState(next);
    },
    [replaceState],
  );

  const currentMonth = invoiceMonthForDate(today, state.settings.closing_day);

  const value = useMemo<FinanceContextValue>(
    () => ({
      status,
      error,
      state,
      userEmail,
      today,
      currentMonth,
      selectedMonth: selectedMonth ?? currentMonth,
      setSelectedMonth,
      commit,
      replaceState,
    }),
    [status, error, state, userEmail, today, currentMonth, selectedMonth, commit, replaceState],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance must be used inside <FinanceProvider>.");
  return context;
}
