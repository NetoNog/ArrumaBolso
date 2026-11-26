"use client";

import { Bell, CheckCheck, ChevronRight, RotateCcw, Settings, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { usePrivacy } from "@/components/app/privacy-provider";
import { Pill } from "@/components/common/pill";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { formatMonthLabel } from "@/lib/dates";
import { dismissAlert } from "@/lib/domain/operations";
import { buildAlerts, type AlertSeverity, type FinanceAlert } from "@/lib/finance/metrics";
import {
  filterAlertsByPrefs,
  maskCurrencyText,
  notifyCriticalAlertsOncePerDay,
  useNotificationPrefs,
} from "@/lib/notifications";
import { useFinance } from "@/lib/store/finance-store";
import { useIsDesktop } from "@/lib/use-media-query";

type CenterTab = "urgent" | "all" | "dismissed";

const SEVERITY_BAR: Record<AlertSeverity, string> = {
  critical: "before:bg-negative",
  warning: "before:bg-warning",
  info: "before:bg-brand",
};

/**
 * Unified Notification Center trigger + panel:
 * - Mobile (< md): opens a native Bottom Sheet with Urgentes / Todas / Dispensados tabs.
 * - Desktop (>= md): opens an elevated Popover with the same controls and 1-click actions.
 */
export function NotificationCenter({ mobile = false }: { mobile?: boolean }) {
  const { state, status, selectedMonth, today, selectedCardId, commit } = useFinance();
  const { openEdit } = useDialogs();
  const { hidden } = usePrivacy();
  const { prefs } = useNotificationPrefs();
  const isDesktop = useIsDesktop();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<CenterTab>("urgent");

  const dismissedSet = useMemo(() => new Set(state.settings.dismissed_alerts), [state.settings.dismissed_alerts]);

  const allCycleAlerts = useMemo(
    () =>
      filterAlertsByPrefs(
        buildAlerts(state, selectedMonth, today, selectedCardId, {
          includeDismissed: true,
          dueLeadDays: prefs.dueLeadDays,
        }),
        prefs,
      ),
    [state, selectedMonth, today, selectedCardId, prefs],
  );

  const activeAlerts = useMemo(
    () => allCycleAlerts.filter((alert) => !dismissedSet.has(alert.key)),
    [allCycleAlerts, dismissedSet],
  );
  const urgentAlerts = useMemo(
    () => activeAlerts.filter((alert) => alert.severity === "critical" || alert.severity === "warning"),
    [activeAlerts],
  );
  const dismissedAlerts = useMemo(
    () => allCycleAlerts.filter((alert) => dismissedSet.has(alert.key)),
    [allCycleAlerts, dismissedSet],
  );

  // Trigger optional native PWA/browser notification for critical alerts once per day.
  useEffect(() => {
    if (status !== "ready" || !prefs.enabled || !prefs.browserEnabled) return;
    if (mobile && isDesktop) return;
    if (!mobile && !isDesktop) return;
    void notifyCriticalAlertsOncePerDay(activeAlerts, today, hidden);
  }, [status, prefs.enabled, prefs.browserEnabled, activeAlerts, today, hidden, mobile, isDesktop]);

  const urgentCount = urgentAlerts.length;
  const totalCount = activeAlerts.length;

  function openAlert(alert: FinanceAlert) {
    setOpen(false);
    if (alert.href) router.push(alert.href);
    else if (alert.transactionIds.length > 0) openEdit(alert.transactionIds[alert.transactionIds.length - 1]);
  }

  function handleDismiss(alert: FinanceAlert) {
    commit((current) => dismissAlert(current, alert.key));
    toast("Notificação dispensada", {
      action: {
        label: "Desfazer",
        onClick: () =>
          commit((current) => ({
            ...current,
            settings: {
              ...current.settings,
              dismissed_alerts: current.settings.dismissed_alerts.filter((key) => key !== alert.key),
            },
          })),
      },
    });
  }

  function handleRestore(alert: FinanceAlert) {
    commit((current) => ({
      ...current,
      settings: {
        ...current.settings,
        dismissed_alerts: current.settings.dismissed_alerts.filter((key) => key !== alert.key),
      },
    }));
    toast.success("Notificação restaurada");
  }

  function handleDismissAll() {
    if (activeAlerts.length === 0) return;
    const keys = activeAlerts.map((a) => a.key);
    commit((current) => ({
      ...current,
      settings: {
        ...current.settings,
        dismissed_alerts: Array.from(new Set([...current.settings.dismissed_alerts, ...keys])),
      },
    }));
    toast("Todas marcadas como lidas", {
      action: {
        label: "Desfazer",
        onClick: () =>
          commit((current) => ({
            ...current,
            settings: {
              ...current.settings,
              dismissed_alerts: current.settings.dismissed_alerts.filter((key) => !keys.includes(key)),
            },
          })),
      },
    });
  }

  function handleRestoreAll() {
    if (dismissedAlerts.length === 0) return;
    const keys = new Set(dismissedAlerts.map((a) => a.key));
    commit((current) => ({
      ...current,
      settings: {
        ...current.settings,
        dismissed_alerts: current.settings.dismissed_alerts.filter((key) => !keys.has(key)),
      },
    }));
    toast.success("Notificações restauradas");
  }

  const triggerBadge =
    urgentCount > 0 ? (
      <span className="num absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[10px] font-bold text-white ring-2 ring-background">
        {urgentCount > 9 ? "9+" : urgentCount}
      </span>
    ) : totalCount > 0 ? (
      <span className="absolute top-2 right-2 size-2 rounded-full bg-brand ring-2 ring-card" />
    ) : null;

  const panelProps = {
    tab,
    setTab,
    urgentAlerts,
    activeAlerts,
    dismissedAlerts,
    selectedMonth,
    hidden,
    onOpenAlert: openAlert,
    onDismiss: handleDismiss,
    onRestore: handleRestore,
    onDismissAll: handleDismissAll,
    onRestoreAll: handleRestoreAll,
    onClose: () => setOpen(false),
  };

  if (mobile) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setTab(urgentCount > 0 ? "urgent" : "all");
            setOpen(true);
          }}
          className="relative size-10 rounded-2xl bg-card shadow-panel hover:bg-card"
          aria-label={`${urgentCount} notificações urgentes, ${totalCount} ativas`}
        >
          <Bell className="size-[18px] text-foreground" />
          {triggerBadge}
        </Button>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[85dvh] gap-0 overflow-hidden rounded-t-[28px] border-t-0 bg-background p-0 pb-[env(safe-area-inset-bottom,0px)] shadow-2xl"
          >
            <SheetTitle className="sr-only">Central de Notificações</SheetTitle>
            <div className="relative flex items-center justify-center pt-3 pb-1">
              <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar notificações"
                className="absolute top-2.5 right-4 flex size-8 items-center justify-center rounded-full bg-card text-muted-foreground shadow-panel active:scale-90"
              >
                <X className="size-4" />
              </button>
            </div>
            <NotificationPanel {...panelProps} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setTab(urgentCount > 0 ? "urgent" : "all");
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="relative h-9 w-9"
            aria-label={`${urgentCount} notificações urgentes, ${totalCount} ativas`}
          />
        }
      >
        <Bell className="size-4" />
        {triggerBadge}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] overflow-hidden rounded-2xl p-0 shadow-xl">
        <NotificationPanel {...panelProps} />
      </PopoverContent>
    </Popover>
  );
}

