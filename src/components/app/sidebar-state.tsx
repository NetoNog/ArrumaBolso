"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

/** Device preference (it depends on the screen), so it lives in the browser, not in the account. */
const STORAGE_KEY = "arrumabolso:sidebar-collapsed";
const CHANGE_EVENT = "arrumabolso:sidebar-collapsed-change";

/** Width of the desktop sidebar in each state, shared by the sidebar and the content offset. */
export const SIDEBAR_WIDTH = { expanded: 250, collapsed: 60 } as const;

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Fallback when localStorage is unavailable (private mode): kept for this page load only. */
let memoryValue = false;

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return memoryValue;
  }
}

interface SidebarState {
  collapsed: boolean;
  /** True once the user toggled in this page load: the restored state on load must not animate. */
  animate: boolean;
  toggle: () => void;
}

const SidebarStateContext = createContext<SidebarState>({ collapsed: false, animate: false, toggle: () => {} });

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const [animate, setAnimate] = useState(false);

  const toggle = useCallback(() => {
    const next = !readCollapsed();
    memoryValue = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Storage unavailable: `memoryValue` keeps the choice for this page load.
    }
    setAnimate(true);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const value = useMemo(() => ({ collapsed, animate, toggle }), [collapsed, animate, toggle]);
  return <SidebarStateContext.Provider value={value}>{children}</SidebarStateContext.Provider>;
}

export function useSidebarState(): SidebarState {
  return useContext(SidebarStateContext);
}
