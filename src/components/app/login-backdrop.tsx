import { SYMBOL_PATH, SYMBOL_SMALL_PATH } from "@/components/brand/brand-paths";

// The symbol path is the pocket followed by the three bars; split it so each part
// can be staged on its own.
const [POCKET_PATH] = SYMBOL_PATH.split(/ (?=M)/);

/** Bars from the symbol grid (x, y, height) — width 26, gap 10, shared base at 170. */
const BARS: readonly [number, number, number][] = [
  [79, 108, 62],
  [115, 76, 94],
  [151, 40, 130],
];

const EASE = "cubic-bezier(0.22,1,0.36,1)";

/**
 * Decorative brand shapes for the login screen, all cut from the ArrumaBolso
 * symbol: the pocket as a giant arc, the ascending bars as diagonal blades,
 * and two overlapping symbols fading into the corner.
 */
export function LoginBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Soft light behind the form keeps the centre calm. */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_45%,rgba(37,99,235,0.10)_0%,transparent_70%)]" />

      {/* Pocket arc, opening off-screen to the left. On phones it is the only shape, kept faint behind the form. */}
      <div
        className="absolute top-1/2 left-0 size-[min(115vh,1100px,70vw)] -translate-x-[58%] -translate-y-1/2 opacity-20 lg:opacity-100 motion-safe:animate-[ab-slide-in_900ms_both]"
        style={{ animationTimingFunction: EASE }}
      >
        <svg viewBox="40 96 176 120" preserveAspectRatio="xMidYMid meet" className="h-full w-full -rotate-90">
          <path d={POCKET_PATH} fill="#2563EB" />
        </svg>
      </div>

      {/* Accent dot. */}
      <span
        className="absolute top-[9%] left-[6%] hidden size-14 rounded-full bg-[#93C5FD] lg:block motion-safe:animate-[ab-fade-up_700ms_300ms_both]"
        style={{ animationTimingFunction: EASE }}
      />

      {/* Ascending bars as diagonal blades, cut by the top-right edge. */}
      <div className="absolute -top-[14vh] -right-[6vw] hidden size-[min(62vh,560px,40vw)] rotate-[35deg] lg:block">
        <svg viewBox="70 30 120 150" className="h-full w-full">
          {BARS.map(([x, y, height], index) => (
            <rect
              key={x}
              x={x}
              y={y}
              width={26}
              height={height}
              rx={3}
              fill="#2563EB"
              className="[transform-box:fill-box] [transform-origin:bottom] motion-safe:animate-[ab-rise_800ms_both]"
              style={{ animationDelay: `${200 + index * 120}ms`, animationTimingFunction: EASE }}
            />
          ))}
        </svg>
      </div>

      {/* Two overlapping symbols fading into the bottom-right corner. */}
      <div
        className="absolute -right-[7vw] -bottom-[16vh] hidden size-[min(52vh,480px,36vw)] rotate-[-14deg] lg:block motion-safe:animate-[ab-fade-up_900ms_250ms_both]"
        style={{ animationTimingFunction: EASE }}
      >
        <svg viewBox="28 28 200 200" className="h-full w-full">
          <path d={SYMBOL_PATH} fillRule="evenodd" fill="#2563EB" opacity={0.22} />
        </svg>
      </div>
      <div
        className="absolute right-[6vw] bottom-[3vh] hidden size-[min(24vh,220px,16vw)] rotate-[-14deg] lg:block motion-safe:animate-[ab-fade-up_900ms_400ms_both]"
        style={{ animationTimingFunction: EASE }}
      >
        <svg viewBox="28 28 200 200" className="h-full w-full">
          <path d={SYMBOL_SMALL_PATH} fillRule="evenodd" fill="#3B82F6" opacity={0.45} />
        </svg>
      </div>
    </div>
  );
}
