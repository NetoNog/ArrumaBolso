"use client";

import { History, RotateCcw, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Pill } from "@/components/common/pill";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMonthLabel } from "@/lib/dates";
import { restoreDeletedHash } from "@/lib/domain/operations";
import type { ImportBatch } from "@/lib/domain/types";
import { cardLabel } from "@/lib/import/issuers";
import { undoImportBatch } from "@/lib/nubank-parser";
import { useFinance } from "@/lib/store/finance-store";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function ImportHistory() {
  const { state, commit } = useFinance();
  const [undoTarget, setUndoTarget] = useState<ImportBatch | null>(null);

  const cardName = (batch: ImportBatch) => {
    const card = state.cards.find((item) => item.id === batch.card_id);
    return card ? cardLabel(card) : "—";
  };

  const removableCount = (batch: ImportBatch) =>
    state.transactions.filter((tx) => tx.batch_id === batch.id && !tx.is_user_edited).length;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-muted-foreground" /> Histórico de importações
          </CardTitle>
          <CardDescription>Cada upload vira um lote. Desfazer remove apenas os itens novos daquele lote que você não editou.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Arquivo</TableHead>
                  <TableHead>Cartão</TableHead>
                  <TableHead>Fatura</TableHead>
                  <TableHead>Data/hora</TableHead>
                  <TableHead className="text-right">Novos</TableHead>
                  <TableHead className="text-right">Protegidos</TableHead>
                  <TableHead className="text-right">Ignorados</TableHead>
                  <TableHead className="pr-4 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.import_batches.map((batch) => (
                  <TableRow key={batch.id} className={batch.undone_at ? "text-muted-foreground" : undefined}>
                    <TableCell className="num pl-4 text-xs">{batch.filename}</TableCell>
                    <TableCell className="text-xs">{cardName(batch)}</TableCell>
                    <TableCell>{formatMonthLabel(batch.invoice_month)}</TableCell>
                    <TableCell className="num text-xs">{dateTimeFormatter.format(new Date(batch.created_at))}</TableCell>
                    <TableCell className="num text-right">{batch.new_count}</TableCell>
                    <TableCell className="num text-right">{batch.protected_count}</TableCell>
                    <TableCell className="num text-right">{batch.skipped_count}</TableCell>
                    <TableCell className="pr-4 text-right">
                      {batch.undone_at ? (
                        <Pill tone="slate">Desfeito</Pill>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setUndoTarget(batch)}>
                          <Undo2 /> Desfazer este lote
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {state.import_batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma importação ainda.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Lista de bloqueio do CSV</CardTitle>
          <CardDescription>Itens do CSV que você excluiu. Eles não voltam em reimportações até serem liberados aqui.</CardDescription>
          <CardAction>
            <Pill tone="rose">{state.deleted_csv_hashes.length} bloqueado(s)</Pill>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-2">
          {state.deleted_csv_hashes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item bloqueado.</p>
          ) : (
            state.deleted_csv_hashes.map((item) => (
              <div key={item.unique_hash} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.raw_title}</p>
                  <p className="num truncate text-xs text-muted-foreground">
                    {item.unique_hash.slice(0, 16)}… • excluído em {dateTimeFormatter.format(new Date(item.deleted_at))}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    commit((current) => restoreDeletedHash(current, item.unique_hash));
                    toast.success("Liberado", { description: "Ele voltará na próxima importação do CSV." });
                  }}
                >
                  <RotateCcw /> Liberar
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AlertDialog open={undoTarget !== null} onOpenChange={(open) => !open && setUndoTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer o lote “{undoTarget?.filename}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {undoTarget ? removableCount(undoTarget) : 0} item(ns) não editado(s) serão removidos. Itens que você editou permanecem, e
              parcelas reais voltam a ser previsões.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (!undoTarget) return;
                commit((current) => undoImportBatch(current, undoTarget.id));
                toast.success("Lote desfeito");
                setUndoTarget(null);
              }}
            >
              Desfazer lote
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
