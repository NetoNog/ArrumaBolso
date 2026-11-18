"use client";

import { Cloud, Download, Upload } from "lucide-react";
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
import { SignOutButton } from "@/components/app/sign-out-button";
import { UserAvatar } from "@/components/common/user-avatar";
import { AvatarPicker, toAvatarChoice, type AvatarChoice } from "@/components/settings/avatar-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyState } from "@/lib/data/initial-state";
import { parseFinanceState } from "@/lib/data/repository";
import { updateSettings } from "@/lib/domain/operations";
import { useFinance } from "@/lib/store/finance-store";

const NICKNAME_MAX = 40;

export function SettingsView() {
  const { state, commit, replaceState, userEmail } = useFinance();
  const [name, setName] = useState(state.settings.display_name);
  const [avatar, setAvatar] = useState<AvatarChoice | null>(() =>
    toAvatarChoice(state.settings.avatar_style, state.settings.avatar_seed),
  );
  const [closingDay, setClosingDay] = useState(String(state.settings.closing_day));
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function saveProfile() {
    const nickname = name.trim();
    if (!nickname) return toast.error("Informe um apelido");
    if (nickname.length > NICKNAME_MAX) return toast.error(`O apelido pode ter até ${NICKNAME_MAX} caracteres`);
    commit((current) =>
      updateSettings(current, { display_name: nickname, avatar_style: avatar?.style ?? null, avatar_seed: avatar?.seed ?? null }),
    );
    toast.success("Perfil atualizado");
  }

  function saveCycle() {
    const day = Number(closingDay);
    if (!Number.isInteger(day) || day < 1 || day > 28) return toast.error("Dia de fechamento entre 1 e 28");
    commit((current) => updateSettings(current, { closing_day: day }));
    toast.success("Ciclo da fatura salvo");
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

  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Perfil</CardTitle>
          <CardDescription>Como você aparece no ArrumaBolso. Os avatares são gerados pelo DiceBear.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex items-center gap-4">
            <UserAvatar name={name || "?"} style={avatar?.style ?? null} seed={avatar?.seed ?? null} size={72} />
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Label htmlFor="nickname">Apelido</Label>
              <Input
                id="nickname"
                className="w-full sm:w-72"
                maxLength={NICKNAME_MAX}
                autoComplete="nickname"
                placeholder="Como quer ser chamado?"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Foto de perfil</p>
            <AvatarPicker name={name} value={avatar} onChange={setAvatar} />
          </div>
          <Button className="justify-self-start" onClick={saveProfile}>
            Salvar perfil
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Ciclo da fatura</CardTitle>
          <CardDescription>Compras feitas a partir do dia de fechamento entram na fatura do mês seguinte.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="closing-day">Dia de fechamento</Label>
            <Input id="closing-day" type="number" inputMode="numeric" min={1} max={28} className="num w-28" value={closingDay} onChange={(event) => setClosingDay(event.target.value)} />
          </div>
          <Button onClick={saveCycle}>Salvar</Button>
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
          <SignOutButton />
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
