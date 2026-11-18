"use client";

import { RefreshCw, UserRound } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";

import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { AVATAR_STYLES, DEFAULT_AVATAR_STYLE, isAvatarStyle, randomSeeds, type AvatarStyleId } from "@/lib/avatar";

export interface AvatarChoice {
  style: AvatarStyleId;
  seed: string;
}

const OPTIONS_PER_PAGE = 11;

/**
 * Lets the user pick a DiceBear style and one of several generated faces.
 * `value === null` means "no picture" (initials).
 */
export function AvatarPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: AvatarChoice | null;
  onChange: (value: AvatarChoice | null) => void;
}) {
  const [style, setStyle] = useState<AvatarStyleId>(value?.style ?? DEFAULT_AVATAR_STYLE);
  const [seeds, setSeeds] = useState<string[]>(() => randomSeeds(OPTIONS_PER_PAGE));
  // The current pick stays first so it is never lost when the user shuffles.
  const options = [value?.seed ?? name.trim(), ...seeds].filter((seed, index, all) => seed && all.indexOf(seed) === index);

  return (
    <div className="grid gap-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="radiogroup" aria-label="Estilo do avatar">
        {AVATAR_STYLES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={style === item.id}
            onClick={() => {
              setStyle(item.id);
              if (value) onChange({ style: item.id, seed: value.seed });
            }}
            className={cn(
              "h-8 shrink-0 rounded-md border px-3 text-xs font-medium whitespace-nowrap transition-colors pointer-coarse:h-9",
              style === item.id ? "border-nav-active bg-nav-active text-nav-active-foreground" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Escolha seu avatar">
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          aria-label="Sem foto (iniciais)"
          onClick={() => onChange(null)}
          className={cn(
            "flex aspect-square items-center justify-center rounded-xl border-2 bg-muted/40 text-muted-foreground transition-[border-color,transform] active:scale-95",
            value === null ? "border-brand" : "border-transparent hover:border-border",
          )}
        >
          <UserRound className="size-6" />
        </button>
        {options.map((seed) => {
          const selected = value !== null && value.style === style && value.seed === seed;
          return (
            <button
              key={seed}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label="Usar este avatar"
              onClick={() => onChange({ style, seed })}
              className={cn(
                "flex aspect-square items-center justify-center rounded-xl border-2 p-1 transition-[border-color,transform] active:scale-95",
                selected ? "border-brand bg-brand-soft" : "border-transparent hover:border-border",
              )}
            >
              <UserAvatar name={name} style={style} seed={seed} size={56} />
            </button>
          );
        })}
      </div>

      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setSeeds(randomSeeds(OPTIONS_PER_PAGE))}>
        <RefreshCw /> Gerar outros
      </Button>
    </div>
  );
}

/** Reads the stored avatar back into a picker value, ignoring unknown styles. */
export function toAvatarChoice(style: string | null, seed: string | null): AvatarChoice | null {
  return style && seed && isAvatarStyle(style) ? { style, seed } : null;
}
