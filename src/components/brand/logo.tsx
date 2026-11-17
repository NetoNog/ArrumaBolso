import { cn } from "cn";

import {
  SYMBOL_PATH,
  SYMBOL_SMALL_PATH,
  WORDMARK_ARRUMA_PATH,
  WORDMARK_BOLSO_PATH,
  WORDMARK_WIDTH,
} from "@/components/brand/brand-paths";

/** Below this rendered size the small-size cut (two bars) is used. */
const SMALL_CUT_MAX_PX = 32;

/**
 * ArrumaBolso symbol: a pocket holding three ascending bars ("arruma" + "bolso").
 * `tile` draws it white on the brand-blue rounded square (app icon style).
 */
export function BrandMark({
  size = 32,
  variant = "color",
  className,
  title = "ArrumaBolso",
}: {
  size?: number;
  variant?: "color" | "tile" | "current";
  className?: string;
  title?: string;
}) {
  const small = size <= SMALL_CUT_MAX_PX;
  const d = small ? SYMBOL_SMALL_PATH : SYMBOL_PATH;

  if (variant === "tile") {
    const scale = small ? 0.8 : 0.7;
    const offset = (256 - 256 * scale) / 2;
    return (
      <svg viewBox="0 0 256 256" width={size} height={size} role="img" aria-label={title} className={cn("shrink-0", className)}>
        <rect width="256" height="256" rx="56" className="fill-brand" />
        <path d={d} fillRule="evenodd" fill="#FFFFFF" transform={`translate(${offset} ${offset}) scale(${scale})`} />
      </svg>
    );
  }

  return (
    <svg viewBox="28 28 200 200" width={size} height={size} role="img" aria-label={title} className={cn("shrink-0", className)}>
      <path d={d} fillRule="evenodd" className={variant === "current" ? "fill-current" : "fill-brand"} />
    </svg>
  );
}

const LOCKUP_GAP = 56;
const SYMBOL_RIGHT = 216 - 40;
const LOCKUP_WIDTH = SYMBOL_RIGHT + LOCKUP_GAP + WORDMARK_WIDTH;

/**
 * Horizontal lockup with outlined wordmark: "Arruma" follows the foreground
 * colour (ink / white in dark mode), "Bolso" and the symbol use the brand blue.
 */
export function BrandLogo({
  height = 28,
  className,
  monochrome = false,
}: {
  height?: number;
  className?: string;
  monochrome?: boolean;
}) {
  const viewTop = 36;
  const viewHeight = 184;
  const width = (LOCKUP_WIDTH / viewHeight) * height;
  const accent = monochrome ? "fill-current" : "fill-brand";
  return (
    <svg
      viewBox={`0 ${viewTop} ${LOCKUP_WIDTH} ${viewHeight}`}
      width={width}
      height={height}
      role="img"
      aria-label="ArrumaBolso"
      className={cn("shrink-0", className)}
    >
      <path d={SYMBOL_PATH} fillRule="evenodd" transform="translate(-40 0)" className={accent} />
      <g transform={`translate(${SYMBOL_RIGHT + LOCKUP_GAP} 0)`}>
        <path d={WORDMARK_ARRUMA_PATH} className={monochrome ? "fill-current" : "fill-foreground"} />
        <path d={WORDMARK_BOLSO_PATH} className={accent} />
      </g>
    </svg>
  );
}

/** Outlined wordmark only (no symbol). */
export function BrandWordmark({ height = 24, className }: { height?: number; className?: string }) {
  const viewTop = 70;
  const viewHeight = 110;
  return (
    <svg
      viewBox={`0 ${viewTop} ${WORDMARK_WIDTH} ${viewHeight}`}
      width={(WORDMARK_WIDTH / viewHeight) * height}
      height={height}
      role="img"
      aria-label="ArrumaBolso"
      className={cn("shrink-0", className)}
    >
      <path d={WORDMARK_ARRUMA_PATH} className="fill-foreground" />
      <path d={WORDMARK_BOLSO_PATH} className="fill-brand" />
    </svg>
  );
}
