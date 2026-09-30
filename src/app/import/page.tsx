'use client';

import React, { useState } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { CSVDropzone } from '@/components/import/csv-dropzone';
import { ImportPreviewTable } from '@/components/import/import-preview-table';
import { parseNubankCSV, ParseNubankResult } from '@/lib/parsers/nubank-parser';
import { parseOFX } from '@/lib/parsers/ofx-parser';
import { InstallmentSimulator } from '@/components/import/installment-simulator';
import { DEFAULT_CATEGORIZATION_RULES } from '@/lib/parsers/categorization-rules';
import { FinancialService } from '@/lib/services/financial-service';
import { useCategories, useAccounts, useImportNubankBatch } from '@/hooks/use-financial';
import { 
  FileSpreadsheet, 
  Sparkles, 
  CheckCircle2, 
  Tag, 
  ShieldCheck, 
  ArrowLeft,
  RotateCcw,
  Calculator
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function ImportPage() {
  const router = useRouter();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const importNubankMutation = useImportNubankBatch();

  const [parseResult, setParseResult] = useState<ParseNubankResult | null>(null);
  const [rawFileName, setRawFileName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'import' | 'rules' | 'simulator'>('import');

  const handleFileLoaded = async (content: string, fileName: string) => {
    try {
      const existing = await FinancialService.getTransactions();
      const existingHashes = new Set(existing.map(t => t.csv_hash).filter(Boolean) as string[]);

      let result: ParseNubankResult;
      if (fileName.toLowerCase().endsWith('.ofx') || content.includes('<OFX>') || content.includes('<STMTTRN>')) {
        result = parseOFX(content, existingHashes);
      } else {
        result = parseNubankCSV(content, existingHashes);
      }

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setParseResult(result);
      setRawFileName(fileName);
      toast.success(`${result.totalFound} transações processadas com sucesso!`);
    } catch (err: any) {
      toast.error('Erro ao processar o arquivo.');
    }
  };

  const handleConfirmImport = async (selectedItems: any[], targetAccountId: string) => {
    try {
      const result = await importNubankMutation.mutateAsync({ items: selectedItems, accountId: targetAccountId });
      toast.success(`${result.importedCount} transações importadas com sucesso e persistidas no Supabase!`);
      if (result.ignoredDuplicates > 0) {
        toast.info(`${result.ignoredDuplicates} transações duplicadas foram desconsideradas.`);
      }

      // Limpa e redireciona para o Dashboard para ver os dados imediatamente
      setParseResult(null);
      router.push('/');
    } catch (err: any) {
      console.error('Erro na importação:', err);
      toast.error(err?.message || 'Falha ao processar e salvar transações.');
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar accounts={accounts} />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />

        <main className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto w-full pb-28 md:pb-12">
          {/* Header Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Importação Multi-Bancos (CSV & OFX)
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Reconhecimento automático de parcelas Nubank e extratos bancários universais (OFX).
              </p>
            </div>

            {/* Sub-Tabs: Importador vs Regras vs Simulador */}
            <div className="flex items-center bg-secondary/60 p-0.5 rounded-lg border border-border/70 text-xs self-start sm:self-auto overflow-x-auto max-w-full">
              <button
                onClick={() => setActiveTab('import')}
                className={`px-3 py-1.5 rounded-md transition-all shrink-0 ${
                  activeTab === 'import' ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Importar Arquivo
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-3 py-1.5 rounded-md transition-all shrink-0 ${
                  activeTab === 'rules' ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Regras de Categorização
              </button>
              <button
                onClick={() => setActiveTab('simulator')}
                className={`px-3 py-1.5 rounded-md transition-all shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'simulator' ? 'bg-card text-foreground font-semibold shadow-xs text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                Simulador de Antecipação
              </button>
            </div>
          </div>

          {activeTab === 'import' ? (
            <div className="space-y-6">
              {!parseResult ? (
                /* Step 1: Dropzone */
                <div className="space-y-6">
                  <CSVDropzone onFileLoaded={handleFileLoaded} />

                  {/* Highlights Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div className="p-4 rounded-xl bg-card border border-border/70 shadow-sm">
                      <div className="w-8 h-8 rounded-lg bg-secondary/80 text-muted-foreground flex items-center justify-center mb-2.5">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <h4 className="text-xs sm:text-sm font-semibold text-foreground">Detecção de Parcelas</h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Identifica formatos de parcelamento automaticamente (ex: &quot;Parcela 2/6&quot;) e projeta o saldo futuro.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-border/70 shadow-sm">
                      <div className="w-8 h-8 rounded-lg bg-secondary/80 text-muted-foreground flex items-center justify-center mb-2.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      </div>
                      <h4 className="text-xs sm:text-sm font-semibold text-foreground">Deduplicação Inteligente</h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Evita lançamentos duplicados por meio de verificação única de data, valor e estabelecimento.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-border/70 shadow-sm">
                      <div className="w-8 h-8 rounded-lg bg-secondary/80 text-muted-foreground flex items-center justify-center mb-2.5">
                        <Tag className="w-4 h-4 text-foreground" />
                      </div>
                      <h4 className="text-xs sm:text-sm font-semibold text-foreground">Classificação Automática</h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Atribui categorias automaticamente para supermercados, transportes, assinaturas e lazer.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Step 2: Preview & Reconciliation */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setParseResult(null)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Voltar e carregar outro arquivo
                    </button>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Arquivo: <strong>{rawFileName}</strong></span>
                      <span className="inline-block w-1 h-1 rounded-full bg-border" />
                      <span>Formato: <strong>{parseResult.formatDetected === 'credit_card' ? 'Fatura Cartão Nubank' : 'Extrato NuConta'}</strong></span>
                    </div>
                  </div>

                  <ImportPreviewTable
                    items={parseResult.items}
                    categories={categories}
                    accounts={accounts}
                    onConfirmImport={handleConfirmImport}
                    onCancel={() => setParseResult(null)}
                  />
                </div>
              )}
            </div>
          ) : activeTab === 'rules' ? (
            /* Tab: Regras de Categorização Inteligente */
            <div className="p-6 rounded-xl bg-card border border-border/70 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/70 pb-3 gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                    <Tag className="w-4 h-4 text-primary" />
                    Dicionário de Categorização Automática
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Termos identificados automaticamente durante a importação de faturas.
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {DEFAULT_CATEGORIZATION_RULES.length} categorias mapeadas
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DEFAULT_CATEGORIZATION_RULES.map((rule, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-secondary/30 border border-border/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rule.color }} />
                        <span className="text-xs font-semibold text-foreground">{rule.categoryName}</span>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border/60">
                        {rule.type}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {rule.keywords.map((kw, kIdx) => (
                        <span key={kIdx} className="text-[10px] px-2 py-0.5 rounded bg-card border border-border/70 text-muted-foreground">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <InstallmentSimulator />
          )}
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
