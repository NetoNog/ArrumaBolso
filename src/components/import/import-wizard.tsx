"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  FileSpreadsheet,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Tag,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { CategorySelect } from "@/components/common/category-select";
import { Pill, type PillTone } from "@/components/common/pill";
import { CardPicker, choiceIssuer, initialCardChoice, isChoiceValid, type CardChoice } from "@/components/import/card-picker";
import { ExportGuide } from "@/components/import/export-guide";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { detectInvoiceMonthFromFilename, formatDateBR, formatDayMonth, formatMonthLabel } from "@/lib/dates";
import { closingDayForCard, createCard } from "@/lib/domain/operations";
import type { Category, ImportBatch } from "@/lib/domain/types";
import { ISSUERS, issuerInfo } from "@/lib/import/issuers";
import {
  CATEGORY_PRESETS,
  findCategoryForPreset,
  presetCategoryId,
  presetFromCategoryId,
  virtualPresetCategories,
} from "@/lib/import/merchant-categories";
import { suggestInvoiceMonth, summarizeStatement, type StatementPreview } from "@/lib/import/preview";
import {
  decodeStatementBytes,
  detectStatement,
  isSupportedFile,
  parseStatement,
  type DetectionSource,
  type StatementDetection,
  type StatementKind,
} from "@/lib/import/statement";
import { formatBRL, parseAmount, sumMoney } from "@/lib/money";
import {
  applyImport,
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

const DETECTION_SOURCE_LABEL: Record<DetectionSource, string> = {
  ofx_bank_code: "pelo código do banco no OFX",
  ofx_org: "pela instituição informada no OFX",
  filename: "pelo nome do arquivo",
  csv_header: "pelas colunas do arquivo",
};

const MONTH_SOURCE_LABEL = {
  filename: "detectada pelo nome do arquivo",
  content: "sugerida pelas datas das compras",
} as const;

const BANK_CHIPS = ISSUERS.filter((info) => info.issuer !== "other").slice(0, 6);

type Step = "upload" | "review" | "done";
type RowFilter = "all" | RowStatus | "alerts" | "uncategorized";

interface LoadedFile {
  name: string;
  size: number;
  text: string;
  detection: StatementDetection;
  preview: StatementPreview;
}

/** Rows the confirmation will write: new ones and user-deleted ones marked for restore. */
function isWritable(row: ReconciledRow, restore: ReadonlySet<string>): boolean {
  return row.status === "new" || (row.status === "deleted" && restore.has(row.uniqueHash));
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
}

export function ImportWizard({ onFinished, compact = false }: { onFinished?: () => void; compact?: boolean }) {
  const { state, commit, currentMonth, setSelectedMonth } = useFinance();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [statementKind, setStatementKind] = useState<StatementKind>("credit_card");
  const [cardChoice, setCardChoice] = useState<CardChoice | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState(currentMonth);
  const [monthSource, setMonthSource] = useState<keyof typeof MONTH_SOURCE_LABEL | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [overrides, setOverrides] = useState<Record<number, string | null>>({});
  const [restore, setRestore] = useState<Set<string>>(new Set());
  const [learnRules, setLearnRules] = useState(true);
  const [fallbackToOther, setFallbackToOther] = useState(false);
  const [filter, setFilter] = useState<RowFilter>("all");
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function acceptFile(candidate: File | undefined) {
    if (!candidate) return;
    if (!isSupportedFile(candidate.name)) {
      toast.error("Formato inválido", { description: "Envie a fatura do cartão em .csv ou .ofx, exportada pelo app do banco." });
      return;
    }
    if (candidate.size > MAX_FILE_BYTES) {
      toast.error("Arquivo muito grande", { description: "O limite é de 5 MB." });
      return;
    }
    setReading(true);
    try {
      const text = decodeStatementBytes(await candidate.arrayBuffer());
      const detection = detectStatement(candidate.name, text);
      const parsed = await parseStatement(detection.format, text, detection.issuer, detection.statementKind);
      if (parsed.rows.length === 0) {
        toast.error("Não encontramos lançamentos neste arquivo", {
          description: parsed.errors[0]?.message ?? "Confira se é a fatura ou extrato exportado pelo banco (CSV ou OFX).",
        });
        return;
      }
      setFile({ name: candidate.name, size: candidate.size, text, detection, preview: summarizeStatement(parsed.rows) });
      setStatementKind(detection.statementKind);
      const initialChoice = initialCardChoice(state.cards, detection);
      setCardChoice(initialChoice);
      const cardClosing =
        initialChoice.kind === "existing"
          ? closingDayForCard(state, initialChoice.cardId)
          : state.settings.closing_day;
      const fromName = detectInvoiceMonthFromFilename(candidate.name);
      const fromContent = suggestInvoiceMonth(parsed.rows, cardClosing);
      if (fromName) {
        setInvoiceMonth(fromName);
        setMonthSource("filename");
      } else if (fromContent) {
        setInvoiceMonth(fromContent);
        setMonthSource("content");
      } else {
        setMonthSource(null);
      }
    } finally {
      setReading(false);
    }
  }

  async function analyze() {
    if (!file) return;
    if (statementKind === "credit_card" && !cardChoice) return;
    setLoading(true);
    try {
      const issuer = statementKind === "credit_card" && cardChoice ? choiceIssuer(state.cards, cardChoice) : file.detection.issuer;
      const parsed = await parseStatement(file.detection.format, file.text, issuer, statementKind);
      if (parsed.rows.length === 0) {
        toast.error("Nenhuma linha válida encontrada", {
          description: parsed.errors[0]?.message ?? "Confira se o arquivo tem colunas de data, descrição e valor.",
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
    if (statementKind === "credit_card" && !cardChoice) return;
    const outcome: { batch: ImportBatch | null } = { batch: null };
    commit((current) => {
      let next = current;
      let cardId: string | null = null;
      if (statementKind === "credit_card" && cardChoice) {
        if (cardChoice.kind === "new") {
          const parsedClosing = cardChoice.closingDay.trim() ? Number(cardChoice.closingDay) : null;
          const parsedDue = cardChoice.dueDay.trim() ? Number(cardChoice.dueDay) : null;
          const parsedLimit = cardChoice.creditLimit.trim() ? parseAmount(cardChoice.creditLimit) : null;
          const created = createCard(next, {
            name: cardChoice.name,
            issuer: cardChoice.issuer,
            brand: cardChoice.brand || null,
            last_four: cardChoice.lastFour || null,
            color: issuerInfo(cardChoice.issuer).color,
            closing_day: parsedClosing,
            due_day: parsedDue,
            credit_limit: parsedLimit,
          });
          next = created.state;
          cardId = created.card.id;
        } else {
          cardId = cardChoice.cardId;
        }
      }
      // Re-reconcile against the latest state so nothing changed between review and write.
      const fresh = reconcile(
        { rows: report.rows, errors: report.errors },
        next,
        { filename: report.filename, invoiceMonth: report.invoiceMonth },
      );
      const result = applyImport(next, fresh, {
        categoryOverrides: overrides,
        restoreHashes: restore,
        cardId,
        learnRules,
        fallbackToOther,
      });
      outcome.batch = result.batch;
      return result.state;
    });
    const created = outcome.batch;
    if (created) {
      setBatch(created);
      setSelectedMonth(report.invoiceMonth);
      setStep("done");
      toast.success("Importação concluída", {
        description: `${created.new_count} novo(s) em ${formatMonthLabel(report.invoiceMonth)}.`,
      });
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setCardChoice(null);
    setMonthSource(null);
    setReport(null);
    setBatch(null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void acceptFile(event.dataTransfer.files[0]);
  }

  /** Sets a row's category and applies it to the other new rows of the same merchant. */
  function changeCategory(target: ReconciledRow, categoryId: string | null) {
    if (!report) return;
    const merchant = target.suggestedCleanTitle.trim().toLowerCase();
    const siblings = report.rows.filter(
      (row) =>
        row.lineNumber !== target.lineNumber &&
        row.type !== "payment" &&
        isWritable(row, restore) &&
        row.suggestedCleanTitle.trim().toLowerCase() === merchant,
    );
    setOverrides((current) => {
      const next = { ...current, [target.lineNumber]: categoryId };
      for (const row of siblings) next[row.lineNumber] = categoryId;
      return next;
    });
    if (siblings.length > 0) {
      toast.success(`Categoria aplicada a mais ${siblings.length} lançamento(s)`, { description: target.suggestedCleanTitle });
    }
  }

  /** User categories plus presets the user does not have yet (created on confirmation). */
  const reviewCategories = useMemo<Category[]>(() => {
    const missing = CATEGORY_PRESETS.filter((preset) => !findCategoryForPreset(state.categories, preset)).map((preset) =>
      presetCategoryId(preset.key),
    );
    const virtual = virtualPresetCategories(missing).map((category) => ({ ...category, name: `${category.name} · nova` }));
    return [...state.categories, ...virtual];
  }, [state.categories]);

  /** Category currently stored on the transaction an already-imported row points to. */
  const storedCategoryByTx = useMemo(
    () => new Map(state.transactions.map((tx) => [tx.id, tx.category_id])),
    [state.transactions],
  );

  const effectiveCategory = (row: ReconciledRow): string | null =>
    row.lineNumber in overrides ? overrides[row.lineNumber] : row.suggestedCategoryId;

  /** Totals and categorisation of what the confirmation will write. */
  const writeSummary = useMemo(() => {
    if (!report) return { count: 0, purchases: 0, credits: 0, categorized: 0, uncategorized: 0, created: [] as string[] };
    const writable = report.rows.filter((row) => isWritable(row, restore));
    const expenses = writable.filter((row) => row.type !== "payment");
    const effective = expenses.map((row) => (row.lineNumber in overrides ? overrides[row.lineNumber] : row.suggestedCategoryId));
    const created = new Set<string>();
    for (const id of effective) {
      const preset = presetFromCategoryId(id);
      if (preset) created.add(preset.name);
    }
    return {
      count: writable.length,
      purchases: sumMoney(writable.filter((row) => row.amount > 0).map((row) => row.amount)),
      credits: sumMoney(writable.filter((row) => row.amount < 0).map((row) => -row.amount)),
      categorized: effective.filter(Boolean).length,
      uncategorized: effective.filter((id) => !id).length,
      created: Array.from(created),
    };
  }, [report, overrides, restore]);

  const visibleRows = useMemo(() => {
    if (!report) return [];
    if (filter === "all") return report.rows;
    if (filter === "alerts") return report.rows.filter((row) => row.alerts.some((alert) => alert !== "payment"));
    if (filter === "uncategorized") {
      return report.rows.filter(
        (row) =>
          row.type !== "payment" &&
          isWritable(row, restore) &&
          !(row.lineNumber in overrides ? overrides[row.lineNumber] : row.suggestedCategoryId),
      );
    }
    return report.rows.filter((row) => row.status === filter);
  }, [report, filter, overrides, restore]);

  const toggleFilter = (next: RowFilter) => setFilter(filter === next ? "all" : next);
  const canAnalyze =
    file !== null &&
    (statementKind === "bank_account" || (cardChoice !== null && isChoiceValid(state.cards, cardChoice))) &&
    /^\d{4}-\d{2}$/.test(invoiceMonth);

  return (
    <div className="grid gap-5">
      <Stepper step={step} />

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.ofx,.qfx,text/csv,application/x-ofx"
        className="sr-only"
        aria-label="Arquivo da fatura"
        onChange={(event) => {
          void acceptFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {step === "upload" && !file ? (
        <div className="grid gap-3">
          <div
            role="button"
            tabIndex={0}
            aria-busy={reading}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 text-center transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
              compact ? "py-8" : "py-12",
              dragging ? "border-blue-500 bg-blue-50/60 dark:bg-blue-500/10" : "border-border hover:border-blue-300 hover:bg-muted/40",
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10">
              <UploadCloud className="size-5" />
            </span>
            <div className="grid gap-1">
              <p className="text-sm font-medium">{reading ? "Lendo arquivo..." : "Arraste a fatura do cartão ou clique para escolher"}</p>
              <p className="text-xs text-muted-foreground">Arquivos .csv ou .ofx, até 5 MB • reimportar o mesmo arquivo nunca duplica</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {BANK_CHIPS.map((info) => (
                <span key={info.issuer} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs">
                  <span className="size-2 rounded-full" style={{ backgroundColor: info.color }} aria-hidden />
                  {info.label}
                </span>
              ))}
              <span className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground">e outros</span>
            </div>
          </div>
          <ExportGuide />
        </div>
      ) : null}

      {step === "upload" && file && cardChoice ? (
        <div className="grid gap-4">
          <FileSummary file={file} onReplace={() => inputRef.current?.click()} onRemove={reset} />

          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3">
            <span className="text-xs font-medium text-muted-foreground">Tipo de arquivo:</span>
            <button
              type="button"
              onClick={() => setStatementKind("credit_card")}
              aria-pressed={statementKind === "credit_card"}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                statementKind === "credit_card" ? "border-blue-600 bg-blue-600 text-white" : "bg-card text-foreground hover:bg-muted",
              )}
            >
              Fatura de cartão de crédito
            </button>
            <button
              type="button"
              onClick={() => setStatementKind("bank_account")}
              aria-pressed={statementKind === "bank_account"}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                statementKind === "bank_account" ? "border-emerald-600 bg-emerald-600 text-white" : "bg-card text-foreground hover:bg-muted",
              )}
            >
              Extrato de conta corrente (Pix / Débito / Boleto)
            </button>
          </div>

          <div className="grid gap-4 rounded-xl border p-4 lg:grid-cols-[1fr_auto]">
            {statementKind === "credit_card" ? (
              <CardPicker cards={state.cards} value={cardChoice} onChange={setCardChoice} detection={file.detection} />
            ) : (
              <div className="grid content-center gap-1">
                <p className="text-sm font-medium">Extrato de conta bancária</p>
                <p className="text-xs text-muted-foreground">
                  Créditos entram como Receita, débitos como Saída (Pix/Débito/Boleto) e pagamentos de fatura são marcados como Pagamento para não contar em dobro.
                </p>
              </div>
            )}
            <div className="grid content-start gap-1.5">
              <Label htmlFor="import-month" className="text-xs text-muted-foreground">
                {statementKind === "credit_card" ? "Fatura de destino" : "Competência de destino"}
              </Label>
              <Input
                id="import-month"
                type="month"
                className="w-48"
                value={invoiceMonth}
                onChange={(event) => {
                  setInvoiceMonth(event.target.value);
                  setMonthSource(null);
                }}
              />
              {monthSource ? <p className="text-xs text-muted-foreground">{MONTH_SOURCE_LABEL[monthSource]}</p> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="ghost" onClick={reset}>
              Cancelar
            </Button>
            <Button onClick={analyze} disabled={!canAnalyze || loading}>
              {loading ? "Analisando..." : "Revisar lançamentos"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "review" && report ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryTile icon={Sparkles} tone="emerald" value={report.summary.newCount} label="Novos" hint="serão adicionados" active={filter === "new"} onClick={() => toggleFilter("new")} />
            <SummaryTile icon={Lock} tone="amber" value={report.summary.protectedCount} label="Protegidos" hint="editados por você, mantidos" active={filter === "protected"} onClick={() => toggleFilter("protected")} />
            <SummaryTile icon={CircleDashed} tone="slate" value={report.summary.existingCount} label="Já importados" hint="ignorados, sem duplicar" active={filter === "existing"} onClick={() => toggleFilter("existing")} />
            <SummaryTile icon={AlertTriangle} tone="rose" value={report.summary.alertCount} label="Alertas" hint="duplicidades e parcelas" active={filter === "alerts"} onClick={() => toggleFilter("alerts")} />
          </div>

          {report.summary.deletedCount > 0 ? (
            <button
              type="button"
              onClick={() => toggleFilter("deleted")}
              className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
            >
              <RotateCcw className="size-3.5 shrink-0" />
              {report.summary.deletedCount} linha(s) foram excluídas por você antes e não serão reimportadas. Clique para revisar e restaurar se quiser.
            </button>
          ) : null}

          {writeSummary.categorized + writeSummary.uncategorized > 0 ? (
            <div className="grid gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex min-w-0 flex-1 items-start gap-2">
                  <Sparkles className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    <strong>
                      {writeSummary.categorized} de {writeSummary.categorized + writeSummary.uncategorized}
                    </strong>{" "}
                    gasto(s) categorizado(s) automaticamente (por regras, histórico e dicionário).
                    {writeSummary.created.length > 0 ? ` Categorias que serão criadas: ${writeSummary.created.join(", ")}.` : ""} Ao
                    mudar manualmente uma categoria, ela vale para todos os lançamentos do mesmo estabelecimento.
                  </span>
                </span>
                {writeSummary.uncategorized > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleFilter("uncategorized")}
                    aria-pressed={filter === "uncategorized"}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-300 px-2.5 py-1 font-medium transition-colors hover:bg-blue-100 dark:border-blue-500/40 dark:hover:bg-blue-500/20",
                      filter === "uncategorized" && "bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-600",
                    )}
                  >
                    <Tag className="size-3" /> {writeSummary.uncategorized} sem categoria
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-blue-200/70 pt-2 dark:border-blue-500/20">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <Checkbox checked={learnRules} onCheckedChange={(checked) => setLearnRules(Boolean(checked))} />
                  <span>Aprender categorias ajustadas manualmente como regras para futuras importações</span>
                </label>
                {writeSummary.uncategorized > 0 ? (
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <Checkbox checked={fallbackToOther} onCheckedChange={(checked) => setFallbackToOther(Boolean(checked))} />
                    <span>Classificar os {writeSummary.uncategorized} restantes automaticamente como “Outros”</span>
                  </label>
                ) : null}
              </div>
            </div>
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

          {filter !== "all" ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Mostrando {visibleRows.length} de {report.rows.length} linha(s)
              </span>
              <button type="button" className="font-medium text-foreground hover:underline" onClick={() => setFilter("all")}>
                Limpar filtro
              </button>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border">
            <div className={cn("overflow-auto overscroll-contain", compact ? "max-h-[42dvh]" : "max-h-[60dvh]")}>
              {/* Desktop: table */}
              <Table className="hidden md:table">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-24">Data</TableHead>
                    <TableHead>Lançamento</TableHead>
                    <TableHead className="w-52">Categoria</TableHead>
                    <TableHead className="w-28 text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row) => (
                    <TableRow key={row.uniqueHash} className={cn(!isWritable(row, restore) && "text-muted-foreground")}>
                      <TableCell>
                        <StatusCell row={row} restored={restore.has(row.uniqueHash)} onRestore={(checked) => setRestore((current) => toggled(current, row.uniqueHash, checked))} />
                      </TableCell>
                      <TableCell className="num text-xs">{formatDateBR(row.date)}</TableCell>
                      <TableCell>
                        <TitleCell row={row} />
                      </TableCell>
                      <TableCell>
                        <CategoryCell
                          row={row}
                          categories={reviewCategories}
                          editable={row.type !== "payment" && row.type !== "income" && isWritable(row, restore)}
                          value={effectiveCategory(row)}
                          isManualOverride={row.lineNumber in overrides}
                          fallbackToOther={fallbackToOther}
                          storedCategoryId={row.existingTransactionId ? (storedCategoryByTx.get(row.existingTransactionId) ?? null) : null}
                          onChange={(id) => changeCategory(row, id)}
                        />
                      </TableCell>
                      <TableCell className={cn("num text-right text-sm", row.amount < 0 && "text-emerald-600")}>{formatBRL(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Mobile: cards */}
              <ul className="divide-y md:hidden">
                {visibleRows.map((row) => (
                  <li key={row.uniqueHash} className={cn("grid gap-2 p-3", !isWritable(row, restore) && "text-muted-foreground")}>
                    <div className="flex items-start justify-between gap-3">
                      <TitleCell row={row} />
                      <span className={cn("num shrink-0 text-sm font-medium", row.amount < 0 && "text-emerald-600")}>{formatBRL(row.amount)}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusCell row={row} restored={restore.has(row.uniqueHash)} onRestore={(checked) => setRestore((current) => toggled(current, row.uniqueHash, checked))} />
                        <span className="num text-xs text-muted-foreground">{formatDateBR(row.date)}</span>
                      </div>
                      <CategoryCell
                        row={row}
                        categories={reviewCategories}
                        editable={row.type !== "payment" && row.type !== "income" && isWritable(row, restore)}
                        value={effectiveCategory(row)}
                        isManualOverride={row.lineNumber in overrides}
                        fallbackToOther={fallbackToOther}
                        storedCategoryId={row.existingTransactionId ? (storedCategoryByTx.get(row.existingTransactionId) ?? null) : null}
                        onChange={(id) => changeCategory(row, id)}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              {visibleRows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nada neste filtro.</p> : null}
            </div>
          </div>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t bg-card px-1 pt-3 pb-1">
            <Button variant="ghost" onClick={() => setStep("upload")}>
              <ArrowLeft /> Voltar
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="text-right text-xs text-muted-foreground">
                <p>
                  Fatura <strong className="font-medium text-foreground">{formatMonthLabel(report.invoiceMonth)}</strong> •{" "}
                  {writeSummary.count} item(ns) serão gravados
                </p>
                {writeSummary.count > 0 ? (
                  <p className="num">
                    Compras <strong className="font-medium text-foreground">{formatBRL(writeSummary.purchases)}</strong>
                    {writeSummary.credits > 0 ? <> • Pagamentos/estornos {formatBRL(writeSummary.credits)}</> : null}
                  </p>
                ) : null}
              </div>
              <Button onClick={confirmImport} disabled={writeSummary.count === 0}>
                <ShieldCheck /> Confirmar importação
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {step === "done" && batch ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
            <CheckCircle2 className="size-6" />
          </span>
          <div className="grid gap-1">
            <p className="text-base font-semibold">Fatura de {formatMonthLabel(batch.invoice_month)} importada</p>
            <p className="text-sm text-muted-foreground">{batch.filename}</p>
          </div>
          <dl className="grid w-full max-w-md grid-cols-3 gap-2">
            <DoneStat label="Novos" value={batch.new_count} tone="text-emerald-600" />
            <DoneStat label="Protegidos" value={batch.protected_count} tone="text-amber-600" />
            <DoneStat label="Ignorados" value={batch.skipped_count} tone="text-muted-foreground" />
          </dl>
          <p className="text-xs text-muted-foreground">Mudou de ideia? Você pode desfazer este lote no histórico de importações.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={reset}>
              <RefreshCw /> Importar outra fatura
            </Button>
            {!compact ? (
              <Button variant="outline" nativeButton={false} render={<Link href="/lancamentos" />}>
                Ver lançamentos
              </Button>
            ) : null}
            {onFinished ? <Button onClick={onFinished}>Ver painel</Button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function toggled(current: ReadonlySet<string>, hash: string, checked: boolean): Set<string> {
  const next = new Set(current);
  if (checked) next.add(hash);
  else next.delete(hash);
  return next;
}

function FileSummary({ file, onReplace, onRemove }: { file: LoadedFile; onReplace: () => void; onRemove: () => void }) {
  const { detection, preview } = file;
  const bank = detection.issuer ? issuerInfo(detection.issuer) : null;
  return (
    <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10">
          <FileSpreadsheet className="size-5" />
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Pill tone="slate">{detection.format}</Pill>
            <span>{formatBytes(file.size)}</span>
            {bank ? (
              <span className="inline-flex items-center gap-1.5">
                • <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: bank.color }} aria-hidden />
                <span className="font-medium text-foreground">{bank.label}</span>
                {detection.source ? <span>({DETECTION_SOURCE_LABEL[detection.source]})</span> : null}
              </span>
            ) : (
              <span>• banco não identificado, escolha o cartão abaixo</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="outline" size="sm" onClick={onReplace}>
            Trocar
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Remover arquivo" onClick={onRemove}>
            <X />
          </Button>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <PreviewStat label="Lançamentos" value={String(preview.count)} />
        <PreviewStat
          label="Período"
          value={preview.firstDate && preview.lastDate ? `${formatDayMonth(preview.firstDate)} – ${formatDayMonth(preview.lastDate)}` : "—"}
        />
        <PreviewStat label="Compras" value={formatBRL(preview.purchasesTotal)} />
        <PreviewStat label="Pagamentos/estornos" value={formatBRL(preview.creditsTotal)} />
      </dl>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="num text-sm font-semibold">{value}</dd>
    </div>
  );
}

function DoneStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <dd className={cn("num text-xl font-semibold", tone)}>{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

function StatusCell({ row, restored, onRestore }: { row: ReconciledRow; restored: boolean; onRestore: (checked: boolean) => void }) {
  const meta = STATUS_META[row.status];
  return (
    <div className="flex flex-col items-start gap-1">
      <Pill tone={meta.tone}>{meta.label}</Pill>
      {row.status === "deleted" ? (
        <label className="flex items-center gap-1.5 text-xs">
          <Checkbox checked={restored} onCheckedChange={(checked) => onRestore(checked)} />
          Restaurar
        </label>
      ) : null}
    </div>
  );
}

function TitleCell({ row }: { row: ReconciledRow }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate font-medium text-foreground">{row.suggestedCleanTitle}</span>
      <span className="num truncate text-xs text-muted-foreground">{row.rawTitle}</span>
      {row.alerts.includes("duplicate_same_day") || row.installment || row.type === "payment" ? (
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
      ) : null}
    </div>
  );
}

const SUGGESTION_SOURCE_LABEL: Record<string, string> = {
  rule: "Automático · regra",
  history: "Automático · histórico",
  user_category: "Automático · sua categoria",
  dictionary: "Automático · dicionário",
  bank: "Automático · banco",
};

function CategoryCell({
  row,
  categories,
  editable,
  value,
  isManualOverride,
  fallbackToOther,
  storedCategoryId,
  onChange,
}: {
  row: ReconciledRow;
  categories: readonly Category[];
  editable: boolean;
  value: string | null;
  isManualOverride: boolean;
  fallbackToOther: boolean;
  storedCategoryId: string | null;
  onChange: (id: string | null) => void;
}) {
  if (row.type === "payment" || row.type === "income") return <span className="text-xs text-muted-foreground">—</span>;
  if (editable) {
    const badge = isManualOverride
      ? "Manual"
      : value && row.suggestedCategorySource
        ? SUGGESTION_SOURCE_LABEL[row.suggestedCategorySource]
        : !value && fallbackToOther
          ? "Automático · Outros"
          : null;
    return (
      <div className="grid gap-1">
        <CategorySelect categories={categories} value={value} onChange={onChange} size="sm" className="w-48" />
        {badge ? <span className="text-[10.5px] text-muted-foreground">{badge}</span> : null}
      </div>
    );
  }
  const shownId = row.existingTransactionId ? storedCategoryId : value;
  return <span className="text-xs">{categories.find((category) => category.id === shownId)?.name ?? "—"}</span>;
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
    emerald: "tile-emerald",
    amber: "tile-amber",
    slate: "bg-muted text-muted-foreground",
    rose: "tile-rose",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/40",
        active && "border-brand ring-2 ring-brand/20",
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
    { key: "upload", label: "Arquivo" },
    { key: "review", label: "Revisão" },
    { key: "done", label: "Concluído" },
  ];
  const activeIndex = steps.findIndex((item) => item.key === step);
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((item, index) => (
        <li key={item.key} className="flex items-center gap-2" aria-current={index === activeIndex ? "step" : undefined}>
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold",
              index < activeIndex && "border-emerald-500 bg-emerald-500 text-white",
              index === activeIndex && "border-blue-600 bg-blue-600 text-white",
              index > activeIndex && "text-muted-foreground",
            )}
          >
            {index < activeIndex ? <CheckCircle2 className="size-3" /> : index + 1}
          </span>
          <span className={cn(index === activeIndex ? "font-medium text-foreground" : "text-muted-foreground")}>{item.label}</span>
          {index < steps.length - 1 ? <span className="mx-1 h-px w-6 bg-border" /> : null}
        </li>
      ))}
    </ol>
  );
}
