import { ChevronDown, CircleHelp } from "lucide-react";

import { issuerInfo } from "@/lib/import/issuers";
import type { CardIssuer } from "@/lib/domain/types";

const GUIDES: { issuer: CardIssuer; format: string; steps: string }[] = [
  { issuer: "nubank", format: "CSV ou OFX", steps: "App ou site → Cartão de crédito → Faturas → escolha a fatura → Exportar fatura." },
  { issuer: "inter", format: "CSV", steps: "App → Cartão → Fatura → escolha o mês → Exportar / Baixar em CSV." },
  { issuer: "itau", format: "OFX", steps: "Internet banking → Cartões → Fatura → Salvar em OFX (Money/Quicken)." },
  { issuer: "bradesco", format: "CSV ou OFX", steps: "Internet banking → Cartões → Fatura → Exportar (Excel/CSV ou OFX)." },
  { issuer: "santander", format: "OFX", steps: "Internet banking → Cartões → Fatura → Exportar para OFX." },
  { issuer: "c6", format: "CSV", steps: "App → Cartão → Fatura → Compartilhar / Exportar em CSV." },
];

/** Collapsible "where do I download my statement" help, per bank. */
export function ExportGuide() {
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <CircleHelp className="size-4 text-muted-foreground" />
        Como exportar a fatura do meu banco?
        <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-2 border-t px-4 py-3 sm:grid-cols-2">
        {GUIDES.map((guide) => {
          const info = issuerInfo(guide.issuer);
          return (
            <div key={guide.issuer} className="flex gap-3 rounded-lg bg-muted/40 p-3">
              <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: info.color }} aria-hidden />
              <div className="grid gap-0.5">
                <p className="text-sm font-medium">
                  {info.label} <span className="text-xs font-normal text-muted-foreground">• {guide.format}</span>
                </p>
                <p className="text-xs text-muted-foreground">{guide.steps}</p>
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Os menus podem mudar conforme a versão do app. Qualquer CSV com colunas de data, descrição e valor também funciona.
        </p>
      </div>
    </details>
  );
}
