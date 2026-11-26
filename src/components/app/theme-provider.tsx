"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { startTransition, useCallback, useEffect, useSyncExternalStore, type ReactNode } from "react";

import type { ThemePreference } from "@/lib/domain/types";

export type ThemeMode = "light" | "dark" | "system";
export type AccentPreset = "blue" | "emerald" | "violet" | "slate";
export type ThemeTransitionStyle = "radial" | "sunrise" | "fade";
type ThemeTransitionDirection = "to-light" | "to-dark" | "accent";

/** Optional click event or element used as the focal point for the circular reveal animation. */
export type ThemeTransitionOrigin =
  | { clientX: number; clientY: number; currentTarget?: HTMLElement | null }
  | null
  | undefined;

export const THEME_TRANSITION_STYLES: ReadonlyArray<{
  id: ThemeTransitionStyle;
  label: string;
  description: string;
}> = [
  { id: "radial", label: "Círculo bidirecional", description: "Expande no escuro e recolhe no claro" },
  { id: "sunrise", label: "Nascer do sol", description: "Onda suave de baixo para cima" },
  { id: "fade", label: "Cross-fade suave", description: "Dissolução limpa sem flash" },
];

export const ACCENT_PRESETS: ReadonlyArray<{
  id: AccentPreset;
  label: string;
  description: string;
  swatch: string;
  ring: string;
}> = [
  { id: "blue", label: "Azul Royal", description: "Fintech clássico", swatch: "#4070F4", ring: "#93C5FD" },
  { id: "emerald", label: "Esmeralda", description: "Foco em economia", swatch: "#059669", ring: "#6EE7B7" },
  { id: "violet", label: "Violeta", description: "Moderno e vibrante", swatch: "#7C3AED", ring: "#C4B5FD" },
  { id: "slate", label: "Grafite", description: "Minimalista neutro", swatch: "#1E293B", ring: "#94A3B8" },
];

export const THEME_STORAGE_KEY = "arrumabolso.theme";
export const ACCENT_STORAGE_KEY = "arrumabolso.accent";
export const TRANSITION_STYLE_STORAGE_KEY = "arrumabolso.theme_transition";
const ACCENT_EVENT = "arrumabolso:accent-change";
const TRANSITION_STYLE_EVENT = "arrumabolso:transition-style-change";

const THEME_META_COLOR = {
  light: "#f6f8fc",
  dark: "#0a0f1d",
} as const;

function resolveModeToPreference(mode: ThemeMode): ThemePreference {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

interface ViewTransitionLike {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition?: () => void;
}

let activeViewTransition: ViewTransitionLike | null = null;

function syncMetaThemeColor(resolved: ThemePreference) {
  if (typeof document === "undefined") return;
  const color = resolved === "dark" ? THEME_META_COLOR.dark : THEME_META_COLOR.light;
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = color;
    document.head.appendChild(meta);
  } else {
    metas.forEach((meta) => {
      meta.removeAttribute("media");
      meta.content = color;
    });
  }
}

function applyThemeDom(mode: ThemeMode, resolved: ThemePreference) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  syncMetaThemeColor(resolved);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage unavailable (private mode); DOM already updated.
  }
}

function parseTransitionStyle(value: string | null): ThemeTransitionStyle {
  if (value === "sunrise" || value === "fade") return value;
  return "radial";
}

function readStoredTransitionStyle(): ThemeTransitionStyle {
  if (typeof window === "undefined") return "radial";
  try {
    return parseTransitionStyle(window.localStorage.getItem(TRANSITION_STYLE_STORAGE_KEY));
  } catch {
    return "radial";
  }
}

function subscribeTransitionStyle(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(TRANSITION_STYLE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(TRANSITION_STYLE_EVENT, handler);
  };
}

/**
 * Runs a zero-delay, eye-friendly theme/accent visual transition:
 * - `applyDom` mutates only CSS classes/attributes on `<html>` (<0.2ms, no React `flushSync` stall),
 *   so the browser captures the new frame immediately and starts the GPU animation on the next vsync.
 * - Dark → Light uses gentler timing + reverse radial shrink (or sunrise / soft fade) with brightness
 *   ramping to eliminate any harsh white flash.
 * - `afterStart` syncs lightweight React theme state once the compositor animation is running.
 * - `afterFinish` persists heavier side-effects (e.g. FinanceStore + Supabase sync) after the reveal completes.
 */
