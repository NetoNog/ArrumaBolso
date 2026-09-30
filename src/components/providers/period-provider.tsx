'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { format, addMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTransactions } from '@/hooks/use-financial';

export interface MonthOption {
  key: string; // formato "yyyy-MM"
  label: string; // formato "Setembro 2026"
  shortLabel: string; // formato "Set/26"
  type: 'past' | 'current' | 'future';
  tag: string; // "Atual", "Salvo (X)", "Parcelas (Y)"
  transactionsCount: number;
  installmentsCount: number;
}

interface PeriodContextType {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  currentActualMonth: string;
  isCurrentMonth: boolean;
  isPastMonth: boolean;
  isFutureMonth: boolean;
  availableMonths: MonthOption[];
  canGoPrevious: boolean;
  canGoNext: boolean;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
}

const PeriodContext = createContext<PeriodContextType | undefined>(undefined);

const STORAGE_KEY = 'gf_selected_month_v1';

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const { data: transactions = [] } = useTransactions();
  const currentActualMonth = useMemo(() => format(new Date(), 'yyyy-MM'), []);

  // Estado inicial do mês selecionado com persistência no localStorage
  const [selectedMonth, setSelectedMonthState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && /^\d{4}-\d{2}$/.test(saved)) {
        return saved;
      }
    }
    return format(new Date(), 'yyyy-MM');
  });

  const setSelectedMonth = useCallback((month: string) => {
    setSelectedMonthState(month);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, month);
    }
  }, []);

  // =========================================================================
  // SISTEMA AUTOMÁTICO DE MESES:
  // 1. Mês Atual: sempre presente.
  // 2. Meses Passados: apenas os que possuem transações salvas.
  // 3. Meses Futuros: apenas até onde houver parcelas de cartão de crédito.
  // =========================================================================
  const availableMonths = useMemo(() => {
    const pastMonthsMap = new Map<string, number>();
    const futureMonthsMap = new Map<string, { txCount: number; installmentsCount: number }>();

    // 1. Analisa todas as transações cadastradas
    transactions.forEach((t) => {
      if (!t.date || t.date.length < 7) return;
      const mKey = t.date.substring(0, 7);

      if (mKey < currentActualMonth) {
        pastMonthsMap.set(mKey, (pastMonthsMap.get(mKey) || 0) + 1);
      } else if (mKey > currentActualMonth) {
        const existing = futureMonthsMap.get(mKey) || { txCount: 0, installmentsCount: 0 };
        existing.txCount += 1;
        if (t.installment_total && t.installment_total > 1) {
          existing.installmentsCount += 1;
        }
        futureMonthsMap.set(mKey, existing);
      }
    });

    // 2. Detecta projeção de compras parceladas de cartão que se estendem para meses futuros
    transactions.forEach((t) => {
      const isCardInstallment = 
        t.type === 'expense' && 
        typeof t.installment_total === 'number' &&
        t.installment_total > 1 &&
        typeof t.installment_current === 'number' &&
        t.installment_total > t.installment_current;

      if (isCardInstallment && typeof t.installment_current === 'number' && typeof t.installment_total === 'number') {
        const remaining = t.installment_total - t.installment_current;
        const startDate = parseISO(t.date);

        for (let i = 1; i <= remaining; i++) {
          const futureKey = format(addMonths(startDate, i), 'yyyy-MM');
          if (futureKey > currentActualMonth) {
            const existing = futureMonthsMap.get(futureKey) || { txCount: 0, installmentsCount: 0 };
            existing.installmentsCount += 1;
            futureMonthsMap.set(futureKey, existing);
          }
        }
      }
    });

    // 3. Monta lista final de chaves de meses
    const keysSet = new Set<string>();

    // O mês atual sempre existe
    keysSet.add(currentActualMonth);

    // Apenas meses passados com dados salvos
    pastMonthsMap.forEach((_, key) => {
      keysSet.add(key);
    });

    // Apenas meses futuros com parcelas ou lançamentos
    futureMonthsMap.forEach((info, key) => {
      if (info.installmentsCount > 0 || info.txCount > 0) {
        keysSet.add(key);
      }
    });

    // Se o mês atualmente selecionado não estiver na lista (ex: importação manual), garante que fique visível
    if (selectedMonth) {
      keysSet.add(selectedMonth);
    }

    // Ordenar decrescente: meses futuros primeiro, mês atual, meses passados por último
    const sorted = Array.from(keysSet).sort((a, b) => b.localeCompare(a));

    return sorted.map((key) => {
      const [y, m] = key.split('-').map(Number);
      const dateObj = new Date(y, m - 1, 1);
      const raw = format(dateObj, 'MMMM yyyy', { locale: ptBR });
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const shortLabel = format(dateObj, 'MMM/yy', { locale: ptBR });

      const isCurrent = key === currentActualMonth;
      const isFuture = key > currentActualMonth;
      const isPast = key < currentActualMonth;

      let type: 'past' | 'current' | 'future' = 'current';
      let tag = 'Mês Atual';

      if (isPast) {
        type = 'past';
        const count = pastMonthsMap.get(key) || 0;
        tag = count > 0 ? `${count} lançamentos` : 'Histórico';
      } else if (isFuture) {
        type = 'future';
        const info = futureMonthsMap.get(key);
        const instCount = info?.installmentsCount || 0;
        tag = instCount > 0 ? `${instCount} parcela${instCount > 1 ? 's' : ''}` : 'Fatura Futura';
      }

      return {
        key,
        label,
        shortLabel,
        type,
        tag,
        transactionsCount: isPast ? (pastMonthsMap.get(key) || 0) : (futureMonthsMap.get(key)?.txCount || 0),
        installmentsCount: futureMonthsMap.get(key)?.installmentsCount || 0
      };
    });
  }, [transactions, currentActualMonth, selectedMonth]);

  // Se o mês selecionado não existir na lista de opções válidas, ajusta para o mês atual
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.some(m => m.key === selectedMonth)) {
      setSelectedMonth(currentActualMonth);
    }
  }, [availableMonths, selectedMonth, currentActualMonth, setSelectedMonth]);

  // Índices para navegação (< e >)
  // Como a lista está ordenada DECRESCENTE (ex: ['2026-11', '2026-10', '2026-09', '2026-08']):
  // - Ir para mês anterior = descer na lista (índice aumenta)
  // - Ir para próximo mês = subir na lista (índice diminui)
  const currentIndex = useMemo(() => {
    return availableMonths.findIndex(m => m.key === selectedMonth);
  }, [availableMonths, selectedMonth]);

  const canGoPrevious = currentIndex >= 0 && currentIndex < availableMonths.length - 1;
  const canGoNext = currentIndex > 0;

  const goToPreviousMonth = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentIndex + 1].key);
    }
  }, [currentIndex, availableMonths, setSelectedMonth]);

  const goToNextMonth = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedMonth(availableMonths[currentIndex - 1].key);
    }
  }, [currentIndex, availableMonths, setSelectedMonth]);

  const goToCurrentMonth = useCallback(() => {
    setSelectedMonth(currentActualMonth);
  }, [currentActualMonth, setSelectedMonth]);

  const isCurrentMonth = selectedMonth === currentActualMonth;
  const isPastMonth = selectedMonth < currentActualMonth;
  const isFutureMonth = selectedMonth > currentActualMonth;

  const value = {
    selectedMonth,
    setSelectedMonth,
    currentActualMonth,
    isCurrentMonth,
    isPastMonth,
    isFutureMonth,
    availableMonths,
    canGoPrevious,
    canGoNext,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
  };

  return (
    <PeriodContext.Provider value={value}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod() {
  const context = useContext(PeriodContext);
  if (!context) {
    throw new Error('usePeriod deve ser utilizado dentro de um PeriodProvider.');
  }
  return context;
}
