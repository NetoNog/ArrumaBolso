"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

// WebGL shader, only downloaded when it will actually run.
const Aurora = dynamic(() => import("@/components/landing/react-bits/Aurora"), { ssr: false });

/**
 * Deep blues around Azul Bolso (BRAND.md) over the Noite background. Kept dark on
 * purpose: the aurora is atmosphere, it must never compete with the copy.
 */
const AURORA_STOPS = ["#1E3A8A", "#2563EB", "#1E40AF"];

/**
 * The shader runs on desktop-class devices (precise pointer, lg+ width) when the
 * user has not asked for reduced motion and WebGL2 is available. Phones and
 * tablets keep the static gradient: same look, no GPU cost, no battery drain.
 */
const CAPABLE_QUERY = "(prefers-reduced-motion: no-preference) and (pointer: fine) and (min-width: 1024px)";

let webgl2: boolean | null = null;
function supportsWebGL2(): boolean {
  if (webgl2 === null) {
    const context = document.createElement("canvas").getContext("webgl2");
    webgl2 = context !== null;
    // Probe only: free the context right away (browsers cap live contexts).
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return webgl2;
}

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(CAPABLE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function canAnimate(): boolean {
  return window.matchMedia(CAPABLE_QUERY).matches && supportsWebGL2();
}

export function HeroBackground() {
  const animate = useSyncExternalStore(subscribe, canAnimate, () => false);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Static base (and the whole effect on mobile / reduced motion). */}
      <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_20%_0%,rgba(37,99,235,0.22),transparent_65%),radial-gradient(50%_40%_at_85%_5%,rgba(96,165,250,0.12),transparent_65%)]" />
      {animate ? (
        // Confined to the top band, dim and slow.
        <div className="absolute inset-x-0 top-0 h-[70%] opacity-60 [mask-image:linear-gradient(to_bottom,#000_40%,transparent)]">
          <Aurora colorStops={AURORA_STOPS} amplitude={0.8} blend={0.7} speed={0.3} height={0.35} glow={0.35} brightness={0.55} layers={2} dpr={1} />
        </div>
      ) : null}
      {/* Legibility veil: darkens behind the copy (left on desktop, everywhere on mobile). */}
      <div className="absolute inset-0 bg-night/35 lg:bg-[linear-gradient(90deg,rgba(11,27,77,0.9)_0%,rgba(11,27,77,0.75)_40%,rgba(11,27,77,0.25)_70%,transparent_100%)]" />
      {/* Fine grid that gives the hero depth without competing with the copy. */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [mask-image:radial-gradient(70%_60%_at_50%_40%,#000,transparent)] bg-[size:56px_56px]" />
      {/* Fade into the page background below the hero. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-night" />
    </div>
  );
}
