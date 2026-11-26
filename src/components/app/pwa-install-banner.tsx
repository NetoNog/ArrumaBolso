"use client";

import { Download, Share, X } from "lucide-react";
import { cn } from "cn";

import { usePwaInstall } from "@/components/app/pwa-install-provider";
import { Button } from "@/components/ui/button";

/**
 * Native-style banner inviting the user to install ArrumaBolso as a PWA:
 * - Android & Desktop (Chrome/Edge over HTTPS or localhost): 1-tap native install dialog.
 * - iPhone & iPad (Safari): clickable banner opening an interactive 2-step Bottom Sheet.
 */
export function PwaInstallBanner() {
  const { installed, canPromptNative, isIos, dismissed, dismiss, triggerInstall } = usePwaInstall();

  if (dismissed || installed) return null;
  if (!canPromptNative && !isIos) return null;

  return (
    <div
      className={cn(
        "mx-4 mt-2 flex items-center gap-3 rounded-2xl border border-brand/25 bg-card px-3.5 py-2.5 shadow-panel sm:mx-6 lg:mx-8",
        !canPromptNative && "lg:hidden",
      )}
    >
      <button
        type="button"
        onClick={() => void triggerInstall()}
        className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity active:opacity-80"
      >
        <span className="tile-blue flex size-9 shrink-0 items-center justify-center rounded-xl">
          {canPromptNative ? <Download className="size-4" /> : <Share className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">Instalar ArrumaBolso como App</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {canPromptNative
              ? "Instalação rápida em 1 toque na tela inicial"
              : "Toque para ver como adicionar no iPhone/iPad"}
          </p>
        </div>
      </button>

      <Button
        size="sm"
        variant={canPromptNative ? "default" : "secondary"}
        onClick={() => void triggerInstall()}
        className={cn(
          "h-8 shrink-0 rounded-xl px-3 text-xs",
          canPromptNative
            ? "bg-brand text-white hover:bg-brand/90"
            : "bg-brand-soft text-brand hover:bg-brand/15",
        )}
      >
        {canPromptNative ? "Instalar" : "Ver passos"}
      </Button>

      <button
        type="button"
        aria-label="Fechar aviso de instalação"
        onClick={dismiss}
        className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
