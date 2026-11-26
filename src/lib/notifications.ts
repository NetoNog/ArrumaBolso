"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { IsoDate } from "@/lib/domain/types";
import type { AlertKind, FinanceAlert } from "@/lib/finance/metrics";

export type NotificationCategory =
  | "invoices"
  | "budget"
  | "subscriptions"
  | "income"
  | "pets"
  | "reviews"
  | "installments";

export type DueLeadDays = 3 | 5 | 7;

export interface NotificationPrefs {
  enabled: boolean;
  browserEnabled: boolean;
  dueLeadDays: DueLeadDays;
  categories: Record<NotificationCategory, boolean>;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  browserEnabled: false,
  dueLeadDays: 5,
  categories: {
    invoices: true,
    budget: true,
    subscriptions: true,
    income: true,
    pets: true,
    reviews: true,
    installments: true,
  },
};

export const NOTIFICATION_CATEGORY_META: ReadonlyArray<{
  key: NotificationCategory;
  label: string;
  description: string;
}> = [
  { key: "invoices", label: "Faturas e limite de cartão", description: "Vencimentos próximos e limite acima de 80%" },
  { key: "budget", label: "Orçamento e saldo livre", description: "Tetos estourados, ritmo alto e saldo livre negativo" },
  { key: "subscriptions", label: "Assinaturas e reajustes", description: "Cobranças próximas e aumentos de valor" },
  { key: "income", label: "Salário e renda pendente", description: "Fontes de renda previstas que ainda não entraram" },
  { key: "pets", label: "Orçamento do Meu Pet", description: "Alertas ao atingir 80% ou 100% da meta mensal do pet" },
  { key: "reviews", label: "Revisões e fechamento", description: "Duplicidades, itens sem categoria e fechamento do ciclo" },
  { key: "installments", label: "Resumo de parcelas", description: "Parcelamentos ativos e encerramentos com alívio no mês" },
];

const PREFS_STORAGE_KEY = "arrumabolso.notifications.v1";
const PREFS_EVENT = "arrumabolso:notifications-change";
const NOTIFIED_PREFIX = "arrumabolso.notified.";

let cachedRaw: string | null | undefined;
let cachedParsed: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS;

export function alertCategory(kind: AlertKind): NotificationCategory {
  switch (kind) {
    case "card_limit":
    case "invoice_due":
      return "invoices";
    case "budget_exceeded":
    case "budget_pace":
    case "negative_free_balance":
      return "budget";
    case "subscription_due":
    case "subscription_drift":
    case "subscription":
      return "subscriptions";
    case "income_overdue":
      return "income";
    case "pet_budget":
      return "pets";
    case "duplicate":
    case "uncategorized":
    case "monthly_close":
      return "reviews";
    case "installment":
    case "ending":
      return "installments";
  }
}

export function filterAlertsByPrefs(alerts: readonly FinanceAlert[], prefs: NotificationPrefs): FinanceAlert[] {
  if (!prefs.enabled) return [];
  return alerts.filter((alert) => prefs.categories[alertCategory(alert.kind)] !== false);
}

/** Masks BRL amounts inside notification strings when Privacy Mode ("Olhinho") is active. */
export function maskCurrencyText(text: string, hidden: boolean): string {
  if (!hidden) return text;
  return text.replace(/(?:[-−]\s*)?R\$\s*[\d.]+,\d{2}/g, "R$ ••••");
}

function parsePrefs(raw: string | null): NotificationPrefs {
  if (!raw) return DEFAULT_NOTIFICATION_PREFS;
  try {
    const data = JSON.parse(raw) as Partial<NotificationPrefs>;
    const dueLeadDays: DueLeadDays =
      data.dueLeadDays === 3 || data.dueLeadDays === 7 ? data.dueLeadDays : 5;
    return {
      enabled: data.enabled !== false,
      browserEnabled: Boolean(data.browserEnabled),
      dueLeadDays,
      categories: {
        ...DEFAULT_NOTIFICATION_PREFS.categories,
        ...(data.categories ?? {}),
      },
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

function readStoredPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw === cachedRaw) return cachedParsed;
    cachedRaw = raw;
    cachedParsed = parsePrefs(raw);
    return cachedParsed;
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

function writeStoredPrefs(next: NotificationPrefs): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(next);
    cachedRaw = serialized;
    cachedParsed = next;
    window.localStorage.setItem(PREFS_STORAGE_KEY, serialized);
  } catch {
    // Ignore storage errors.
  }
  window.dispatchEvent(new Event(PREFS_EVENT));
}

function subscribePrefs(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(PREFS_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(PREFS_EVENT, handler);
  };
}

export function useNotificationPrefs() {
  const prefs = useSyncExternalStore(subscribePrefs, readStoredPrefs, () => DEFAULT_NOTIFICATION_PREFS);

  const updatePrefs = useCallback(
    (updater: (current: NotificationPrefs) => NotificationPrefs) => {
      writeStoredPrefs(updater(readStoredPrefs()));
    },
    [],
  );

  return { prefs, updatePrefs };
}

export type BrowserNotificationSupport = "unsupported" | "default" | "granted" | "denied";

export function getBrowserNotificationPermission(): BrowserNotificationSupport {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationSupport> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function sendNativeNotification(title: string, body: string, url = "/"): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  const options: NotificationOptions = {
    body,
    icon: "/brand/icon-192.png",
    badge: "/brand/icon-192.png",
    data: { url },
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, options);
        return true;
      }
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fires native device notifications for critical alerts at most once per alert key per calendar day.
 */
export async function notifyCriticalAlertsOncePerDay(
  alerts: readonly FinanceAlert[],
  today: IsoDate,
  hiddenPrivacy: boolean,
): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const critical = alerts.filter((a) => a.severity === "critical");
  if (critical.length === 0) return;

  const storageKey = `${NOTIFIED_PREFIX}${today}`;
  let sentKeys: string[] = [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    sentKeys = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    sentKeys = [];
  }
  const alreadySent = new Set(sentKeys);
  const fresh = critical.filter((a) => !alreadySent.has(a.key)).slice(0, 3);
  if (fresh.length === 0) return;

  for (const alert of fresh) {
    const ok = await sendNativeNotification(
      maskCurrencyText(alert.title, hiddenPrivacy),
      maskCurrencyText(alert.description, hiddenPrivacy),
      alert.href ?? "/",
    );
    if (ok) alreadySent.add(alert.key);
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(alreadySent)));
  } catch {
    // Ignore storage errors.
  }
}

