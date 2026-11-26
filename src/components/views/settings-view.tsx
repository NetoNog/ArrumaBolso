"use client";

import { Bell, BellRing, Check, CircleDot, Cloud, Download, Monitor, Moon, Palette, RotateCcw, Sparkles, Sun, Sunrise, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

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
import {
  ACCENT_PRESETS,
  THEME_TRANSITION_STYLES,
  useAccent,
  useThemeMode,
  useThemeTransitionStyle,
} from "@/components/app/theme-provider";
import { UserAvatar } from "@/components/common/user-avatar";
import { AvatarPicker, toAvatarChoice, type AvatarChoice } from "@/components/settings/avatar-picker";
import { CardsSettings } from "@/components/settings/cards-settings";
import { DeleteAccountCard } from "@/components/settings/delete-account-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { emptyState } from "@/lib/data/initial-state";
import { parseFinanceState } from "@/lib/data/repository";
import { updateSettings } from "@/lib/domain/operations";
import {
  getBrowserNotificationPermission,
  NOTIFICATION_CATEGORY_META,
  requestBrowserNotificationPermission,
  sendNativeNotification,
  useNotificationPrefs,
  type BrowserNotificationSupport,
  type DueLeadDays,
} from "@/lib/notifications";
import { useFinance } from "@/lib/store/finance-store";

const NICKNAME_MAX = 40;

export function SettingsView() {
  const { state, commit, replaceState, userEmail } = useFinance();
  const { accent, setAccent } = useAccent();
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const { transitionStyle, setTransitionStyle } = useThemeTransitionStyle();
  const { prefs: notifPrefs, updatePrefs: updateNotifPrefs } = useNotificationPrefs();
  const [browserPermission, setBrowserPermission] = useState<BrowserNotificationSupport>(() =>
    getBrowserNotificationPermission(),
  );
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
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Palette className="size-4 text-brand" />
            Aparência & cores
          </CardTitle>
          <CardDescription>Escolha o modo claro ou escuro e personalize a cor principal do sistema.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tema</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {(
                [
                  { id: "light", label: "Claro", desc: "Fundo suave e limpo", icon: Sun },
                  { id: "dark", label: "Escuro Navy", desc: "Tons profundos à noite", icon: Moon },
                  { id: "system", label: "Sistema (Auto)", desc: "Segue o aparelho", icon: Monitor },
                ] as const
              ).map((option) => {
                const Icon = option.icon;
                const active = themeMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={(event) => {
                      setThemeMode(
                        option.id,
                        event,
                        option.id === "light" || option.id === "dark"
                          ? () => commit((current) => updateSettings(current, { theme: option.id }))
                          : undefined,
                      );
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all active:scale-[0.99]",
                      active
                        ? "border-brand bg-brand-soft ring-1 ring-brand/30"
                        : "border-border bg-surface-subtle hover:border-brand/30",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        active ? "bg-brand text-white" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{option.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{option.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Cor de destaque</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {ACCENT_PRESETS.map((preset) => {
                const active = accent === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={active}
                    onClick={(event) => {
                      setAccent(preset.id, event, () => {
                        toast.success(`Cor alterada para ${preset.label}`);
                      });
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all active:scale-[0.98]",
                      active
                        ? "border-brand bg-brand-soft ring-1 ring-brand/30"
                        : "border-border bg-surface-subtle hover:border-brand/30",
                    )}
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-white shadow-xs"
                      style={{ backgroundColor: preset.swatch }}
                    >
                      {active ? <Check className="size-4 stroke-[2.5]" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-foreground">{preset.label}</span>
                      <span className="block truncate text-[10.5px] text-muted-foreground">{preset.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Animação da troca de tema</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {THEME_TRANSITION_STYLES.map((style) => {
                const active = transitionStyle === style.id;
                const Icon = style.id === "radial" ? CircleDot : style.id === "sunrise" ? Sunrise : Sparkles;
                return (
                  <button
                    key={style.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setTransitionStyle(style.id);
                      toast.success(`Transição alterada para ${style.label}`);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all active:scale-[0.99]",
                      active
                        ? "border-brand bg-brand-soft ring-1 ring-brand/30"
                        : "border-border bg-surface-subtle hover:border-brand/30",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        active ? "bg-brand text-white" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{style.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{style.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="notificacoes">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="size-4 text-brand" />
            Notificações & alertas
          </CardTitle>
          <CardDescription>
            Controle quais alertas aparecem na Central de Notificações e ative avisos nativos no dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {/* Native Device Notifications Opt-in */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-subtle p-3.5">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="tile-blue flex size-9 shrink-0 items-center justify-center rounded-xl">
                <BellRing className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Notificações no dispositivo (PWA)</p>
                <p className="text-xs text-muted-foreground">
                  {browserPermission === "unsupported"
                    ? "Este navegador não suporta notificações nativas."
                    : browserPermission === "denied"
                      ? "Bloqueadas nas permissões do navegador. Libere no cadeado da barra de endereço."
                      : notifPrefs.browserEnabled && browserPermission === "granted"
                        ? "Ativadas para alertas críticos (fatura vencendo, estouro de teto e saldo negativo)."
                        : "Receba avisos nativos do sistema quando houver alertas críticos no dia."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {notifPrefs.browserEnabled && browserPermission === "granted" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ok = await sendNativeNotification(
                      "ArrumaBolso • Teste de notificação",
                      "Suas notificações nativas estão funcionando perfeitamente!",
                      "/configuracoes#notificacoes",
                    );
                    if (ok) toast.success("Notificação de teste enviada");
                    else toast.error("Não foi possível exibir a notificação");
                  }}
                >
                  Testar
                </Button>
              ) : null}
              <Switch
                checked={notifPrefs.browserEnabled && browserPermission === "granted"}
                disabled={browserPermission === "unsupported" || browserPermission === "denied"}
                aria-label="Ativar notificações nativas no dispositivo"
                onCheckedChange={async (checked) => {
                  if (!checked) {
                    updateNotifPrefs((cur) => ({ ...cur, browserEnabled: false }));
                    return;
                  }
                  const perm = await requestBrowserNotificationPermission();
                  setBrowserPermission(perm);
                  if (perm === "granted") {
                    updateNotifPrefs((cur) => ({ ...cur, browserEnabled: true }));
                    toast.success("Notificações ativadas no dispositivo");
                  } else if (perm === "denied") {
                    toast.error("Permissão negada pelo navegador");
                  }
                }}
              />
            </div>
          </div>

          {/* Due Lead Days */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Antecedência de vencimentos</p>
              <p className="text-xs text-muted-foreground">Quantos dias antes avisar sobre faturas e assinaturas.</p>
            </div>
            <div className="inline-flex rounded-xl border border-border/80 bg-surface-subtle p-0.5">
              {([3, 5, 7] as DueLeadDays[]).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => updateNotifPrefs((cur) => ({ ...cur, dueLeadDays: days }))}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
                    notifPrefs.dueLeadDays === days
                      ? "bg-brand text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {days} dias
                </button>
              ))}
            </div>
          </div>

          {/* Granular Category Toggles */}
          <div className="grid gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Categorias de alertas</p>
            <div className="divide-y divide-border/70 rounded-xl border border-border/80 bg-surface-subtle">
              {NOTIFICATION_CATEGORY_META.map((cat) => (
                <div key={cat.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </div>
                  <Switch
                    checked={notifPrefs.categories[cat.key]}
                    aria-label={cat.label}
                    onCheckedChange={(checked) =>
                      updateNotifPrefs((cur) => ({
                        ...cur,
                        categories: { ...cur.categories, [cat.key]: checked },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {state.settings.dismissed_alerts.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-xs text-muted-foreground">
                Você tem <strong>{state.settings.dismissed_alerts.length}</strong> alerta(s) dispensado(s).
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  commit((current) => updateSettings(current, { dismissed_alerts: [] }));
                  toast.success("Todos os alertas dispensados foram restaurados");
                }}
              >
                <RotateCcw className="size-3.5" /> Restaurar dispensados
              </Button>
            </div>
          ) : null}
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

      <CardsSettings />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Cloud className="size-4 text-brand" />
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

      <DeleteAccountCard />

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
