'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  TrendingDown, 
  HelpCircle, 
  CheckCircle2, 
  CreditCard, 
  DollarSign, 
  ArrowRight,
  Info
} from 'lucide-react';
import { usePrivacy } from '@/components/providers/privacy-provider';

export function InstallmentSimulator() {
  const { formatMoney } = usePrivacy();

  const [totalAmount, setTotalAmount] = useState<number>(1200);
  const [installments, setInstallments] = useState<number>(6);
  const [annualRate, setAnnualRate] = useState<number>(10.5); // % a.a. Nubank padrão

  // Taxa mensal equivalente: (1 + i_ano)^(1/12) - 1
  const monthlyRate = Math.pow(1 + (annualRate / 100), 1 / 12) - 1;
  const installmentValue = totalAmount > 0 && installments > 0 ? totalAmount / installments : 0;

  // Cálculo do valor presente de cada parcela antecipada
  let presentValueTotal = 0;
  const schedule: { month: number; original: number; discounted: number; saved: number }[] = [];

  for (let m = 1; m <= installments; m++) {
    // Parcela m antecipada tem desconto de m períodos
    const pv = installmentValue / Math.pow(1 + monthlyRate, m);
    presentValueTotal += pv;
    schedule.push({
      month: m,
      original: installmentValue,
      discounted: pv,
      saved: installmentValue - pv
    });
  }

  const totalDiscount = Math.max(0, totalAmount - presentValueTotal);
  const discountPercentage = totalAmount > 0 ? (totalDiscount / totalAmount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="p-5 rounded-2xl bg-secondary/30 border border-border/80 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">
              Simulador de Antecipação de Parcelas (Nubank / Cartões)
            </h3>
            <p className="text-xs text-muted-foreground">
              Descubra quanto você economiza ao adiantar parcelas da sua fatura com desconto a valor presente.
            </p>
          </div>
        </div>

        {/* Input Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">
              Valor Total a Antecipar (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-bold text-muted-foreground">R$</span>
              <input
                type="number"
                min="10"
                step="10"
                value={totalAmount || ''}
                onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-secondary/60 text-foreground text-sm font-bold pl-10 pr-3 py-2.5 rounded-xl border border-border/80 focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">
              Qtd. de Parcelas Futuras
            </label>
            <input
              type="number"
              min="2"
              max="48"
              value={installments || ''}
              onChange={(e) => setInstallments(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-secondary/60 text-foreground text-sm font-bold px-3 py-2.5 rounded-xl border border-border/80 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">
              Desconto Oferecido (% ao ano)
            </label>
            <input
              type="number"
              step="0.1"
              min="1"
              max="50"
              value={annualRate || ''}
              onChange={(e) => setAnnualRate(parseFloat(e.target.value) || 0)}
              className="w-full bg-secondary/60 text-foreground text-sm font-bold px-3 py-2.5 rounded-xl border border-border/80 focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Result Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Economia Total */}
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
          <span className="text-xs font-semibold text-emerald-400">Economia no seu Bolso</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
            {formatMoney(totalDiscount)}
          </div>
          <span className="text-xs text-muted-foreground">
            Desconto real de <strong>{discountPercentage.toFixed(2)}%</strong> sobre a compra
          </span>
        </div>

        {/* Valor a Pagar Agora */}
        <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">Total Antecipado com Desconto</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {formatMoney(presentValueTotal)}
          </div>
          <span className="text-xs text-muted-foreground">
            Original sem desconto: {formatMoney(totalAmount)}
          </span>
        </div>

        {/* Taxa Mensal Equivalente */}
        <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">Taxa Mensal Efetiva</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400">
            {(monthlyRate * 100).toFixed(2)}% a.m.
          </div>
          <span className="text-xs text-muted-foreground">
            Baseada na taxa anual informada ({annualRate}% a.a.)
          </span>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-3">
        <h4 className="text-sm font-bold text-foreground">Detalhamento das Parcelas Antecipadas</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                <th className="py-2.5 px-3">Parcela</th>
                <th className="py-2.5 px-3">Valor Original</th>
                <th className="py-2.5 px-3">Valor com Desconto</th>
                <th className="py-2.5 px-3 text-right">Economia Real</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {schedule.map((row) => (
                <tr key={row.month} className="hover:bg-secondary/20 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-foreground">
                    Parcela {row.month} de {installments}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {formatMoney(row.original)}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-foreground">
                    {formatMoney(row.discounted)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                    +{formatMoney(row.saved)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
