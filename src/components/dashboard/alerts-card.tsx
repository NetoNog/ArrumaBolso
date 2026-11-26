"use client";

import { ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { toast } from "sonner";

import { useDialogs } from "@/components/app/dialogs-provider";
import { usePrivacy } from "@/components/app/privacy-provider";
import { Pill } from "@/components/common/pill";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dismissAlert } from "@/lib/domain/operations";
import { buildAlerts, type AlertKind, type FinanceAlert } from "@/lib/finance/metrics";
import { filterAlertsByPrefs, maskCurrencyText, useNotificationPrefs } from "@/lib/notifications";
import { useFinance } from "@/lib/store/finance-store";

const ACCENT: Record<AlertKind, string> = {
  negative_free_balance: "before:bg-negative",
  invoice_due: "before:bg-negative",
  card_limit: "before:bg-negative",
  budget_exceeded: "before:bg-negative",
  budget_pace: "before:bg-warning",
  income_overdue: "before:bg-warning",
  subscription_drift: "before:bg-warning",
  pet_budget: "before:bg-warning",
  duplicate: "before:bg-warning",
  subscription_due: "before:bg-violet-500",
  uncategorized: "before:bg-warning",
  monthly_close: "before:bg-brand",
  installment: "before:bg-brand",
  subscription: "before:bg-violet-500",
  ending: "before:bg-positive",
};

export function AlertsCard() {
  const { state, selectedMonth, today, selectedCardId, commit } = useFinance();
  const { openEdit } = useDialogs();
  const { hidden } = usePrivacy();
  const { prefs } = useNotificationPrefs();
  const router = useRouter();
  const alerts = useMemo(
    () =>
      filterAlertsByPrefs(
        buildAlerts(state, selectedMonth, today, selectedCardId, { dueLeadDays: prefs.dueLeadDays }),
        prefs,
      ),
    [state, selectedMonth, today, selectedCardId, prefs],
  );
  const urgentCount = alerts.filter((a) => a.severity === "critical" || a.severity === "warning").length;

  function open(alert: FinanceAlert) {
    if (alert.href) router.push(alert.href);
    else if (alert.transactionIds.length > 0) openEdit(alert.transactionIds[alert.transactionIds.length - 1]);
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Alertas & Compromissos</CardTitle>
        <CardDescription>Vencimentos, orçamento, renda, assinaturas e revisões</CardDescription>
        <CardAction>
          <Pill tone={urgentCount > 0 ? "rose" : alerts.length > 0 ? "blue" : "emerald"}>
            {urgentCount > 0 ? `${urgentCount} urgente(s)` : alerts.length > 0 ? `${alerts.length} ativo(s)` : "Em dia"}
          </Pill>
        </CardAction>
      </CardHeader>
      <CardContent className="grid content-start gap-2.5">
        {alerts.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            Nenhum alerta neste ciclo.
          </p>
        ) : (
          alerts.slice(0, 6).map((alert) => (
            <div
              key={alert.key}
              className={`group relative overflow-hidden rounded-xl border border-border/75 bg-surface-subtle pl-3 transition-colors before:absolute before:inset-y-0 before:left-0 before:w-[3px] hover:border-border hover:bg-muted/60 ${ACCENT[alert.kind]}`}
            >
              <button type="button" onClick={() => open(alert)} className="flex w-full items-center gap-2 py-2.5 pr-9 text-left">
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex flex-wrap gap-1">
                    {alert.badges.map((badge) => (
                      <Pill key={badge.label} tone={badge.tone}>
                        {badge.label}
                      </Pill>
                    ))}
                  </div>
                  <p className="truncate text-sm font-semibold text-foreground">{maskCurrencyText(alert.title, hidden)}</p>
                  <p className="num truncate text-xs text-muted-foreground">{maskCurrencyText(alert.description, hidden)}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
              <button
                type="button"
                aria-label="Dispensar alerta"
                onClick={() => {
                  commit((current) => dismissAlert(current, alert.key));
                  toast("Alerta dispensado", {
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
                }}
                className="absolute top-2 right-2 rounded-lg p-1.5 text-muted-foreground opacity-75 transition-opacity hover:bg-muted focus-visible:opacity-100 lg:p-1 lg:opacity-0 lg:group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
