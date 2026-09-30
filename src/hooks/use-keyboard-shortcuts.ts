'use client';

import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  onOpenCommandPalette?: () => void;
  onOpenNewTransaction?: () => void;
  onTogglePrivacy?: () => void;
}

export function useKeyboardShortcuts({
  onOpenCommandPalette,
  onOpenNewTransaction,
  onTogglePrivacy,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.getAttribute('contenteditable') === 'true';

      // Ctrl+K ou Cmd+K: Command Palette (funciona mesmo dentro de inputs)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommandPalette?.();
        return;
      }

      // Se estiver digitando em um input, ignora atalhos de letra única
      if (isInput) return;

      // Tecla 'N': Nova Transação
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onOpenNewTransaction?.();
        return;
      }

      // Tecla 'P' ou Alt+P: Alternar Modo Privacidade
      if ((e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey) || (e.altKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        onTogglePrivacy?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenCommandPalette, onOpenNewTransaction, onTogglePrivacy]);
}
