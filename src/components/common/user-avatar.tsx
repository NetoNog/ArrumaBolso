"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "cn";

import { initials, isAvatarStyle, renderAvatar } from "@/lib/avatar";

/**
 * DiceBear profile picture, or the initials of `name` while it loads, when no
 * avatar was chosen, or if the style cannot be rendered.
 */
export function UserAvatar({
  name,
  style,
  seed,
  size = 32,
  className,
}: {
  name: string;
  style: string | null;
  seed: string | null;
  size?: number;
  className?: string;
}) {
  const uri = useAvatarUri(style, seed);
  return (
    <span
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full", !uri && "bg-gradient-to-br from-blue-500 to-violet-500", uri && "bg-brand-soft", className)}
      style={{ width: size, height: size }}
    >
      {uri ? (
        <Image src={uri} alt={`Foto de perfil de ${name}`} width={size} height={size} unoptimized className="size-full" />
      ) : (
        <span className="font-semibold text-white" style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }} aria-hidden="true">
          {initials(name)}
        </span>
      )}
    </span>
  );
}

/** Data URI of the avatar, or `null` while loading / when there is none. */
export function useAvatarUri(style: string | null, seed: string | null): string | null {
  const key = style && seed && isAvatarStyle(style) ? `${style}:${seed}` : null;
  const [result, setResult] = useState<{ key: string; uri: string } | null>(null);

  useEffect(() => {
    if (!key || !style || !seed || !isAvatarStyle(style)) return;
    let cancelled = false;
    renderAvatar(style, seed)
      .then((uri) => {
        if (!cancelled) setResult({ key, uri });
      })
      .catch((cause: unknown) => {
        // Initials remain as the fallback; log so a broken style is noticed.
        console.error("Falha ao gerar avatar", cause);
      });
    return () => {
      cancelled = true;
    };
  }, [key, style, seed]);

  return result && result.key === key ? result.uri : null;
}
