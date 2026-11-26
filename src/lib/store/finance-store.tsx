"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { emptyState } from "@/lib/data/initial-state";
import { parseFinanceState, SupabaseRepository, type FinanceRepository } from "@/lib/data/repository";
import { invoiceMonthForDate, todayIso } from "@/lib/dates";
import type { FinanceState, InvoiceMonth, IsoDate } from "@/lib/domain/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Status = "loading" | "ready" | "error";
export type SyncStatus = "idle" | "saving" | "error";

const SYNC_CHANNEL = "arrumabolso-sync";
const CACHE_PREFIX = "arrumabolso.cache.v1.";
/** Minimum interval between automatic visibilitychange reloads (avoids spamming 14 queries on quick app switches). */
const VISIBILITY_COOLDOWN_MS = 30_000;

interface FinanceContextValue {
  status: Status;
  error: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  /** True while background Stale-While-Revalidate or pull-to-refresh is fetching fresh data. */
  isRefreshing: boolean;
  /** True when the browser reports no network connectivity. */
  isOffline: boolean;
  retrySync: () => void;
  reload: (options?: { force?: boolean }) => Promise<boolean>;
  state: FinanceState;
  userEmail: string | null;
  today: IsoDate;
  currentMonth: InvoiceMonth;
  selectedMonth: InvoiceMonth;
  setSelectedMonth: (month: InvoiceMonth) => void;
  /** Optional global credit-card filter across overview/invoices (`null` = all cards). */
  selectedCardId: string | null;
  setSelectedCardId: (cardId: string | null) => void;
  /** Applies a pure state operation and persists the result. */
  commit: (operation: (state: FinanceState) => FinanceState) => void;
  /** Replaces the whole state (used by reset/restore flows). */
  replaceState: (next: FinanceState) => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

const PLACEHOLDER_STATE: FinanceState = emptyState();

/** Raised when there is no signed-in user; the app sends the visitor to the login screen. */
class UnauthenticatedError extends Error {}

function readCachedState(userId: string): FinanceState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    return parseFinanceState(JSON.parse(raw));
  } catch {
    return null;
  }
}

let pendingCacheTimer: ReturnType<typeof setTimeout> | null = null;

function writeCachedState(userId: string, state: FinanceState, immediate = false): void {
  if (typeof window === "undefined") return;
  const commitWrite = () => {
    try {
      window.localStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(state));
    } catch {
      // Ignore quota / private-mode storage errors.
    }
  };
  if (pendingCacheTimer) {
    clearTimeout(pendingCacheTimer);
    pendingCacheTimer = null;
  }
  if (immediate) {
    commitWrite();
    return;
  }
  // Defer JSON serialization off the hot interaction frame so clicks/edits stay sub-millisecond.
  pendingCacheTimer = setTimeout(() => {
    pendingCacheTimer = null;
    const win = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    if (typeof win.requestIdleCallback === "function") {
      win.requestIdleCallback(commitWrite, { timeout: 1000 });
    } else {
      commitWrite();
    }
  }, 180);
}

function clearCachedState(userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      window.localStorage.removeItem(`${CACHE_PREFIX}${userId}`);
      return;
    }
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors.
  }
}

function subscribeOffline(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function readOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine === false;
}

interface SessionPreview {
  userId: string;
  email: string | null;
  repository: FinanceRepository;
  cached: FinanceState | null;
}

/** Fast local session peek: reads cached Supabase JWT + local state snapshot in < 10ms. */
async function peekCachedSession(): Promise<SessionPreview | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  return {
    userId: user.id,
    email: user.email ?? null,
    repository: new SupabaseRepository(client, user.id),
    cached: readCachedState(user.id),
  };
}

async function resolveRepository(): Promise<{ userId: string; repository: FinanceRepository; email: string | null }> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new UnauthenticatedError("Supabase não configurado.");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new UnauthenticatedError("Sessão expirada.");
  return { userId: data.user.id, repository: new SupabaseRepository(client, data.user.id), email: data.user.email ?? null };
}

