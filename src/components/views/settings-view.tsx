"use client";

import { Cloud, Download, HardDrive, LogIn, LogOut, Palette, RotateCcw, Upload } from "lucide-react";
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
import { emptyState } from "@/lib/data/seed";
import { parseFinanceState } from "@/lib/data/repository";
import { updateSettings } from "@/lib/domain/operations";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useFinance } from "@/lib/store/finance-store";

type Confirm = "seed" | "empty" | null;

export function SettingsView() {
  const { state, commit, replaceState, resetToSeed, storageKind, userEmail } = useFinance();
  const [name, setName] = useState(state.settings.display_name);
  const [closingDay, setClosingDay] = useState(String(state.settings.closing_day));
  const [confirm, setConfirm] = useState<Confirm>(null);
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
    window.location.assign(new URL("/", window.location.origin));
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
            <Input id="display-name" className="w-60" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="closing-day">Dia de fechamento</Label>
            <Input id="closing-day" type="number" min={1} max={28} className="num w-28" value={closingDay} onChange={(event) => setClosingDay(event.target.value)} />
          </div>
          <Button onClick={saveProfile}>Salvar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            {storageKind === "supabase" ? <Cloud className="size-4 text-blue-600" /> : <HardDrive className="size-4 text-muted-foreground" />}
            Armazenamento: {storageKind === "supabase" ? "Supabase (nuvem)" : "Local (este navegador)"}
          </CardTitle>
          <CardDescription>
            {storageKind === "supabase"
              ? `Conectado como ${userEmail ?? "usuário"}. Dados isolados por RLS.`
              : isSupabaseConfigured()
                ? "Supabase configurado. Entre para sincronizar seus dados na nuvem."
                : "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para habilitar a nuvem."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {storageKind === "supabase" ? (
            <Button variant="outline" onClick={signOut}>
              <LogOut /> Sair
            </Button>
          ) : isSupabaseConfigured() ? (
            <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
              <Cloud /> Entrar / criar conta
            </Button>
          ) : null}
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
          <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
            <LogIn /> Tela de login
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
          <Button variant="outline" onClick={() => setConfirm("seed")}>
            <RotateCcw /> Recarregar dados de exemplo
          </Button>
          <Button variant="destructive" onClick={() => setConfirm("empty")}>
            Começar do zero
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "seed" ? "Recarregar dados de exemplo?" : "Apagar todos os dados?"}</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os lançamentos, categorias, regras e histórico atuais serão substituídos. Exporte um backup antes se quiser guardar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={async () => {
                if (confirm === "seed") await resetToSeed();
                else replaceState({ ...emptyState(), settings: { ...state.settings, dismissed_alerts: [] } });
                toast.success(confirm === "seed" ? "Dados de exemplo carregados" : "Dados apagados");
                setConfirm(null);
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
