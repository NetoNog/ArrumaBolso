import { Avatar, Style } from "@dicebear/core";

/**
 * Profile picture styles from DiceBear (https://github.com/dicebear/dicebear).
 * Only styles that need no attribution are offered (CC0 or free for commercial
 * use). Each definition is a JSON file loaded on demand, so the bundle only
 * pays for the styles a user actually sees.
 */
export const AVATAR_STYLES = [
  { id: "notionists-neutral", label: "Notionists", load: () => import("@dicebear/styles/notionists-neutral.json") },
  { id: "lorelei", label: "Lorelei", load: () => import("@dicebear/styles/lorelei.json") },
  { id: "avataaars", label: "Avataaars", load: () => import("@dicebear/styles/avataaars.json") },
  { id: "bottts-neutral", label: "Robôs", load: () => import("@dicebear/styles/bottts-neutral.json") },
  { id: "thumbs", label: "Thumbs", load: () => import("@dicebear/styles/thumbs.json") },
  { id: "pixel-art", label: "Pixel Art", load: () => import("@dicebear/styles/pixel-art.json") },
] as const;

export type AvatarStyleId = (typeof AVATAR_STYLES)[number]["id"];

export const DEFAULT_AVATAR_STYLE: AvatarStyleId = "notionists-neutral";

export function isAvatarStyle(value: string | null | undefined): value is AvatarStyleId {
  return AVATAR_STYLES.some((style) => style.id === value);
}

const styleCache = new Map<AvatarStyleId, Promise<Style>>();

function loadStyle(id: AvatarStyleId): Promise<Style> {
  let cached = styleCache.get(id);
  if (!cached) {
    const entry = AVATAR_STYLES.find((style) => style.id === id);
    if (!entry) return Promise.reject(new Error(`Estilo de avatar desconhecido: ${id}`));
    cached = entry.load().then((module) => new Style(module.default));
    // A failed download must not poison the cache: the next render retries.
    cached.catch(() => styleCache.delete(id));
    styleCache.set(id, cached);
  }
  return cached;
}

/** Renders the avatar as a `data:image/svg+xml` URI. */
export async function renderAvatar(styleId: AvatarStyleId, seed: string): Promise<string> {
  const style = await loadStyle(styleId);
  return new Avatar(style, { seed }).toDataUri();
}

/** Random seeds for the picker; any string is a valid seed. */
export function randomSeeds(count: number): string[] {
  return Array.from({ length: count }, () => Math.random().toString(36).slice(2, 10));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "A") + (parts[1]?.[0] ?? "")).toUpperCase();
}
