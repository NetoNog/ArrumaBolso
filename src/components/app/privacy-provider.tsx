"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

const STORAGE_KEY = "arrumabolso.privacy.hidden";
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

function writeSnapshot(next: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Ignore storage quota / private-mode restrictions.
  }
  for (const listener of listeners) listener();
}

interface PrivacyContextValue {
  hidden: boolean;
  toggle: () => void;
  mask: (formatted: string) => string;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  hidden: false,
  toggle: () => {},
  mask: (formatted) => formatted,
});

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    writeSnapshot(!getSnapshot());
  }, []);

  const mask = useCallback(
    (formatted: string) => {
      if (!hidden) return formatted;
      if (formatted === "—" || formatted === "") return formatted;
      return formatted.startsWith("-") ? "-R$ •••••" : formatted.startsWith("+") ? "+R$ •••••" : "R$ •••••";
    },
    [hidden],
  );

  const value = useMemo(() => ({ hidden, toggle, mask }), [hidden, toggle, mask]);
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): PrivacyContextValue {
  return useContext(PrivacyContext);
}

