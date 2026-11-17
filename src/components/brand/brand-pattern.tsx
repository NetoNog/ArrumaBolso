import { cn } from "cn";

/**
 * Brand pattern derived from the symbol: the three ascending bars repeated on a
 * 4-unit grid, shifting phase every row so the field reads as calm, ordered rhythm.
 */
export function BrandPattern({
  className,
  opacity = 0.12,
  id = "ab-bars",
}: {
  className?: string;
  opacity?: number;
  /** Must be unique per page: SVG pattern ids are document-global. */
  id?: string;
}) {
  return (
    <svg aria-hidden="true" className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}>
      <defs>
        <pattern id={id} width="72" height="72" patternUnits="userSpaceOnUse">
          <rect x="8" y="40" width="10" height="20" rx="2" fill="currentColor" opacity={opacity} />
          <rect x="22" y="30" width="10" height="30" rx="2" fill="currentColor" opacity={opacity * 1.6} />
          <rect x="36" y="18" width="10" height="42" rx="2" fill="currentColor" opacity={opacity * 2.2} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
