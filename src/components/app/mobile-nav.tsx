"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  LayoutGrid,
  PawPrint,
  PieChart,
  Plus,
  Sparkles,
  Upload,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { Pill } from "@/components/common/pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createTransaction,
  ensurePetCategory,
  resolveOrCreatePresetCategory,
} from "@/lib/domain/operations";
import { parseQuickAdd } from "@/lib/domain/quick-add";
import { formatBRL } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const LEFT_TABS: readonly Tab[] = [
  { href: "/", label: "Início", icon: LayoutGrid },
  { href: "/analises", label: "Análises", icon: PieChart },
];
const RIGHT_TABS: readonly Tab[] = [
  { href: "/fluxo", label: "Fluxo", icon: ArrowLeftRight },
];
const TAB_HREFS = new Set([...LEFT_TABS, ...RIGHT_TABS].map((tab) => tab.href));

const ITEM_CLASS =
  "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10.5px] font-medium transition-all duration-150 active:scale-95";

function ActiveDot() {
  return <span className="absolute bottom-1 size-1 rounded-full bg-brand transition-all duration-150" aria-hidden />;
}

/**
 * Fintech mobile bottom navigation (< lg) with elevated royal-blue center button
 * opening a native Quick Action Sheet (Despesa, Receita, Meu Pet, Importar + Quick Add).
 */