function NotificationPanel({
  tab,
  setTab,
  urgentAlerts,
  activeAlerts,
  dismissedAlerts,
  selectedMonth,
  hidden,
  onOpenAlert,
  onDismiss,
  onRestore,
  onDismissAll,
  onRestoreAll,
  onClose,
}: {
  tab: CenterTab;
  setTab: (tab: CenterTab) => void;
  urgentAlerts: readonly FinanceAlert[];
  activeAlerts: readonly FinanceAlert[];
  dismissedAlerts: readonly FinanceAlert[];
  selectedMonth: string;
  hidden: boolean;
  onOpenAlert: (alert: FinanceAlert) => void;
  onDismiss: (alert: FinanceAlert) => void;
  onRestore: (alert: FinanceAlert) => void;
  onDismissAll: () => void;
  onRestoreAll: () => void;
  onClose: () => void;
}) {
  const list = tab === "urgent" ? urgentAlerts : tab === "all" ? activeAlerts : dismissedAlerts;

  return (
    <div className="flex max-h-[75dvh] flex-col md:max-h-[520px]">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Notificações</p>
          <p className="text-[11px] text-muted-foreground">Ciclo {formatMonthLabel(selectedMonth)}</p>
        </div>
        {tab === "dismissed" ? (
          dismissedAlerts.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={onRestoreAll} className="h-7 gap-1 px-2 text-xs text-brand">
              <RotateCcw className="size-3.5" /> Restaurar tudo
            </Button>
          ) : null
        ) : activeAlerts.length > 0 ? (
          <Button size="sm" variant="ghost" onClick={onDismissAll} className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
            <CheckCheck className="size-3.5" /> Limpar tudo
          </Button>
        ) : null}
      </div>

      {/* Segmented tabs: Urgentes | Todas | Dispensados */}
      <div className="border-b px-3 py-2">
        <div role="tablist" aria-label="Filtrar notificações" className="grid grid-cols-3 gap-1 rounded-xl bg-muted/70 p-1">
          {(
            [
              { key: "urgent", label: `Urgentes (${urgentAlerts.length})` },
              { key: "all", label: `Todas (${activeAlerts.length})` },
              { key: "dismissed", label: `Dispensados (${dismissedAlerts.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                "rounded-lg py-1.5 text-[11px] font-semibold transition-all",
                tab === item.key
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid flex-1 content-start gap-2 overflow-y-auto p-3">
        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              {tab === "urgent"
                ? "Tudo sob controle por aqui"
                : tab === "dismissed"
                  ? "Nenhum alerta dispensado"
                  : "Nenhuma notificação neste ciclo"}
            </p>
            <p className="pt-1 text-xs text-muted-foreground">
              {tab === "urgent"
                ? `Sem faturas vencendo, estouros ou pendências críticas em ${formatMonthLabel(selectedMonth)}.`
                : tab === "dismissed"
                  ? "Alertas que você dispensar aparecem aqui caso queira restaurar."
                  : "Quando houver vencimentos, metas ou revisões, eles aparecerão aqui."}
            </p>
          </div>
        ) : (
          list.map((alert) => (
            <div
              key={alert.key}
              className={cn(
                "group relative overflow-hidden rounded-xl border border-border/80 bg-surface-subtle pl-3 transition-colors before:absolute before:inset-y-0 before:left-0 before:w-[3px] hover:border-border hover:bg-muted/60",
                SEVERITY_BAR[alert.severity],
              )}
            >
              <button
                type="button"
                onClick={() => onOpenAlert(alert)}
                className="flex w-full items-center gap-2 py-2.5 pr-10 text-left"
              >
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex flex-wrap gap-1">
                    {alert.badges.slice(0, 2).map((badge) => (
                      <Pill key={badge.label} tone={badge.tone}>
                        {badge.label}
                      </Pill>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-foreground sm:text-sm">
                    {maskCurrencyText(alert.title, hidden)}
                  </p>
                  <p className="num text-[11.5px] leading-snug text-muted-foreground">
                    {maskCurrencyText(alert.description, hidden)}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>

              {tab === "dismissed" ? (
                <button
                  type="button"
                  aria-label="Restaurar notificação"
                  title="Restaurar notificação"
                  onClick={() => onRestore(alert)}
                  className="absolute top-2 right-2 rounded-lg p-1.5 text-brand transition-colors hover:bg-brand-soft"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Dispensar notificação"
                  title="Dispensar"
                  onClick={() => onDismiss(alert)}
                  className="absolute top-2 right-2 rounded-lg p-1.5 text-muted-foreground opacity-80 transition-opacity hover:bg-muted hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between border-t bg-surface-subtle px-4 py-2.5">
        <Link
          href="/configuracoes#notificacoes"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
        >
          <Settings className="size-3.5" /> Configurar notificações
        </Link>
        <span className="num text-[11px] text-muted-foreground">{activeAlerts.length} ativa(s)</span>
      </div>
    </div>
  );
}

