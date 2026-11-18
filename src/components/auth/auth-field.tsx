"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";

/** Outlined input with the label sitting on the top border. Password fields get a show/hide toggle. */
export function AuthField({
  id,
  label,
  type = "text",
  autoComplete,
  placeholder,
  disabled,
  value,
  onChange,
}: {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete: string;
  placeholder?: string;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="relative">
      <label htmlFor={id} className="absolute -top-2 left-3 bg-card px-1 text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type={isPassword && visible ? "text" : type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-12 w-full rounded-lg border border-input bg-transparent px-4 text-sm text-foreground outline-none transition-colors",
          "placeholder:text-muted-foreground/60 hover:border-muted-foreground/40",
          "focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isPassword && "pr-11",
        )}
      />
      {isPassword ? (
        <button
          type="button"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      ) : null}
    </div>
  );
}
