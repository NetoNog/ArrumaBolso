import { Lock } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Transaction } from "@/lib/domain/types";

const FIELD_LABEL: Record<string, string> = {
  clean_title: "nome",
  amount: "valor",
  date: "data",
  invoice_month: "competência",
  category_id: "categoria",
  notes: "notas",
  type: "tipo",
  payment_method: "método",
  installment_current: "parcela",
  installment_total: "total de parcelas",
};

const BASE = "inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10.5px] font-medium";

/** Discrete origin badge: CSV, Manual, Previsto or Editado (protected from re-import). */
export function SourceBadge({ tx }: { tx: Transaction }) {
  if (tx.is_user_edited) {
    const fields = tx.locked_fields.map((field) => FIELD_LABEL[field] ?? field);
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span className={`${BASE} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300`} />
          }
        >
          <Lock className="size-2.5" />
          Editado
        </TooltipTrigger>
        <TooltipContent>
          Protegido contra sobrescrita do CSV
          {fields.length > 0 ? ` • campos: ${fields.join(", ")}` : ""}
        </TooltipContent>
      </Tooltip>
    );
  }
  if (tx.source === "csv") {
    return <span className={`${BASE} border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300`}>CSV</span>;
  }
  if (tx.source === "projected") {
    return <span className={`${BASE} border-dashed border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300`}>Previsto</span>;
  }
  return <span className={`${BASE} border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`}>Manual</span>;
}
