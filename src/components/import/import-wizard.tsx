"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  FileSpreadsheet,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { CategorySelect } from "@/components/common/category-select";
import { Pill, type PillTone } from "@/components/common/pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { detectInvoiceMonthFromFilename, formatDateBR, formatMonthLabel } from "@/lib/dates";
import type { ImportBatch } from "@/lib/domain/types";
import { formatBRL } from "@/lib/money";
import {
  applyImport,
  parseNubankCsv,
  reconcile,
  type ReconciledRow,
  type ReconciliationReport,
  type RowStatus,
} from "@/lib/nubank-parser";
import { useFinance } from "@/lib/store/finance-store";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const STATUS_META: Record<RowStatus, { label: string; tone: PillTone }> = {
  new: { label: "Novo", tone: "emerald" },
  protected: { label: "Protegido", tone: "amber" },
  existing: { label: "Já existe", tone: "slate" },
  deleted: { label: "Removido", tone: "rose" },
};

type Step = "upload" | "review" | "done";
type RowFilter = "all" | RowStatus | "alerts";

export function ImportWizard({ onFinished, compact = false }: { onFinished?: () => void; compact?: boolean }) {
  const { state, commit, currentMonth, setSelectedMonth } = useFinance();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState(currentMonth);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [overrides, setOverrides] = useState<Record<number, string | null>>({});
  const [restore, setRestore] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<RowFilter>("all");
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function acceptFile(candidate: File | undefined) {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".csv")) {
      toast.error("Formato inválido", { description: "Envie o arquivo .csv exportado pelo Nubank." });
      return;
    }
    if (candidate.size > MAX_FILE_BYTES) {
      toast.error("Arquivo muito grande", { description: "O limite é de 5 MB." });
      return;
    }
    const text = await candidate.text();
    setFile({ name: candidate.name, text });
    const detected = detectInvoiceMonthFromFilename(candidate.name);
    if (detected) setInvoiceMonth(detected);
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    try {
      const parsed = await parseNubankCsv(file.text);
      if (parsed.rows.length === 0) {
        toast.error("Nenhuma linha válida encontrada", {
          description: parsed.errors[0]?.message ?? "Confira se o arquivo segue o formato date,title,amount.",
        });
        return;
      }
      setReport(reconcile(parsed, state, { filename: file.name, invoiceMonth }));
      setOverrides({});
      setRestore(new Set());
      setFilter("all");
      setStep("review");
    } finally {
      setLoading(false);
    }
  }

  function confirmImport() {
    if (!report) return;
    const outcome: { batch: ImportBatch | null } = { batch: null };
    commit((current) => {
      // Re-reconcile against the latest state so nothing changed between review and write.
      const fresh = reconcile(
        { rows: report.rows, errors: report.errors },
        current,
        { filename: report.filename, invoiceMonth: report.invoiceMonth },
      );
      const result = applyImport(current, fresh, { categoryOverrides: overrides, restoreHashes: restore });
      outcome.batch = result.batch;
      return result.state;
    });
    const created = outcome.batch;
    if (created) {
      setBatch(created);
      setSelectedMonth(report.invoiceMonth);
      setStep("done");
      toast.success("Importação segura concluída", {
        description: `${created.new_count} novo(s) em ${formatMonthLabel(report.invoiceMonth)}.`,
      });
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setReport(null);
    setBatch(null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void acceptFile(event.dataTransfer.files[0]);
  }

  const visibleRows = useMemo(() => {
    if (!report) return [];
    if (filter === "all") return report.rows;
    if (filter === "alerts") return report.rows.filter((row) => row.alerts.some((alert) => alert !== "payment"));
    return report.rows.filter((row) => row.status === filter);
  }, [report, filter]);

  return (
    <div className="grid gap-5">
      <Stepper step={step} />

      {step === "upload" ? (
        <div className="grid gap-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 text-center transition-colors",
              compact ? "py-8" : "py-12",
              dragging ? "border-blue-500 bg-blue-50/60 dark:bg-blue-500/10" : "border-border hover:border-blue-300 hover:bg-muted/40",
            )}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10">
              {file ? <FileSpreadsheet className="size-5" /> : <UploadCloud className="size-5" />}
            </span>
            {file ? (
              <>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">Clique para trocar o arquivo</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Arraste o CSV do Nubank ou clique para escolher</p>
                <p className="text-xs text-muted-foreground">Formato: date,title,amount • reimportar o mesmo arquivo é seguro</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                void acceptFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="import-month" className="text-xs text-muted-foreground">
                Fatura de destino {file && detectInvoiceMonthFromFilename(file.name) ? "(detectada pelo nome do arquivo)" : ""}
              </Label>
              <Input
                id="import-month"
                type="month"
                className="w-48"
                value={invoiceMonth}
                onChange={(event) => setInvoiceMonth(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={analyze} disabled={!file || loading || !/^\d{4}-\d{2}$/.test(invoiceMonth)}>
                {loading ? "Analisando..." : "Analisar conciliação"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {step === "review" && report ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryTile icon={Sparkles} tone="emerald" value={report.summary.newCount} label="Novos lançamentos" hint="serão adicionados" active={filter === "new"} onClick={() => setFilter(filter === "new" ? "all" : "new")} />
            <SummaryTile icon={Lock} tone="amber" value={report.summary.protectedCount} label="Editados manualmente" hint="protegidos, não sobrescritos" active={filter === "protected"} onClick={() => setFilter(filter === "protected" ? "all" : "protected")} />
            <SummaryTile icon={CircleDashed} tone="slate" value={report.summary.existingCount} label="Já existentes" hint="ignorados (sem duplicar)" active={filter === "existing"} onClick={() => setFilter(filter === "existing" ? "all" : "existing")} />
            <SummaryTile icon={AlertTriangle} tone="rose" value={report.summary.alertCount} label="Alertas" hint="duplicidades e parcelas" active={filter === "alerts"} onClick={() => setFilter(filter === "alerts" ? "all" : "alerts")} />
          </div>

          {report.summary.deletedCount > 0 ? (
            <button
              type="button"
              onClick={() => setFilter(filter === "deleted" ? "all" : "deleted")}
              className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
            >
              <RotateCcw className="size-3.5 shrink-0" />
              {report.summary.deletedCount} linha(s) foram excluídas por você antes e não serão reimportadas. Clique para revisar e restaurar se quiser.
            </button>
          ) : null}

          {report.errors.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="font-medium">{report.errors.length} linha(s) ignorada(s) por erro de formato:</p>
              <ul className="mt-1 list-disc pl-4">
                {report.errors.slice(0, 5).map((error) => (
                  <li key={`${error.lineNumber}-${error.message}`}>
                    Linha {error.lineNumber}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border">
            <div className={cn("overflow-auto overscroll-contain", compact ? "max-h-[38dvh]" : "max-h-[52dvh]")}>
              <Table className="min-w-[640px]">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-24">Data</TableHead>
                    <TableHead>Lançamento</TableHead>
                    <TableHead className="w-44">Categoria</TableHead>
                    <TableHead className="w-28 text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row) => (
                    <ReviewRow
                      key={row.uniqueHash}
                      row={row}
                      overrides={overrides}
                      onCategory={(id) => setOverrides((current) => ({ ...current, [row.lineNumber]: id }))}
                      restored={restore.has(row.uniqueHash)}
                      onRestore={(checked) =>
                        setRestore((current) => {
                          const next = new Set(current);
                          if (checked) next.add(row.uniqueHash);
                          else next.delete(row.uniqueHash);
                          return next;
                        })
                      }
                    />
                  ))}
                  {visibleRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Nada neste filtro.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep("upload")}>
              <ArrowLeft /> Voltar
            </Button>
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Fatura <strong className="font-medium text-foreground">{formatMonthLabel(report.invoiceMonth)}</strong> •{" "}
                {report.summary.newCount + restore.size} item(ns) serão gravados
              </p>
              <Button onClick={confirmImport} disabled={report.summary.newCount + restore.size === 0}>
                <ShieldCheck /> Confirmar Importação Segura
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {step === "done" && batch ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
            <CheckCircle2 className="size-6" />
          </span>
          <div>
            <p className="text-base font-semibold">Lote registrado no histórico</p>
            <p className="text-sm text-muted-foreground">
              {batch.filename} • {batch.new_count} novo(s) • {batch.protected_count} protegido(s) • {batch.skipped_count} ignorado(s)
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>
              Importar outro arquivo
            </Button>
            {onFinished ? <Button onClick={onFinished}>Ver fatura</Button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReviewRow({
  row,
  overrides,
  onCategory,
  restored,
  onRestore,
}: {
  row: ReconciledRow;
  overrides: Record<number, string | null>;
  onCategory: (id: string | null) => void;
  restored: boolean;
  onRestore: (checked: boolean) => void;
}) {
  const { state } = useFinance();
  const meta = STATUS_META[row.status];
  const editable = row.type !== "payment" && (row.status === "new" || (row.status === "deleted" && restored));
  const categoryId = row.lineNumber in overrides ? overrides[row.lineNumber] : row.suggestedCategoryId;
  const existingCategory = state.categories.find((category) => category.id === row.suggestedCategoryId);

  return (
    <TableRow className={cn(row.status !== "new" && !restored && "text-muted-foreground")}>
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          <Pill tone={meta.tone}>{meta.label}</Pill>
          {row.status === "deleted" ? (
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox checked={restored} onCheckedChange={(checked) => onRestore(checked)} />
              Restaurar
            </label>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="num text-xs">{formatDateBR(row.date)}</TableCell>
      <TableCell>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium text-foreground">{row.suggestedCleanTitle}</span>
          <span className="num truncate text-xs text-muted-foreground">{row.rawTitle}</span>
          <div className="flex flex-wrap gap-1">
            {row.alerts.includes("duplicate_same_day") ? <Pill tone="amber">Mesmo dia #{row.occurrenceIndex}</Pill> : null}
            {row.installment ? (
              <Pill tone="blue">
                Parcela {row.installment.current}/{row.installment.total}
                {row.replacesProjectedId ? " • substitui previsão" : ""}
              </Pill>
            ) : null}
            {row.type === "payment" ? <Pill tone="sky">Pagamento</Pill> : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        {editable ? (
          <CategorySelect categories={state.categories} value={categoryId} onChange={onCategory} size="sm" className="w-40" />
        ) : (
          <span className="text-xs">{row.type === "payment" ? "—" : (existingCategory?.name ?? "—")}</span>
        )}
      </TableCell>
      <TableCell className={cn("num text-right text-sm", row.amount < 0 && "text-emerald-600")}>{formatBRL(row.amount)}</TableCell>
    </TableRow>
  );
}

function SummaryTile({
  icon: Icon,
  tone,
  value,
  label,
  hint,
  active,
  onClick,
}: {
  icon: typeof Sparkles;
  tone: "emerald" | "amber" | "slate" | "rose";
  value: number;
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  const tones = {
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
    slate: "text-slate-500 bg-slate-100 dark:bg-zinc-800",
    rose: "text-rose-600 bg-rose-50 dark:bg-rose-500/10",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/40",
        active && "border-blue-400 ring-2 ring-blue-100 dark:ring-blue-500/20",
      )}
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
        <Icon className="size-4" />
      </span>
      <span className="grid">
        <span className="num text-xl font-semibold">{value}</span>
        <span className="text-xs font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "review", label: "Conciliação" },
    { key: "done", label: "Histórico" },
  ];
  const activeIndex = steps.findIndex((item) => item.key === step);
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((item, index) => (
        <li key={item.key} className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold",
              index < activeIndex && "border-emerald-500 bg-emerald-500 text-white",
              index === activeIndex && "border-blue-600 bg-blue-600 text-white",
              index > activeIndex && "text-muted-foreground",
            )}
          >
            {index + 1}
          </span>
          <span className={cn(index === activeIndex ? "font-medium text-foreground" : "text-muted-foreground")}>{item.label}</span>
          {index < steps.length - 1 ? <span className="mx-1 h-px w-6 bg-border" /> : null}
        </li>
      ))}
    </ol>
  );
}
