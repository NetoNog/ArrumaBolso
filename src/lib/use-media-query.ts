"use client";

import { useSyncExternalStore } from "react";

const MD_QUERY = "(min-width: 768px)";
const LG_QUERY = "(min-width: 1024px)";

function createMediaStore(query: string) {
  function subscribe(callback: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", callback);
    return () => mql.removeEventListener("change", callback);
  }
  function getSnapshot(): boolean {
    if (typeof window === "undefined") return true;
    return window.matchMedia(query).matches;
  }
  return { subscribe, getSnapshot };
}

const mdStore = createMediaStore(MD_QUERY);
const lgStore = createMediaStore(LG_QUERY);

/**
 * Returns `true` at `>= 768px` (Tailwind `md:`) and `false` on mobile screens.
 * Used to avoid mounting hidden desktop charts/tables on mobile and vice versa.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(mdStore.subscribe, mdStore.getSnapshot, () => true);
}

/**
 * Returns `true` at `>= 1024px` (Tailwind `lg:`) and `false` below.
 * Used to mount only the active mobile OR desktop header controls.
 */
export function useIsLg(): boolean {
  return useSyncExternalStore(lgStore.subscribe, lgStore.getSnapshot, () => true);
}