interface BootResult {
  userId: string;
  repository: FinanceRepository;
  email: string | null;
  state: FinanceState;
}

let bootPromise: Promise<BootResult> | null = null;

/** Loads (or initialises) the fresh remote data exactly once per page load, even under StrictMode. */
function bootOnce(): Promise<BootResult> {
  bootPromise ??= (async () => {
    const { userId, repository, email } = await resolveRepository();
    const loaded = await repository.load();
    if (loaded) {
      writeCachedState(userId, loaded);
      return { userId, repository, email, state: loaded };
    }
    const initial = emptyState();
    await repository.save(null, initial);
    writeCachedState(userId, initial);
    return { userId, repository, email, state: initial };
  })();
  bootPromise.catch(() => {
    bootPromise = null;
  });
  return bootPromise;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [state, setState] = useState<FinanceState>(PLACEHOLDER_STATE);
  const [today, setToday] = useState<IsoDate>("1970-01-01");
  const [selectedMonth, setSelectedMonthRaw] = useState<InvoiceMonth | null>(null);
  const [selectedCardId, setSelectedCardIdRaw] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const isOffline = useSyncExternalStore(subscribeOffline, readOffline, () => false);

  const stateRef = useRef<FinanceState>(PLACEHOLDER_STATE);
  const userIdRef = useRef<string | null>(null);
  const repositoryRef = useRef<FinanceRepository | null>(null);
  const persistedRef = useRef<FinanceState | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSavesRef = useRef(0);
  const lastSyncedAtRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>("");

  const setSelectedMonth = useCallback((month: InvoiceMonth) => {
    startTransition(() => {
      setSelectedMonthRaw(month);
    });
  }, []);

  const setSelectedCardId = useCallback((cardId: string | null) => {
    startTransition(() => {
      setSelectedCardIdRaw(cardId);
    });
  }, []);

  const reload = useCallback(async (options?: { force?: boolean }): Promise<boolean> => {
    const repository = repositoryRef.current;
    if (!repository || pendingSavesRef.current > 0) return false;
    if (!options?.force && Date.now() - lastSyncedAtRef.current < VISIBILITY_COOLDOWN_MS) {
      return false;
    }
    setIsRefreshing(true);
    try {
      const fresh = await repository.load();
      if (!fresh || pendingSavesRef.current > 0) return false;
      persistedRef.current = fresh;
      stateRef.current = fresh;
      lastSyncedAtRef.current = Date.now();
      if (userIdRef.current) writeCachedState(userIdRef.current, fresh);
      startTransition(() => {
        setState(fresh);
      });
      setSyncStatus("idle");
      setSyncError(null);
      return true;
    } catch {
      // Silent background refresh failure: keep current local state intact.
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const persist = useCallback((next: FinanceState) => {
    function enqueue(snapshot: FinanceState) {
      const repository = repositoryRef.current;
      if (!repository) return;
      pendingSavesRef.current += 1;
      setSyncStatus("saving");
      setSyncError(null);

      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          await repository.save(persistedRef.current, snapshot);
          persistedRef.current = snapshot;
          lastSyncedAtRef.current = Date.now();
          if (userIdRef.current) writeCachedState(userIdRef.current, snapshot);
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          if (pendingSavesRef.current === 0) {
            setSyncStatus("idle");
            setSyncError(null);
          }
          channelRef.current?.postMessage({ type: "updated", from: tabIdRef.current });
        } catch (cause) {
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          const message = cause instanceof Error ? cause.message : "Tente novamente.";
          setSyncStatus("error");
          setSyncError(message);
          toast.error("Não foi possível salvar", {
            description: message,
            action: {
              label: "Tentar novamente",
              onClick: () => enqueue(stateRef.current),
            },
            cancel: persistedRef.current
              ? {
                  label: "Desfazer",
                  onClick: () => {
                    const last = persistedRef.current;
                    if (!last) return;
                    stateRef.current = last;
                    setState(last);
                    setSyncStatus("idle");
                    setSyncError(null);
                  },
                }
              : undefined,
          });
        }
      });
    }
    enqueue(next);
  }, []);

  const retrySync = useCallback(() => {
    persist(stateRef.current);
  }, [persist]);

  useEffect(() => {
    tabIdRef.current = Math.random().toString(36).slice(2);
    let cancelled = false;
    let hydratedFromCache = false;

    // 1. Instant Boot (Stale-While-Revalidate): hydrate from local cache immediately if available.
    void peekCachedSession().then((preview) => {
      if (cancelled || !preview?.cached || persistedRef.current) return;
      hydratedFromCache = true;
      userIdRef.current = preview.userId;
      repositoryRef.current = preview.repository;
      persistedRef.current = preview.cached;
      stateRef.current = preview.cached;
      setUserEmail(preview.email);
      setToday(todayIso());
      setState(preview.cached);
      setStatus("ready");
      setIsRefreshing(true);
    });

    // 2. Always verify session & fetch fresh state from Supabase in parallel.
    bootOnce()
      .then(({ userId, repository, email, state: loaded }) => {
        if (cancelled) return;
        userIdRef.current = userId;
        repositoryRef.current = repository;
        lastSyncedAtRef.current = Date.now();
        // Do not overwrite user mutations made while SWR was still in flight.
        if (pendingSavesRef.current === 0) {
          persistedRef.current = loaded;
          stateRef.current = loaded;
          setState(loaded);
        }
        setUserEmail(email);
        setToday(todayIso());
        setStatus("ready");
        setIsRefreshing(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setIsRefreshing(false);
        if (cause instanceof UnauthenticatedError) {
          clearCachedState(userIdRef.current);
          window.location.replace(new URL("/login", window.location.origin));
          return;
        }
        // If offline with warm cache, keep showing cached data instead of blocking error screen.
        if (hydratedFromCache) return;
        setError(cause instanceof Error ? cause.message : "Erro desconhecido ao carregar os dados.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Multi-tab sync + session expiry watcher + throttled visibility refresh + online reconnect.
  useEffect(() => {
    if (status !== "ready") return;

    const client = getSupabaseBrowserClient();
    const authSub = client?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        bootPromise = null;
        clearCachedState(userIdRef.current);
        window.location.replace(new URL("/login", window.location.origin));
      }
    });

    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(SYNC_CHANNEL);
      channelRef.current = channel;
      channel.onmessage = (event: MessageEvent<{ type?: string; from?: string }>) => {
        if (event.data?.type === "updated" && event.data.from !== tabIdRef.current) {
          void reload({ force: true });
        }
      };
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") void reload();
    };
    const onOnline = () => {
      void reload({ force: true });
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      authSub?.data.subscription.unsubscribe();
      channelRef.current?.close();
      channelRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [status, reload]);

  // Warn before closing tab while a save is still in flight or failed.
  useEffect(() => {
    if (syncStatus === "idle") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [syncStatus]);

  const effectiveSelectedCardId =
    selectedCardId && state.cards.some((card) => card.id === selectedCardId) ? selectedCardId : null;

  const replaceState = useCallback(
    (next: FinanceState) => {
      stateRef.current = next;
      setState(next);
      if (userIdRef.current) writeCachedState(userIdRef.current, next);
      persist(next);
    },
    [persist],
  );

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
      syncStatus,
      syncError,
      isRefreshing,
      isOffline,
      retrySync,
      reload,
      state,
      userEmail,
      today,
      currentMonth,
      selectedMonth: selectedMonth ?? currentMonth,
      setSelectedMonth,
      selectedCardId: effectiveSelectedCardId,
      setSelectedCardId,
      commit,
      replaceState,
    }),
    [
      status,
      error,
      syncStatus,
      syncError,
      isRefreshing,
      isOffline,
      retrySync,
      reload,
      state,
      userEmail,
      today,
      currentMonth,
      selectedMonth,
      setSelectedMonth,
      effectiveSelectedCardId,
      setSelectedCardId,
      commit,
      replaceState,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance must be used inside <FinanceProvider>.");
  return context;
}
