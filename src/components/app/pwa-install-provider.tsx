"use client";

import { CheckCircle2, MoreVertical, PlusSquare, Share, Smartphone, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const DISMISS_KEY = "arrumabolso.pwa.dismissed";
const dismissListeners = new Set<() => void>();

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaEnv {
  standalone: boolean;
  ios: boolean;
  secureContext: boolean;
}

const SERVER_ENV: PwaEnv = { standalone: true, ios: false, secureContext: false };
const CLIENT_ENV_CACHE: { current: PwaEnv | null } = { current: null };

function detectClientEnv(): PwaEnv {
  if (typeof window === "undefined") return SERVER_ENV;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  const ua = window.navigator.userAgent;
  const ios =
    /iphone|ipad|ipod/i.test(ua) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  return { standalone, ios, secureContext: window.isSecureContext };
}

function getClientEnv(): PwaEnv {
  CLIENT_ENV_CACHE.current ??= detectClientEnv();
  return CLIENT_ENV_CACHE.current;
}

function subscribeDismiss(callback: () => void) {
  dismissListeners.add(callback);
  return () => {
    dismissListeners.delete(callback);
  };
}

function getDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Ignore storage errors (private browsing).
  }
  for (const cb of dismissListeners) cb();
}

interface PwaInstallContextValue {
  installed: boolean;
  canPromptNative: boolean;
  isIos: boolean;
  dismissed: boolean;
  dismiss: () => void;
  triggerInstall: () => Promise<void>;
}

const PwaInstallContext = createContext<PwaInstallContextValue>({
  installed: true,
  canPromptNative: false,
  isIos: false,
  dismissed: true,
  dismiss: () => {},
  triggerInstall: async () => {},
});

/**
 * Registers the lightweight Service Worker, captures Chrome/Edge/Android's
 * `beforeinstallprompt` for 1-tap installation, and provides an interactive
 * visual install sheet for iOS Safari (and browsers without native prompt).
 */
export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const dismissed = useSyncExternalStore(subscribeDismiss, getDismissed, () => true);
  const env = useSyncExternalStore(
    () => () => {},
    getClientEnv,
    () => SERVER_ENV,
  );
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Non-fatal: app still works normally without SW.
        });
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function onAppInstalled() {
      setJustInstalled(true);
      setDeferredPrompt(null);
      markDismissed();
      toast.success("ArrumaBolso instalado!", {
        description: "Agora você pode abrir direto da tela inicial.",
      });
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const installed = env.standalone || justInstalled;
  const canPromptNative = Boolean(deferredPrompt) && !installed;

  const triggerInstall = useCallback(async () => {
    if (installed) return;
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setJustInstalled(true);
        markDismissed();
      }
      setDeferredPrompt(null);
      return;
    }
    setGuideOpen(true);
  }, [deferredPrompt, installed]);

  const value = useMemo<PwaInstallContextValue>(
    () => ({
      installed,
      canPromptNative,
      isIos: env.ios,
      dismissed,
      dismiss: markDismissed,
      triggerInstall,
    }),
    [installed, canPromptNative, env.ios, dismissed, triggerInstall],
  );

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
      <InstallGuideSheet
        open={guideOpen}
        onOpenChange={setGuideOpen}
        isIos={env.ios}
        secureContext={env.secureContext}
      />
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall(): PwaInstallContextValue {
  return useContext(PwaInstallContext);
}

function InstallGuideSheet({
  open,
  onOpenChange,
  isIos,
  secureContext,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isIos: boolean;
  secureContext: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto max-w-lg gap-4 rounded-t-[28px] border-t-0 bg-background px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl"
      >
        <SheetTitle className="sr-only">Instalar ArrumaBolso como App</SheetTitle>

        <div className="relative flex items-center justify-center pb-1">
          <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar guia de instalação"
            className="absolute right-0 flex size-8 items-center justify-center rounded-full bg-card text-muted-foreground shadow-panel transition-transform active:scale-90"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* App Identity Header */}
        <div className="flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/icon-192.png"
            alt="Ícone ArrumaBolso"
            width={52}
            height={52}
            className="size-[52px] shrink-0 rounded-2xl shadow-md"
          />
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-foreground">Instalar ArrumaBolso</h2>
            <p className="text-xs text-muted-foreground">
              {isIos
                ? "Adicione à tela inicial do iPhone ou iPad em 2 toques"
                : "Adicione o aplicativo à tela inicial do seu aparelho"}
            </p>
          </div>
        </div>

        {isIos ? (
          <ol className="grid gap-2.5">
            <li className="fintech-mobile-card flex items-center gap-3.5 p-3.5">
              <span className="tile-blue flex size-10 shrink-0 items-center justify-center rounded-2xl">
                <Share className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-brand">PASSO 1</p>
                <p className="text-sm font-medium text-foreground">
                  Toque em <strong>Compartilhar</strong> na barra inferior do Safari
                </p>
              </div>
            </li>
            <li className="fintech-mobile-card flex items-center gap-3.5 p-3.5">
              <span className="tile-emerald flex size-10 shrink-0 items-center justify-center rounded-2xl">
                <PlusSquare className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-positive">PASSO 2</p>
                <p className="text-sm font-medium text-foreground">
                  Role para baixo e toque em <strong>Adicionar à Tela de Início</strong> e depois em{" "}
                  <strong>Adicionar</strong>
                </p>
              </div>
            </li>
          </ol>
        ) : (
          <ol className="grid gap-2.5">
            <li className="fintech-mobile-card flex items-center gap-3.5 p-3.5">
              <span className="tile-blue flex size-10 shrink-0 items-center justify-center rounded-2xl">
                <MoreVertical className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-brand">PASSO 1</p>
                <p className="text-sm font-medium text-foreground">
                  Abra o menu do navegador (<strong>⋮</strong> no canto superior direito)
                </p>
              </div>
            </li>
            <li className="fintech-mobile-card flex items-center gap-3.5 p-3.5">
              <span className="tile-emerald flex size-10 shrink-0 items-center justify-center rounded-2xl">
                <Smartphone className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-positive">PASSO 2</p>
                <p className="text-sm font-medium text-foreground">
                  Toque em <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>
                </p>
              </div>
            </li>
            {!secureContext ? (
              <li className="rounded-2xl border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-xs text-warning">
                Você está em rede local HTTP. Na versão publicada em <strong>HTTPS</strong>, o botão dispara a
                instalação automática em 1 toque.
              </li>
            ) : null}
          </ol>
        )}

        <div className="flex items-center gap-2 rounded-2xl border border-border/75 bg-surface-subtle px-3.5 py-2.5 text-xs text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-positive" />
          <span>Abre em tela cheia, sem barra de endereço e com ícone próprio.</span>
        </div>

        <Button onClick={() => onOpenChange(false)} className="h-11 w-full rounded-2xl bg-brand text-white hover:bg-brand/90">
          Entendi
        </Button>
      </SheetContent>
    </Sheet>
  );
}