function runSmoothThemeTransition(
  applyDom: () => void,
  options?: {
    origin?: ThemeTransitionOrigin;
    direction?: ThemeTransitionDirection;
    afterStart?: () => void;
    afterFinish?: () => void;
  },
) {
  const { origin, direction = "to-dark", afterStart, afterFinish } = options ?? {};

  if (typeof window === "undefined" || typeof document === "undefined") {
    applyDom();
    afterStart?.();
    afterFinish?.();
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    applyDom();
    if (afterStart) startTransition(afterStart);
    afterFinish?.();
    return;
  }

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  if (origin && (origin.clientX > 0 || origin.clientY > 0)) {
    x = origin.clientX;
    y = origin.clientY;
  } else if (origin?.currentTarget) {
    const rect = origin.currentTarget.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }

  const root = document.documentElement;
  const style = readStoredTransitionStyle();
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => ViewTransitionLike;
  };

  if (typeof doc.startViewTransition === "function") {
    // Cancel any in-flight transition immediately so rapid clicks never queue or lag.
    try {
      activeViewTransition?.skipTransition?.();
    } catch {
      // Ignore already-finished transitions.
    }

    root.setAttribute("data-theme-direction", direction);
    root.setAttribute("data-theme-transition-style", style);

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const transition = doc.startViewTransition(() => {
      applyDom();
    });
    activeViewTransition = transition;

    void transition.ready
      .then(() => {
        if (style === "fade") {
          root.animate(
            { opacity: [0, 1] },
            {
              duration: direction === "to-light" ? 320 : 240,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
              fill: "forwards",
            },
          );
        } else if (style === "sunrise") {
          const isToLight = direction === "to-light";
          root.animate(
            {
              clipPath: isToLight
                ? ["inset(100% 0 0 0)", "inset(0 0 0 0)"]
                : ["inset(0 0 100% 0)", "inset(0 0 0 0)"],
              opacity: isToLight ? [0.78, 1] : [0.88, 1],
            },
            {
              duration: isToLight ? 420 : 330,
              easing: isToLight ? "cubic-bezier(0.22, 1, 0.36, 1)" : "cubic-bezier(0.16, 1, 0.3, 1)",
              pseudoElement: "::view-transition-new(root)",
              fill: "forwards",
            },
          );
        } else if (direction === "to-light") {
          // Reverse radial: dark layer shrinks cleanly back into the clicked button while light gently ramps brightness.
          root.animate(
            {
              clipPath: [`circle(${endRadius}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`],
            },
            {
              duration: 400,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-old(root)",
              fill: "forwards",
            },
          );
          root.animate(
            { opacity: [0.84, 1] },
            {
              duration: 280,
              easing: "ease-out",
              pseudoElement: "::view-transition-new(root)",
              fill: "forwards",
            },
          );
        } else {
          root.animate(
            {
              clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`],
            },
            {
              duration: 310,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              pseudoElement: "::view-transition-new(root)",
              fill: "forwards",
            },
          );
        }
        if (afterStart) startTransition(afterStart);
      })
      .catch(() => {
        if (afterStart) startTransition(afterStart);
      });

    void transition.finished
      .finally(() => {
        if (activeViewTransition === transition) {
          activeViewTransition = null;
          root.removeAttribute("data-theme-direction");
          root.removeAttribute("data-theme-transition-style");
        }
        if (afterFinish) startTransition(afterFinish);
      });
    return;
  }

  // Graceful cross-fade fallback for browsers without View Transitions API.
  root.setAttribute("data-theme-direction", direction);
  root.setAttribute("data-theme-transitioning", "true");
  applyDom();
  if (afterStart) startTransition(afterStart);
  window.setTimeout(() => {
    root.removeAttribute("data-theme-transitioning");
    root.removeAttribute("data-theme-direction");
    if (afterFinish) startTransition(afterFinish);
  }, direction === "to-light" ? 390 : 320);
}

function parseAccent(value: string | null): AccentPreset {
  if (value === "emerald" || value === "violet" || value === "slate") return value;
  return "blue";
}

function readStoredAccent(): AccentPreset {
  if (typeof window === "undefined") return "blue";
  try {
    return parseAccent(window.localStorage.getItem(ACCENT_STORAGE_KEY));
  } catch {
    return "blue";
  }
}

function subscribeAccent(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(ACCENT_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(ACCENT_EVENT, handler);
  };
}

function applyAccentToDocument(accent: AccentPreset) {
  if (typeof document === "undefined") return;
  if (accent === "blue") {
    document.documentElement.removeAttribute("data-accent");
  } else {
    document.documentElement.setAttribute("data-accent", accent);
  }
}

/** Keeps `<meta name="theme-color">` aligned with the active app theme (not just OS media query). */
function ThemeMetaSync() {
  const { resolvedTheme } = useTheme();
  const accent = useSyncExternalStore(subscribeAccent, readStoredAccent, () => "blue" as AccentPreset);

  useEffect(() => {
    applyAccentToDocument(accent);
  }, [accent]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    syncMetaThemeColor(resolvedTheme === "dark" ? "dark" : "light");
  }, [resolvedTheme]);

  return null;
}

/**
 * Supports `light`, `dark` (Deep Fintech Navy), and `system` (automatic OS theme),
 * persisted in `localStorage` with smooth View Transitions circular reveal and
 * zero white flash on initial load.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      storageKey={THEME_STORAGE_KEY}
      defaultTheme="system"
      enableSystem
    >
      <ThemeMetaSync />
      {children}
    </NextThemesProvider>
  );
}

/** Reads and smoothly updates the active theme mode (`light`, `dark`, `system`). */
export function useThemeMode(): {
  mode: ThemeMode;
  resolved: ThemePreference;
  setMode: (mode: ThemeMode, origin?: ThemeTransitionOrigin, onPersist?: (resolved: ThemePreference) => void) => void;
  toggleLightDark: (origin?: ThemeTransitionOrigin, onPersist?: (resolved: ThemePreference) => void) => ThemePreference;
} {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mode: ThemeMode = theme === "light" || theme === "dark" || theme === "system" ? theme : "system";
  const resolved: ThemePreference = resolvedTheme === "dark" ? "dark" : "light";

  const setMode = useCallback(
    (next: ThemeMode, origin?: ThemeTransitionOrigin, onPersist?: (resolved: ThemePreference) => void) => {
      const nextResolved = resolveModeToPreference(next);
      const currentIsDark =
        typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : resolved === "dark";
      if ((nextResolved === "dark") === currentIsDark) {
        startTransition(() => setTheme(next));
        if (onPersist) startTransition(() => onPersist(nextResolved));
        return;
      }
      runSmoothThemeTransition(
        () => applyThemeDom(next, nextResolved),
        {
          origin,
          direction: nextResolved === "dark" ? "to-dark" : "to-light",
          afterStart: () => setTheme(next),
          afterFinish: onPersist ? () => onPersist(nextResolved) : undefined,
        },
      );
    },
    [resolved, setTheme],
  );

  const toggleLightDark = useCallback(
    (origin?: ThemeTransitionOrigin, onPersist?: (resolved: ThemePreference) => void): ThemePreference => {
      // Read the live DOM class so rapid clicks always toggle accurately with zero React latency.
      const currentIsDark =
        typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : resolved === "dark";
      const next: ThemePreference = currentIsDark ? "light" : "dark";
      runSmoothThemeTransition(
        () => applyThemeDom(next, next),
        {
          origin,
          direction: next === "dark" ? "to-dark" : "to-light",
          afterStart: () => setTheme(next),
          afterFinish: onPersist ? () => onPersist(next) : undefined,
        },
      );
      return next;
    },
    [resolved, setTheme],
  );

  return { mode, resolved, setMode, toggleLightDark };
}

/** Reads and updates the user's preferred theme transition style (`radial`, `sunrise`, `fade`). */
export function useThemeTransitionStyle(): {
  transitionStyle: ThemeTransitionStyle;
  setTransitionStyle: (style: ThemeTransitionStyle) => void;
} {
  const transitionStyle = useSyncExternalStore(
    subscribeTransitionStyle,
    readStoredTransitionStyle,
    () => "radial" as ThemeTransitionStyle,
  );
  const setTransitionStyle = useCallback((next: ThemeTransitionStyle) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TRANSITION_STYLE_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors.
    }
    window.dispatchEvent(new Event(TRANSITION_STYLE_EVENT));
  }, []);
  return { transitionStyle, setTransitionStyle };
}

/** Reads and smoothly updates the browser-local accent color preset (`blue`, `emerald`, `violet`, `slate`). */
export function useAccent(): {
  accent: AccentPreset;
  setAccent: (accent: AccentPreset, origin?: ThemeTransitionOrigin, onFinish?: () => void) => void;
} {
  const accent = useSyncExternalStore(subscribeAccent, readStoredAccent, () => "blue" as AccentPreset);
  const setAccent = useCallback(
    (next: AccentPreset, origin?: ThemeTransitionOrigin, onFinish?: () => void) => {
      if (next === accent) return;
      runSmoothThemeTransition(
        () => {
          applyAccentToDocument(next);
          try {
            window.localStorage.setItem(ACCENT_STORAGE_KEY, next);
          } catch {
            // Ignore storage errors.
          }
        },
        {
          origin,
          direction: "accent",
          afterStart: () => window.dispatchEvent(new Event(ACCENT_EVENT)),
          afterFinish: onFinish,
        },
      );
    },
    [accent],
  );
  return { accent, setAccent };
}

/**
 * Seeds the theme from the user's saved account preference ONLY when this browser
 * has no explicit local theme choice yet — preventing a legacy production database
 * (without `profiles.theme`) from resetting dark mode back to light on reload.
 */
export function useUserTheme(accountTheme: ThemePreference | null): void {
  const { setTheme } = useTheme();
  useEffect(() => {
    if (!accountTheme || typeof window === "undefined") return;
    try {
      const existing = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (!existing && accountTheme === "dark") {
        setTheme("dark");
      }
    } catch {
      // Ignore storage errors.
    }
  }, [accountTheme, setTheme]);
}
