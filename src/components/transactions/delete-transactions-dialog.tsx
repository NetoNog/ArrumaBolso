"use client";

import { toast } from "sonner";

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
import { deleteTransactions, type DeleteScope } from "@/lib/domain/operations";
import { formatBRL } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

export function DeleteTransactionsDialog({
  ids,
  onOpenChange,
  onDeleted,
}: {
  ids: string[] | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const { state, commit } = useFinance();
  const targets = state.transactions.filter((tx) => ids?.includes(tx.id));
  const single = targets.length === 1 ? targets[0] : null;
  const isInstallment = Boolean(single?.installment_group_id && single.installment_current);
  const followingCount = single?.installment_group_id
    ? state.transactions.filter(
        (tx) =>
          tx.installment_group_id === single.installment_group_id &&
          (tx.installment_current ?? 0) >= (single.installment_current ?? 0),
      ).length
    : 0;
  const csvCount = targets.filter((tx) => tx.unique_hash).length;

  function remove(scope: DeleteScope) {
    if (!ids) return;
    commit((current) => deleteTransactions(current, ids, scope));
    toast.success(scope === "following" ? `${followingCount} parcela(s) excluída(s)` : `${targets.length} lançamento(s) excluído(s)`, {
      description: csvCount > 0 ? "Itens do CSV foram bloqueados e não voltarão em reimportações." : undefined,
    });
    onOpenChange(false);
    onDeleted?.();
  }

  return (
    <AlertDialog open={ids !== null && targets.length > 0} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {single ? `Excluir “${single.clean_title}”?` : `Excluir ${targets.length} lançamentos?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {single ? `${formatBRL(single.amount)} • ` : ""}
            {isInstallment
              ? "Excluir apenas esta parcela ou esta e todas as parcelas futuras?"
              : "Esta ação não pode ser desfeita."}
            {csvCount > 0 ? " Itens vindos do CSV ficam na lista de bloqueio para não ressuscitarem." : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          {isInstallment && followingCount > 1 ? (
            <>
              <Button variant="outline" onClick={() => remove("single")}>
                Só esta parcela
              </Button>
              <Button variant="destructive" onClick={() => remove("following")}>
                Esta e as {followingCount - 1} futuras
              </Button>
            </>
          ) : (
            <Button variant="destructive" onClick={() => remove("single")}>
              Excluir
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
