"use client";

import { Cloud, Download, LogOut, Palette, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
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
import { emptyState } from "@/lib/data/initial-state";
import { parseFinanceState } from "@/lib/data/repository";
import { updateSettings } from "@/lib/domain/operations";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useFinance } from "@/lib/store/finance-store";

export function SettingsView() {
  const { state, commit, replaceState, userEmail } = useFinance();
  const [name, setName] = useState(state.settings.display_name);
  const [closingDay, setClosingDay] = useState(String(state.settings.closing_day));
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function saveProfile() {
    const day = Number(closingDay);
    if (!name.trim()) return toast.error("Informe um nome");
    if (!Number.isInteger(day) || day < 1 || day > 28) return toast.error("Dia de fechamento entre 1 e 28");
    commit((current) => updateSettings(current, { display_name: name.trim(), closing_day: day }));
    toast.success("Preferências salvas");
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arrumabolso-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = parseFinanceState(JSON.parse(await file.text()));
      if (!parsed) {
        toast.error("Backup inválido", { description: "O arquivo não tem a estrutura esperada." });
        return;
      }
      replaceState(parsed);
      toast.success("Backup restaurado", { description: `${parsed.transactions.length} lançamentos carregados.` });
    } catch {
      toast.error("Não foi possível ler o arquivo JSON");
    }
  }

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) {
      toast.error("Falha ao sair", { description: error.message });
      return;
    }
    window.location.assign(new URL("/login", window.location.origin));
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Perfil e ciclo da fatura</CardTitle>
          <CardDescription>Compras feitas a partir do dia de fechamento entram na fatura do mês seguinte.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="display-name">Nome exibido</Label>
            <Input id="display-name" className="w-full sm:w-60" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="closing-day">Dia de fechamento</Label>
            <Input id="closing-day" type="number" inputMode="numeric" min={1} max={28} className="num w-28" value={closingDay} onChange={(event) => setClosingDay(event.target.value)} />
          </div>
          <Button onClick={saveProfile}>Salvar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Cloud className="size-4 text-blue-600" />
            Conta
          </CardTitle>
          <CardDescription>Conectado como {userEmail ?? "usuário"}. Seus dados ficam isolados por Row Level Security.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={signOut}>
            <LogOut /> Sair
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Marca</CardTitle>
          <CardDescription>Logo, cores, tipografia e regras de uso do ArrumaBolso.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/marca" />}>
            <Palette /> Identidade visual
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Backup e dados</CardTitle>
          <CardDescription>Exporte tudo em JSON, restaure um backup ou recomece.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportBackup}>
            <Download /> Exportar backup
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload /> Restaurar backup
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={importBackup} />
          <Button variant="destructive" onClick={() => setConfirmReset(true)}>
            Começar do zero
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar todos os dados?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os lançamentos, categorias, regras e histórico atuais serão substituídos. Exporte um backup antes se quiser guardar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                replaceState({ ...emptyState(), settings: { ...state.settings, dismissed_alerts: [] } });
                toast.success("Dados apagados");
                setConfirmReset(false);
              }}
            >
              Confirmar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
