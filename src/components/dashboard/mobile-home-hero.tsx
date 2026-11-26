"use client";

import { ArrowUpDown, CreditCard, Eye, EyeOff, PawPrint, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { usePrivacy } from "@/components/app/privacy-provider";
import { CategoryIcon } from "@/components/common/category-icon";
import { formatDateBR, formatMonthLabel } from "@/lib/dates";
import { activeCards, closingDayForCard } from "@/lib/domain/operations";
import { CARD_BRAND_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/domain/types";
import {
  cardMonthlySummary,
  cashFlowSummary,
  expensesOfMonth,
  invoiceTotal,
  netExpenseAmount,
  realFreeBalance,
  transactionsOfMonth,
} from "@/lib/finance/metrics";
import { formatBRL, formatPercent, formatSignedBRL } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

interface CarouselSlide {
  key: string;
  label: string;
  amount: string;
  badge: string;
  bottomLeft: string;
  bottomRight: string;
  progressRatio?: number | null;
  progressCaption?: string | null;
  bgStyle?: string;
  cardClassName?: string;
  cardId?: string | null;
}

/**
 * Mobile fintech home experience (< md):
 * swipeable horizontal carousel of Balance + Consolidated Invoice + individual
 * Credit Cards, 4 pastel squircle quick actions, and floating recent transactions.
 */
export function MobileHomeHero() {
  const { state, selectedMonth, today, selectedCardId, setSelectedCardId } = useFinance();
  const { openCreate, openEdit, openImport } = useDialogs();
  const { hidden, toggle: togglePrivacy, mask } = usePrivacy();
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const { hasAccounts, free, flow, invoice, purchasesCount, closingDay, categoriesById, recentTxs, mainCards } = useMemo(() => {
    const accounts = (state.accounts ?? []).some((a) => !a.is_archived);
    const recent = transactionsOfMonth(state, selectedMonth, selectedCardId)
      .filter((tx) => !tx.is_ignored && tx.type !== "payment")
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
      .slice(0, 5);
    return {
      hasAccounts: accounts,
      free: realFreeBalance(state, selectedMonth, today),
      flow: cashFlowSummary(state, selectedMonth),
      invoice: invoiceTotal(state, selectedMonth, selectedCardId),
      purchasesCount: expensesOfMonth(state, selectedMonth, selectedCardId).length,
      closingDay: closingDayForCard(state, selectedCardId),
      categoriesById: new Map(state.categories.map((c) => [c.id, c])),
      recentTxs: recent,
      mainCards: activeCards(state).filter((card) => !card.parent_card_id),
    };
  }, [state, selectedMonth, today, selectedCardId]);
  const cycleShort = `${selectedMonth.slice(5, 7)}/${selectedMonth.slice(2, 4)}`;

  const slides: CarouselSlide[] = [
    {
      key: "balance",
      label: hasAccounts ? "Saldo Livre Real" : `Saldo • ${formatMonthLabel(selectedMonth)}`,
      amount: formatSignedBRL(hasAccounts ? free.freeToSpend : flow.balance),
      badge: "SALDO",
      bottomLeft: hidden
        ? "Entradas ••••  •  Saídas ••••"
        : `Entradas ${formatBRL(flow.inflow)} • Saídas ${formatBRL(flow.outflow)}`,
      bottomRight: `Fecha dia ${String(closingDay).padStart(2, "0")}`,
      cardClassName: "fintech-hero-card",
      cardId: null,
    },
    {
      key: "invoice",
      label: `Fatura • ${formatMonthLabel(selectedMonth)}`,
      amount: formatBRL(invoice),
      badge: "FATURA",
      bottomLeft: `${purchasesCount} compra(s) no ciclo`,
      bottomRight: cycleShort,
      bgStyle: "linear-gradient(135deg, #1E293B 0%, #334155 58%, #0F172A 100%)",
      cardClassName: "fintech-credit-card",
      cardId: null,
    },
    ...mainCards.map((card): CarouselSlide => {
      const s = cardMonthlySummary(state, card, selectedMonth, today);
      return {
        key: `card-${card.id}`,
        label: `Cartão ${card.name}`,
        amount: formatBRL(s.spent),
        badge: card.brand ? CARD_BRAND_LABEL[card.brand].toUpperCase() : "CARTÃO",
        bottomLeft: card.last_four ? `••••  ••••  ••••  ${card.last_four}` : `${s.count} compra(s) no mês`,
        bottomRight: s.daysToClose !== null ? `Fecha em ${s.daysToClose}d` : cycleShort,
        progressRatio: s.limitRatio,
        progressCaption:
          s.limit && s.limitRatio !== null
            ? `${formatPercent(s.limitRatio)} do limite • Disp. ${mask(formatBRL(s.limitAvailable ?? 0))}`
            : null,
        bgStyle: `linear-gradient(135deg, ${card.color} 0%, ${card.color}DD 52%, #0F172A 100%)`,
        cardClassName: "fintech-credit-card",
        cardId: card.id,
      };
    }),
  ];

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el || slides.length <= 1) return;
    const width = el.clientWidth * 0.92;
    if (width <= 0) return;
    const idx = Math.min(slides.length - 1, Math.max(0, Math.round(el.scrollLeft / width)));
    if (idx !== activeSlide) setActiveSlide(idx);
  }

  function scrollToSlide(idx: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const child = el.children[idx] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setActiveSlide(idx);
  }

  return (
    <div className="grid gap-5 md:hidden">
      {/* Swipeable Wallet & Cards Carousel */}
      <section className="grid gap-2.5" aria-label="Cartões e saldo">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide) => (
            <div
              key={slide.key}
              style={slide.bgStyle ? { background: slide.bgStyle } : undefined}
              onClick={() => {
                if (slide.cardId) {
                  setSelectedCardId(selectedCardId === slide.cardId ? null : slide.cardId);
                }
              }}
              className={cn(
                "relative shrink-0 snap-center overflow-hidden rounded-[26px] p-5 text-white select-none",
                slide.cardClassName,
                slides.length > 1 ? "w-[92%]" : "w-full",
                slide.cardId && selectedCardId === slide.cardId && "ring-2 ring-white/80",
              )}
            >
              <span aria-hidden className="pointer-events-none absolute -top-12 -right-8 size-44 rounded-full bg-white/14" />
              <span aria-hidden className="pointer-events-none absolute -right-14 -bottom-16 size-48 rounded-full bg-white/8" />

              <div className="relative flex items-start justify-between gap-2">
                <div className="min-w-0 grid gap-1">
                  <span className="truncate text-xs font-medium text-white/95">{slide.label}</span>
                  <p className="num text-[30px] leading-tight font-bold tracking-tight">{mask(slide.amount)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePrivacy();
                    }}
                    className="flex size-7 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-xs active:scale-95"
                  >
                    {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                  <span className="rounded-lg bg-white/15 px-2.5 py-1 text-[10.5px] font-bold tracking-wider italic backdrop-blur-xs">
                    {slide.badge}
                  </span>
                </div>
              </div>

              {slide.progressRatio !== undefined && slide.progressRatio !== null ? (
                <div className="relative mt-4 grid gap-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${Math.min(slide.progressRatio, 1) * 100}%` }}
                    />
                  </div>
                  {slide.progressCaption ? (
                    <span className="num text-[10.5px] text-white/95">{slide.progressCaption}</span>
                  ) : null}
                </div>
              ) : null}

              <div className="relative mt-5 flex items-end justify-between gap-2 text-xs text-white/95">
                <span className="num truncate font-medium tracking-wide">{slide.bottomLeft}</span>
                <span className="num shrink-0 font-semibold">{slide.bottomRight}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Carousel indicator dots */}
        {slides.length > 1 ? (
          <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Selecionar cartão">
            {slides.map((slide, idx) => (
              <button
                key={slide.key}
                type="button"
                role="tab"
                aria-selected={activeSlide === idx}
                aria-label={slide.label}
                onClick={() => scrollToSlide(idx)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  activeSlide === idx ? "w-5 bg-brand" : "w-1.5 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
        ) : null}
      </section>

      {/* 4 Pastel Squircle Quick-Action Buttons */}
      <section className="grid grid-cols-4 gap-3" aria-label="Ações rápidas">
        <button
          type="button"
          onClick={() => openCreate({ type: "expense", invoice_month: selectedMonth })}
          className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
        >
          <span className="tile-rose flex size-14 items-center justify-center rounded-[18px] shadow-xs">
            <ArrowUpDown className="size-5" />
          </span>
          <span className="text-[11.5px] font-medium text-foreground/85">Lançar</span>
        </button>

        <button
          type="button"
          onClick={openImport}
          className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
        >
          <span className="tile-blue flex size-14 items-center justify-center rounded-[18px] shadow-xs">
            <Upload className="size-5" />
          </span>
          <span className="text-[11.5px] font-medium text-foreground/85">Importar</span>
        </button>

        <Link
          href="/faturas"
          className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
        >
          <span className="tile-amber flex size-14 items-center justify-center rounded-[18px] shadow-xs">
            <CreditCard className="size-5" />
          </span>
          <span className="text-[11.5px] font-medium text-foreground/85">Faturas</span>
        </Link>

        <Link
          href="/meu-pet"
          className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
        >
          <span className="tile-emerald flex size-14 items-center justify-center rounded-[18px] shadow-xs">
            <PawPrint className="size-5" />
          </span>
          <span className="text-[11.5px] font-medium text-foreground/85">Meu Pet</span>
        </Link>
      </section>

      {/* Floating Recent Transactions ("Últimos Lançamentos") */}
      <section className="grid gap-3" aria-label="Últimos lançamentos">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-foreground">Últimos Lançamentos</h2>
          <Link href="/lancamentos" className="text-xs font-semibold text-brand hover:underline">
            Ver tudo
          </Link>
        </div>

        {recentTxs.length === 0 ? (
          <div className="fintech-mobile-card border border-border/60 px-4 py-7 text-center text-xs text-muted-foreground">
            Nenhum lançamento em {formatMonthLabel(selectedMonth)}. Toque no botão azul abaixo para registrar!
          </div>
        ) : (
          <ul className="grid gap-2.5">
            {recentTxs.map((tx) => {
              const cat = tx.category_id ? categoriesById.get(tx.category_id) : undefined;
              const isIncome = tx.type === "income";
              const displayAmount = isIncome ? tx.amount : netExpenseAmount(state, tx);
              const signed = `${isIncome ? "+" : "-"}${formatBRL(Math.abs(displayAmount))}`;
              return (
                <li key={tx.id}>
                  <button
                    type="button"
                    onClick={() => openEdit(tx.id)}
                    className="fintech-mobile-card flex w-full items-center gap-3 border border-border/50 px-3.5 py-3 text-left transition-transform active:scale-[0.99]"
                  >
                    <CategoryIcon
                      icon={cat?.icon ?? (isIncome ? "trending-up" : "tag")}
                      color={cat?.color ?? (isIncome ? "#10B981" : "#4070F4")}
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{tx.clean_title}</p>
                      <p className="num text-xs text-muted-foreground">{formatDateBR(tx.date)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("num text-sm font-bold", isIncome ? "text-positive" : "text-foreground")}>
                        {mask(signed)}
                      </p>
                      <p className="max-w-[96px] truncate text-[11px] text-muted-foreground">
                        {cat?.name ?? PAYMENT_METHOD_LABEL[tx.payment_method]}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
