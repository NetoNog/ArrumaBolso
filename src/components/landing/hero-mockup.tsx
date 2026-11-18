"use client";

import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Scale } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

import { Pill } from "@/components/common/pill";
import TiltedCard, { TiltedCardLayer } from "@/components/landing/react-bits/TiltedCard";

/**
 * Illustrative day-by-day movement in hundreds of reais, consistent with the
 * metrics above: inflows sum to 53 (R$ 5.300), outflows to 13 (R$ 1.300), so the
 * running balance ends at 40 (R$ 4.000).
 */
const DAYS: readonly [inflow: number, outflow: number][] = [
  [0, 0.6], [50, 1.4], [0, 0.8], [0, 1.2], [3, 0.4], [0, 1.8], [0, 0.6], [0, 1], [0, 0.3], [0, 1.5], [0, 0.5], [0, 0.9], [0, 0.4], [0, 1.6],
];

/** Running balance after each day (static data, computed once). */
const RUNNING_BALANCE = DAYS.reduce<number[]>((acc, [inflow, outflow]) => [...acc, (acc.at(-1) ?? 0) + inflow - outflow], []);

const PROJECTION: readonly [month: string, free: string][] = [
  ["Jan", "+R$ 2.180"],
  ["Fev", "+R$ 2.430"],
  ["Mar", "+R$ 3.010"],
];

/**
 * A 3D-tilting preview of the dashboard, built from the app's own tokens (card,
 * border, chart colors, Pill) so it looks like the real thing. Static content:
 * the numbers are illustrative and hidden from assistive tech.
 */
export function HeroMockup() {
  return (
    <TiltedCard
      containerWidth="100%"
      containerHeight="var(--mockup-h)"
      imageWidth="100%"
      imageHeight="var(--mockup-h)"
      rotateAmplitude={9}
      scaleOnHover={1.03}
      radius={20}
      perspective={1200}
      glare={0.35}
      shadow={0.6}
      parallax={1}
      showTooltip={false}
      flipOnClick={false}
      gyroscope={false}
      className="[--mockup-h:400px] sm:[--mockup-h:440px]"
    >
      <div aria-hidden="true" className="flex h-full flex-col gap-3 bg-card p-4 text-card-foreground">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 truncate rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">Visão Geral • Fatura Dez/2026</span>
          <Pill tone="blue" className="ml-auto">
            Aberta
          </Pill>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metric icon={<ArrowDownLeft className="size-3.5" />} tone="text-emerald-500" label="Entradas" value="R$ 5.300" />
          <Metric icon={<ArrowUpRight className="size-3.5" />} tone="text-rose-500" label="Saídas" value="R$ 1.300" />
          <Metric icon={<Scale className="size-3.5" />} tone="text-brand" label="Vai sobrar" value="R$ 4.000" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-background/40 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Entradas e Saídas</span>
            <span>no mês</span>
          </div>
          <MiniChart />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {PROJECTION.map(([month, free]) => (
            <div key={month} className="rounded-lg border px-2.5 py-1.5">
              <p className="text-xs text-muted-foreground">Folga {month}</p>
              <p className="num text-sm font-semibold text-emerald-500">{free}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Floats above the dashboard: moves more with the tilt (parallax depth). */}
      <TiltedCardLayer depth={36} className="pointer-events-none">
        <div
          aria-hidden="true"
          className="absolute top-[36%] right-6 hidden max-w-[15rem] sm:flex items-start gap-2 rounded-xl border bg-popover/95 p-3 text-xs shadow-2xl shadow-black/40 backdrop-blur"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          <span>
            <span className="block font-semibold text-foreground">Fatura importada</span>
            <span className="text-muted-foreground">23 novos • 2 duplicados ignorados</span>
          </span>
        </div>
      </TiltedCardLayer>
    </TiltedCard>
  );
}

function Metric({ icon, tone, label, value }: { icon: ReactNode; tone: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/40 p-2.5 shadow-panel">
      <p className={cn("flex items-center gap-1 text-xs font-medium", tone)}>
        {icon}
        {label}
      </p>
      <p className="num pt-1 text-sm font-semibold sm:text-base">{value}</p>
    </div>
  );
}

/** Inflow bars up, outflow bars down, and the running balance, like the app's chart. */
function MiniChart() {
  const width = 280;
  const height = 120;
  const mid = height * 0.62;
  const slot = width / DAYS.length;
  const bar = slot * 0.55;
  // Outflows are small next to a salary, so they get a larger visual scale (illustration, not data).
  const inflowScale = 1;
  const outflowScale = 10;
  const balance = RUNNING_BALANCE.map((value, index) => `${(index * slot + slot / 2).toFixed(1)},${(mid - value * 0.9).toFixed(1)}`);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="mt-2 min-h-0 w-full flex-1">
      <line x1="0" x2={width} y1={mid} y2={mid} stroke="var(--border)" />
      {DAYS.map(([inflow, outflow], index) => {
        const x = index * slot + (slot - bar) / 2;
        return (
          <g key={index}>
            {inflow > 0 ? <rect x={x} y={mid - inflow * inflowScale} width={bar} height={inflow * inflowScale} rx="2" fill="var(--chart-3)" /> : null}
            <rect x={x} y={mid} width={bar} height={outflow * outflowScale} rx="2" fill="var(--chart-5)" opacity="0.9" />
          </g>
        );
      })}
      <polyline points={balance.join(" ")} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