export function MobileNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { openCreate, openImport } = useDialogs();
  const { state, commit, selectedMonth, today } = useFinance();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quickText, setQuickText] = useState("");
  const moreActive = !TAB_HREFS.has(pathname);
  const parsedQuick = parseQuickAdd(quickText, state);

  function launchQuick(event: FormEvent) {
    event.preventDefault();
    if (!parsedQuick) return;
    commit((current) => {
      const resolved = resolveOrCreatePresetCategory(current, parsedQuick.categoryId);
      return createTransaction(resolved.state, {
        type: parsedQuick.type,
        payment_method: parsedQuick.paymentMethod,
        card_id: parsedQuick.cardId,
        account_id: parsedQuick.accountId,
        pet_id: parsedQuick.petId,
        pet_expense_kind: parsedQuick.petExpenseKind,
        date: today,
        invoice_month: selectedMonth,
        title: parsedQuick.title,
        amount: parsedQuick.amount,
        category_id: resolved.categoryId,
        notes: "",
        tags: parsedQuick.tags,
        recurrence: { kind: "single" },
      });
    });
    toast.success(`${parsedQuick.title} lançado (${formatBRL(parsedQuick.amount)})`);
    setQuickText("");
    setSheetOpen(false);
  }

  function startPetExpense() {
    let petCategoryId: string | null = null;
    commit((current) => {
      const ensured = ensurePetCategory(current);
      petCategoryId = ensured.categoryId;
      return ensured.state;
    });
    const defaultPetId = (state.pets ?? []).find((p) => !p.is_archived)?.id ?? null;
    setSheetOpen(false);
    openCreate({
      type: "expense",
      invoice_month: selectedMonth,
      category_id: petCategoryId,
      pet_id: defaultPetId,
    });
  }

  return (
    <>
      <nav
        aria-label="Navegação inferior"
        className="fixed inset-x-0 bottom-0 z-40 rounded-t-[26px] border-t border-border/80 bg-card/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-10px_30px_-8px_rgba(15,23,42,0.1)] backdrop-blur-lg dark:border-white/[0.08] lg:hidden"
      >
        <div className="mx-auto flex h-[66px] max-w-xl items-center px-2">
          {LEFT_TABS.map((tab) => (
            <TabLink key={tab.href} tab={tab} active={pathname === tab.href} />
          ))}

          {/* Raised circular accent-aware center action button */}
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              aria-label="Ações rápidas"
              onClick={() => setSheetOpen(true)}
              className="fintech-hero-card -mt-7 flex size-14 items-center justify-center rounded-full text-white ring-[5px] ring-background transition-transform duration-150 active:scale-90"
            >
              <Plus className={cn("size-6 stroke-[2.5] transition-transform duration-200", sheetOpen && "rotate-45")} />
            </button>
          </div>

          {RIGHT_TABS.map((tab) => (
            <TabLink key={tab.href} tab={tab} active={pathname === tab.href} />
          ))}

          <button
            type="button"
            onClick={onOpenMenu}
            aria-current={moreActive ? "page" : undefined}
            className={cn(ITEM_CLASS, moreActive ? "text-brand" : "text-muted-foreground")}
          >
            <User className="size-[21px]" />
            <span>Menu</span>
            {moreActive ? <ActiveDot /> : null}
          </button>
        </div>
      </nav>

      {/* Native Quick Action Sheet */}
      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo registro</DialogTitle>
            <DialogDescription>Escolha um atalho ou digite diretamente no lançamento rápido.</DialogDescription>
          </DialogHeader>

          <form onSubmit={launchQuick} className="grid gap-2">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Zap className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-amber-500" />
                <Input
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  placeholder='Ex.: "45,90 padaria pix #cafe"'
                  className="h-10 rounded-xl pl-8 text-sm"
                />
              </div>
              <Button type="submit" size="sm" disabled={!parsedQuick} className="h-10 rounded-xl bg-brand px-3.5 text-white hover:bg-blue-700">
                <Sparkles className="size-4" />
              </Button>
            </div>
            {parsedQuick ? (
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <Pill tone={parsedQuick.type === "income" ? "emerald" : "blue"}>{formatBRL(parsedQuick.amount)}</Pill>
                <Pill tone="slate">{parsedQuick.title}</Pill>
                {parsedQuick.categoryLabel ? <Pill tone="violet">{parsedQuick.categoryLabel}</Pill> : null}
                {parsedQuick.petName ? <Pill tone="amber">🐾 {parsedQuick.petName}</Pill> : null}
              </div>
            ) : null}
          </form>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                openCreate({ type: "expense", invoice_month: selectedMonth });
              }}
              className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface-subtle p-3.5 text-left transition-all active:scale-95 hover:border-negative/30"
            >
              <span className="tile-rose flex size-10 shrink-0 items-center justify-center rounded-xl">
                <ArrowUpRight className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Despesa</span>
                <span className="block text-[11px] text-muted-foreground">Cartão, Pix, dinheiro</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                openCreate({ type: "income", invoice_month: selectedMonth });
              }}
              className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface-subtle p-3.5 text-left transition-all active:scale-95 hover:border-positive/30"
            >
              <span className="tile-emerald flex size-10 shrink-0 items-center justify-center rounded-xl">
                <ArrowDownLeft className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Receita</span>
                <span className="block text-[11px] text-muted-foreground">Salário, freela, reembolso</span>
              </span>
            </button>

            <button
              type="button"
              onClick={startPetExpense}
              className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface-subtle p-3.5 text-left transition-all active:scale-95 hover:border-warning/30"
            >
              <span className="tile-amber flex size-10 shrink-0 items-center justify-center rounded-xl">
                <PawPrint className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Meu Pet</span>
                <span className="block text-[11px] text-muted-foreground">Ração, vet, banho</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                openImport();
              }}
              className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface-subtle p-3.5 text-left transition-all active:scale-95 hover:border-brand/30"
            >
              <span className="tile-blue flex size-10 shrink-0 items-center justify-center rounded-xl">
                <Upload className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Importar</span>
                <span className="block text-[11px] text-muted-foreground">Fatura CSV / OFX</span>
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(ITEM_CLASS, active ? "text-brand" : "text-muted-foreground")}
    >
      <Icon className={cn("size-[21px]", active && "stroke-[2.25]")} />
      <span>{tab.label}</span>
      {active ? <ActiveDot /> : null}
    </Link>
  );
}
