"use client";

import { ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useDialogs } from "@/components/app/dialogs-provider";
import { Pill } from "@/components/common/pill";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dismissAlert } from "@/lib/domain/operations";
import { buildAlerts, type FinanceAlert } from "@/lib/finance/metrics";
import { useFinance } from "@/lib/store/finance-store";

const ACCENT: Record<FinanceAlert["kind"], string> = {
  installment: "before:bg-blue-500",
  duplicate: "before:bg-amber-500",
  subscription: "before:bg-violet-500",
  ending: "before:bg-emerald-500",
};

export function AlertsCard() {
  const { state, selectedMonth, today, commit } = useFinance();
  const { openEdit } = useDialogs();
  const router = useRouter();
  const alerts = buildAlerts(state, selectedMonth, today);

  function open(alert: FinanceAlert) {
    if (alert.kind === "subscription") router.push("/assinaturas");
    else if (alert.transactionIds.length > 0) openEdit(alert.transactionIds[alert.transactionIds.length - 1]);
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Alertas & Compromissos</CardTitle>
        <CardDescription>Parcelas, recorrências e itens para revisar</CardDescription>
        <CardAction>
          <Pill tone="pink">{alerts.length} ativos</Pill>
        </CardAction>
      </CardHeader>
      <CardContent className="grid content-start gap-2.5">
        {alerts.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">Nenhum alerta neste ciclo.</p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.key}
              className={`group relative overflow-hidden rounded-lg border bg-card pl-3 transition-colors before:absolute before:inset-y-0 before:left-0 before:w-[3px] hover:bg-muted/40 ${ACCENT[alert.kind]}`}
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
                  <p className="truncate text-[13px] font-semibold text-foreground">{alert.title}</p>
                  <p className="num truncate text-xs text-muted-foreground">{alert.description}</p>
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
                className="absolute top-2 right-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted focus-visible:opacity-100"
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
