'use client';

import React, { useState, useEffect } from 'react';
import { ParsedNubankItem } from '@/lib/parsers/nubank-parser';
import { Category, AccountAndCard } from '@/lib/supabase/types';
import { formatCurrency, formatDateBR } from '@/lib/financial/formatters';
import { 
  CheckSquare, 
  Square, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  ArrowRightLeft, 
  Tag, 
  Wallet,
  Save
} from 'lucide-react';
import { toast } from 'sonner';

interface ImportPreviewTableProps {
  items: ParsedNubankItem[];
  categories: Category[];
  accounts: AccountAndCard[];
  onConfirmImport: (selectedItems: ParsedNubankItem[], targetAccountId: string) => Promise<void>;
  onCancel: () => void;
}

export function ImportPreviewTable({
  items: initialItems,
  categories,
  accounts,
  onConfirmImport,
  onCancel
}: ImportPreviewTableProps) {
  const [items, setItems] = useState<ParsedNubankItem[]>(initialItems);
  const [targetAccountId, setTargetAccountId] = useState<string>(() => {
    if (accounts.length > 0) {
      const isCredit = initialItems.some(i => i.isInstallment || i.type === 'expense');
      const defaultAcc = isCredit 
        ? accounts.find(a => a.type === 'credit_card' || a.name.toLowerCase().includes('cartão')) || accounts[0]
        : accounts.find(a => a.type === 'checking' || a.name.toLowerCase().includes('conta')) || accounts[0];
      return defaultAcc?.id || accounts[0]?.id || '';
    }
    return '';
  });
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sincroniza a conta de destino assim que a lista de contas for carregada
  useEffect(() => {
    if (accounts.length > 0) {
      const isValid = accounts.some(a => a.id === targetAccountId);
      if (!isValid) {
        const isCredit = initialItems.some(i => i.isInstallment || i.type === 'expense');
        const defaultAcc = isCredit 
          ? accounts.find(a => a.type === 'credit_card' || a.name.toLowerCase().includes('cartão')) || accounts[0]
          : accounts.find(a => a.type === 'checking' || a.name.toLowerCase().includes('conta')) || accounts[0];
        if (defaultAcc?.id) {
          setTargetAccountId(defaultAcc.id);
        }
      }
    }
  }, [accounts, initialItems, targetAccountId]);

  const selectedCount = items.filter(it => it.selected).length;
  const duplicateCount = items.filter(it => it.isDuplicate).length;

  const toggleSelectAll = (select: boolean) => {
    setItems(items.map(it => ({ ...it, selected: select })));
  };

  const toggleItem = (id: string) => {
    setItems(items.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  };

  const handleCategoryChange = (id: string, newCategory: string) => {
    setItems(items.map(it => it.id === id ? { ...it, categoryName: newCategory } : it));
  };

  const applyBulkCategory = () => {
    if (!bulkCategory) {
      toast.error('Escolha uma categoria para aplicar em lote.');
      return;
    }
    const updated = items.map(it => it.selected ? { ...it, categoryName: bulkCategory } : it);
    setItems(updated);
    toast.success(`Categoria atualizada para ${selectedCount} itens selecionados!`);
  };

  const handleConfirm = async () => {
    if (selectedCount === 0) {
      toast.error('Selecione pelo menos uma transação para importar.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirmImport(items.filter(it => it.selected), targetAccountId);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar transações.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="p-3.5 rounded-xl bg-card border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Selection Stats */}
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Encontrados:</span>{' '}
            <strong className="text-foreground text-sm tabular-nums">{items.length}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Selecionados:</span>{' '}
            <strong className="text-primary text-sm tabular-nums">{selectedCount}</strong>
          </div>
          {duplicateCount > 0 && (
            <div className="flex items-center gap-1 text-amber-500">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{duplicateCount} possível(is) duplicada(s)</span>
            </div>
          )}
        </div>

        {/* Bulk Category Editor & Account Selection */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={targetAccountId}
              onChange={(e) => setTargetAccountId(e.target.value)}
              className="bg-secondary/50 text-foreground text-xs rounded-lg px-2.5 py-1.5 border border-border focus:outline-none"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  Conta: {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="bg-secondary/50 text-foreground text-xs rounded-lg px-2.5 py-1.5 border border-border focus:outline-none max-w-[150px]"
            >
              <option value="">Aplicar em lote...</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            <button
              onClick={applyBulkCategory}
              disabled={selectedCount === 0 || !bulkCategory}
              className="px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground border border-border disabled:opacity-50 transition-colors"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>

      {/* Select buttons and controls */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleSelectAll(true)}
            className="text-primary hover:underline font-medium"
          >
            Selecionar Todos ({items.length})
          </button>
          <span className="text-muted-foreground">&middot;</span>
          <button
            onClick={() => toggleSelectAll(false)}
            className="text-muted-foreground hover:text-foreground font-medium"
          >
            Desmarcar Todos
          </button>
          <span className="text-muted-foreground">&middot;</span>
          <button
            onClick={() => setItems(items.map(it => ({ ...it, selected: !it.isDuplicate })))}
            className="text-emerald-500 hover:underline font-medium"
          >
            Apenas Novos (ignorar duplicatas)
          </button>
        </div>

        <div className="text-muted-foreground text-[11px]">
          Conferência antes da importação
        </div>
      </div>

      {/* Preview Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 text-muted-foreground font-medium sticky top-0 z-10 backdrop-blur-sm border-b border-border text-[11px]">
              <tr>
                <th className="p-3 w-10">
                  <button
                    onClick={() => toggleSelectAll(selectedCount !== items.length)}
                    aria-label="Toggle all"
                  >
                    {selectedCount === items.length ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </th>
                <th className="p-3">Status</th>
                <th className="p-3">Data</th>
                <th className="p-3">Descrição Normalizada</th>
                <th className="p-3">Parcela</th>
                <th className="p-3">Categoria Preditiva</th>
                <th className="p-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr 
                  key={item.id} 
                  className={`hover:bg-secondary/20 transition-colors ${item.selected ? 'bg-primary/5' : 'opacity-60'}`}
                >
                  <td className="p-3">
                    <button onClick={() => toggleItem(item.id)} aria-label="Toggle row">
                      {item.selected ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </td>

                  <td className="p-3 whitespace-nowrap">
                    {item.isDuplicate ? (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = items.map(it => it.id === item.id ? { ...it, selected: !it.selected, forceImport: !it.selected } : it);
                          setItems(updated);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${
                          item.selected 
                            ? 'bg-primary/10 text-primary border-primary/20' 
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                        }`}
                        title="Clique para alternar entre ignorar e forçar a importação"
                      >
                        <AlertCircle className="w-3 h-3" />
                        {item.selected ? 'Forçada' : 'Duplicata'}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Nova
                      </span>
                    )}
                  </td>

                  <td className="p-3 whitespace-nowrap text-muted-foreground tabular-nums">
                    {formatDateBR(item.date)}
                  </td>

                  <td className="p-3">
                    <div className="font-medium text-foreground">{item.cleanTitle}</div>
                    {item.originalTitle !== item.cleanTitle && (
                      <div className="text-[10px] text-muted-foreground truncate max-w-[220px]" title={item.originalTitle}>
                        Orig: {item.originalTitle}
                      </div>
                    )}
                  </td>

                  <td className="p-3 whitespace-nowrap">
                    {item.isInstallment ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-secondary text-muted-foreground border border-border">
                        <Layers className="w-3 h-3 text-muted-foreground" />
                        {item.installmentCurrent}/{item.installmentTotal}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">&mdash;</span>
                    )}
                  </td>

                  <td className="p-3">
                    <select
                      value={item.categoryName}
                      onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                      className="bg-secondary/50 text-foreground text-xs rounded-lg px-2 py-1 border border-border focus:outline-none focus:border-primary"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </td>

                  <td className="p-3 text-right whitespace-nowrap tabular-nums">
                    <span className={`font-semibold ${item.type === 'income' ? 'text-emerald-500' : item.isPaymentOrReversal ? 'text-blue-500' : 'text-foreground'}`}>
                      {item.type === 'income' ? '+' : ''}
                      {formatCurrency(item.amount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Confirmation Bar */}
      <div className="p-3.5 rounded-xl bg-card border border-border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="text-xs text-muted-foreground">
          Pronto para importar <strong className="text-foreground">{selectedCount}</strong> transações na conta selecionada.
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || selectedCount === 0}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Importando...' : `Confirmar e Importar (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}
