'use client';

import React from 'react';
import { maskCurrency, parseCurrency } from '@/lib/financial/currency-mask';

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | number;
  onChangeValue: (formattedValue: string, numericValue: number) => void;
  prefix?: string;
  hasError?: boolean;
  className?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onChangeValue,
      prefix = 'R$',
      hasError = false,
      placeholder = '0,00',
      className = '',
      ...props
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const formatted = maskCurrency(raw, String(value || ''));
      const numeric = parseCurrency(formatted);
      onChangeValue(formatted, numeric);
    };

    return (
      <div className="relative w-full">
        {prefix && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={value ?? ''}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full bg-secondary/40 text-foreground text-sm font-bold ${
            prefix ? 'pl-10' : 'pl-3'
          } pr-3 py-2.5 rounded-xl border focus:outline-none transition-colors tabular-nums ${
            hasError
              ? 'border-destructive focus:border-destructive'
              : 'border-border/80 focus:border-primary'
          } ${className}`}
          {...props}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
