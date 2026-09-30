'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface CSVDropzoneProps {
  onFileLoaded: (content: string, fileName: string) => void;
}

export function CSVDropzone({ onFileLoaded }: CSVDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  const handleFile = (file: File) => {
    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv');
    const isOfx = file.name.toLowerCase().endsWith('.ofx') || file.name.toLowerCase().endsWith('.qfx');
    
    if (!isCsv && !isOfx && !file.type.includes('text')) {
      toast.error('Por favor, selecione um arquivo válido no formato .CSV ou .OFX');
      return;
    }

    if (file.size > MAX_CSV_SIZE_BYTES) {
      toast.error('Arquivo muito grande! O limite para extratos é de 5MB.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      onFileLoaded(text, file.name);
      toast.success(`Arquivo ${file.name} carregado com sucesso!`);
    };
    reader.onerror = () => {
      toast.error('Erro ao ler o arquivo CSV.');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const loadSampleFile = async (type: 'fatura' | 'conta') => {
    try {
      const url = type === 'fatura' 
        ? '/samples/nubank_fatura_exemplo.csv' 
        : '/samples/nubank_conta_exemplo.csv';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Não foi possível carregar o arquivo de exemplo.');
      const text = await res.text();
      const name = type === 'fatura' ? 'nubank_fatura_exemplo.csv' : 'nubank_conta_exemplo.csv';
      setFileName(name);
      onFileLoaded(text, name);
      toast.success(`Exemplo de ${type === 'fatura' ? 'Fatura Nubank' : 'Extrato NuConta'} carregado com sucesso!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar arquivo de teste.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 relative group ${
          isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-border/70 hover:border-primary/50 hover:bg-secondary/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.ofx,.qfx,text/csv,application/x-ofx,text/plain"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
              e.target.value = '';
            }
          }}
        />

        <div className="w-12 h-12 rounded-xl bg-secondary/80 text-muted-foreground mx-auto flex items-center justify-center mb-3 group-hover:text-primary transition-colors">
          <UploadCloud className="w-6 h-6" />
        </div>

        <h4 className="text-sm sm:text-base font-bold text-foreground">
          {fileName ? (
            <span className="flex items-center justify-center gap-2 text-foreground font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Arquivo Carregado: {fileName}
            </span>
          ) : (
            'Selecione ou arraste seu arquivo .CSV ou .OFX'
          )}
        </h4>

        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Compatível com Nubank (CSV), Itaú, Bradesco, Santander, Banco do Brasil, Inter, C6 e Caixa (OFX).
        </p>

        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 text-xs font-medium text-foreground border border-border/70">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          Procurar no computador
        </div>
      </div>

      {/* 1-Click Samples for Instant Demonstration */}
      <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span>Deseja testar de imediato? Use os arquivos de exemplo:</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              loadSampleFile('fatura');
            }}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium border border-border/70 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            Exemplo Fatura (.csv)
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              loadSampleFile('conta');
            }}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium border border-border/70 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            Exemplo NuConta (.csv)
          </button>
        </div>
      </div>
    </div>
  );
}
