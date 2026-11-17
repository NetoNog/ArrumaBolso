"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { NAV_GROUPS } from "@/components/app/navigation";
import { SourceBadge } from "@/components/common/source-badge";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDialogs } from "@/components/app/dialogs-provider";
import { formatDateBR, formatMonthLabel } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { state } = useFinance();
  const { openEdit } = useDialogs();
  const router = useRouter();

  const recent = useMemo(
    () => [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 300),
    [state.transactions],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Busca global" description="Buscar lançamento ou loja">
      <Command>
        <CommandInput placeholder="Buscar lançamento, loja ou página..." />
        <CommandList className="max-h-96">
          <CommandEmpty>Nenhum resultado.</CommandEmpty>
          <CommandGroup heading="Lançamentos">
            {recent.map((tx) => (
              <CommandItem
                key={tx.id}
                value={`${tx.clean_title} ${tx.raw_title} ${tx.id}`}
                onSelect={() => {
                  onOpenChange(false);
                  openEdit(tx.id);
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate font-medium">{tx.clean_title}</span>
                  <SourceBadge tx={tx} />
                </div>
                <span className="num text-xs text-muted-foreground">
                  {formatDateBR(tx.date)} • {formatMonthLabel(tx.invoice_month)}
                </span>
                <span className="num w-24 text-right text-sm">{formatBRL(tx.amount)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Páginas">
            {NAV_GROUPS.flatMap((group) => group.items).map((item) => (
              <CommandItem
                key={item.href}
                value={`ir para ${item.label}`}
                onSelect={() => {
                  onOpenChange(false);
                  router.push(item.href);
                }}
              >
                <item.icon />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
