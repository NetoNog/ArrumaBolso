"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountDeletionError, deleteOwnAccount } from "@/lib/data/account";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Word the user types to confirm; guards against an accidental, irreversible click. */
const CONFIRMATION_WORD = "EXCLUIR";

/** Settings card that permanently deletes the user's account and all of its data. */
export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const confirmed = confirmation.trim().toUpperCase() === CONFIRMATION_WORD;

  function changeOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) setConfirmation("");
  }

  async function deleteAccount() {
    const client = getSupabaseBrowserClient();
    if (!client || !confirmed) return;
    setPending(true);
    try {
      await deleteOwnAccount(client);
    } catch (error) {
      setPending(false);
      const description = error instanceof AccountDeletionError ? error.message : "Tente novamente em instantes.";
      toast.error("Falha ao excluir a conta", { description });
      return;
    }
    // Full navigation: drops every in-memory copy of the deleted data.
    window.location.assign(new URL("/", window.location.origin));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
          <Trash2 className="size-4" />
          Excluir conta
        </CardTitle>
        <CardDescription>
          Apaga definitivamente sua conta, todos os lançamentos, cartões, metas, pets e comprovantes. Não é possível desfazer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Excluir minha conta
        </Button>
      </CardContent>

      <AlertDialog open={open} onOpenChange={changeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sua conta para sempre?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os seus dados e comprovantes serão apagados dos nossos servidores e não poderão ser recuperados. Se quiser
              guardar uma cópia, cancele e use &quot;Exportar backup&quot; antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="delete-account-confirmation">
              Digite <strong className="font-semibold">{CONFIRMATION_WORD}</strong> para confirmar
            </Label>
            <Input
              id="delete-account-confirmation"
              autoComplete="off"
              value={confirmation}
              disabled={pending}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={!confirmed || pending} onClick={deleteAccount}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Excluir definitivamente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
