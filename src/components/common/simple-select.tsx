"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SimpleOption<T extends string> {
  value: T;
  label: string;
}

/** Thin typed wrapper over the Base UI select for plain string enums. */
export function SimpleSelect<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "default",
  ariaLabel,
  id,
  disabled,
}: {
  value: T;
  options: readonly SimpleOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "default";
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
}) {
  const items = Object.fromEntries(options.map((option) => [option.value, option.label]));
  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        const match = options.find((option) => option.value === next);
        if (match) onChange(match.value);
      }}
    >
      <SelectTrigger id={id} size={size} className={className} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
