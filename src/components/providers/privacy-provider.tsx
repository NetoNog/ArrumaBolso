'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/financial/formatters';
import { applyThemeAccent, THEME_ACCENTS } from '@/lib/theme/accents';

interface PrivacyContextType {
  // Olho Mágico / Privacidade
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  setPrivacyMode: (val: boolean) => void;
  defaultPrivacy: boolean;
  setDefaultPrivacy: (val: boolean) => void;

  // Formatação de Valores
  formatMoney: (amount: number | string | undefined | null) => string;
  hideCents: boolean;
  setHideCents: (val: boolean) => void;

  // Personalização de Cores / Tema
  themeAccent: string;
  setThemeAccent: (val: string) => void;

  // Metas & Alertas
  spendingAlertThreshold: number;
  setSpendingAlertThreshold: (val: number) => void;
}

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivacyMode: false,
  togglePrivacyMode: () => {},
  setPrivacyMode: () => {},
  defaultPrivacy: false,
  setDefaultPrivacy: () => {},
  formatMoney: () => 'R$ 0,00',
  hideCents: false,
  setHideCents: () => {},
  themeAccent: 'emerald',
  setThemeAccent: () => {},
  spendingAlertThreshold: 80,
  setSpendingAlertThreshold: () => {},
});

const PRIVACY_STORAGE_KEY = 'arrumabolso_privacy_mode';
const THEME_ACCENT_KEY = 'gf_theme_accent';
const HIDE_CENTS_KEY = 'gf_hide_cents';
const DEFAULT_PRIVACY_KEY = 'gf_default_privacy';
const SPENDING_ALERT_KEY = 'gf_spending_alert_threshold';

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [defaultPrivacy, setDefaultPrivacyState] = useState(false);
  const [hideCents, setHideCentsState] = useState(false);
  const [themeAccent, setThemeAccentState] = useState('emerald');
  const [spendingAlertThreshold, setSpendingAlertThresholdState] = useState(80);
  const [mounted, setMounted] = useState(false);

  // Carrega preferências salvas no navegador pós-hidratação
  useEffect(() => {
    try {
      // 1. Cor de Destaque
      const savedAccent = localStorage.getItem(THEME_ACCENT_KEY) || 'emerald';
      setThemeAccentState(savedAccent);
      applyThemeAccent(savedAccent);

      // 2. Centavos
      const savedHideCents = localStorage.getItem(HIDE_CENTS_KEY);
      if (savedHideCents === 'true') {
        setHideCentsState(true);
      }

      // 3. Olho Mágico Padrão
      const savedDefaultPrivacy = localStorage.getItem(DEFAULT_PRIVACY_KEY);
      const isDefPrivacy = savedDefaultPrivacy === 'true';
      setDefaultPrivacyState(isDefPrivacy);

      // Se a preferência padrão for ocultar, inicia com privacidade ativa
      if (isDefPrivacy) {
        setIsPrivacyMode(true);
      } else {
        const savedSessionPrivacy = localStorage.getItem(PRIVACY_STORAGE_KEY);
        if (savedSessionPrivacy === 'true') {
          setIsPrivacyMode(true);
        }
      }

      // 4. Alerta de Teto de Gastos (% da renda)
      const savedAlert = localStorage.getItem(SPENDING_ALERT_KEY);
      if (savedAlert) {
        const parsed = parseInt(savedAlert, 10);
        if (!isNaN(parsed) && parsed >= 40 && parsed <= 100) {
          setSpendingAlertThresholdState(parsed);
        }
      }
    } catch {
      // Ignora erros de localStorage
    }
    setMounted(true);
  }, []);

  const togglePrivacyMode = () => {
    setIsPrivacyMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem(PRIVACY_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  };

  const setPrivacyMode = (val: boolean) => {
    setIsPrivacyMode(val);
    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, String(val));
    } catch {}
  };

  const setDefaultPrivacy = (val: boolean) => {
    setDefaultPrivacyState(val);
    try {
      localStorage.setItem(DEFAULT_PRIVACY_KEY, String(val));
    } catch {}
  };

  const setHideCents = (val: boolean) => {
    setHideCentsState(val);
    try {
      localStorage.setItem(HIDE_CENTS_KEY, String(val));
    } catch {}
  };

  const setThemeAccent = (val: string) => {
    setThemeAccentState(val);
    applyThemeAccent(val);
    try {
      localStorage.setItem(THEME_ACCENT_KEY, val);
    } catch {}
  };

  const setSpendingAlertThreshold = (val: number) => {
    setSpendingAlertThresholdState(val);
    try {
      localStorage.setItem(SPENDING_ALERT_KEY, String(val));
    } catch {}
  };

  const formatMoney = (amount: number | string | undefined | null): string => {
    if (mounted && isPrivacyMode) {
      return 'R$ ••••••';
    }
    return formatCurrency(amount, { hideCents: mounted ? hideCents : false });
  };

  return (
    <PrivacyContext.Provider
      value={{
        isPrivacyMode: mounted ? isPrivacyMode : false,
        togglePrivacyMode,
        setPrivacyMode,
        defaultPrivacy,
        setDefaultPrivacy,
        formatMoney,
        hideCents,
        setHideCents,
        themeAccent,
        setThemeAccent,
        spendingAlertThreshold,
        setSpendingAlertThreshold,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
}

export function usePreferences() {
  return usePrivacy();
}
