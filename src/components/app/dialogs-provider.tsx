"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { GlobalSearch } from "@/components/app/global-search";
import { ImportWizardDialog } from "@/components/import/import-wizard-dialog";
import { DeleteTransactionsDialog } from "@/components/transactions/delete-transactions-dialog";
import { TransactionFormDialog, type TransactionFormDefaults } from "@/components/transactions/transaction-form-dialog";
import { useFinance } from "@/lib/store/finance-store";

interface DialogsContextValue {
  openCreate: (defaults?: TransactionFormDefaults) => void;
  openEdit: (transactionId: string) => void;
  openDelete: (transactionIds: string[], onDeleted?: () => void) => void;
  openImport: () => void;
  openSearch: () => void;
}

const DialogsContext = createContext<DialogsContextValue | null>(null);

type FormState = { open: false } | { open: true; transactionId: string | null; defaults?: TransactionFormDefaults };

export function DialogsProvider({ children }: { children: ReactNode }) {
  const { state } = useFinance();
  const [form, setForm] = useState<FormState>({ open: false });
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [onDeleted, setOnDeleted] = useState<(() => void) | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const openCreate = useCallback((defaults?: TransactionFormDefaults) => setForm({ open: true, transactionId: null, defaults }), []);
  const openEdit = useCallback((transactionId: string) => setForm({ open: true, transactionId }), []);
  const openDelete = useCallback((ids: string[], callback?: () => void) => {
    setDeleteIds(ids);
    setOnDeleted(() => callback);
  }, []);
  const openImport = useCallback(() => setImportOpen(true), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);

  const value = useMemo(
    () => ({ openCreate, openEdit, openDelete, openImport, openSearch }),
    [openCreate, openEdit, openDelete, openImport, openSearch],
  );

  const editing = form.open && form.transactionId ? (state.transactions.find((tx) => tx.id === form.transactionId) ?? null) : null;

  return (
    <DialogsContext.Provider value={value}>
      {children}
      <TransactionFormDialog
        open={form.open}
        onOpenChange={(open) => {
          if (!open) setForm({ open: false });
        }}
        transaction={editing}
        defaults={form.open ? form.defaults : undefined}
      />
      <DeleteTransactionsDialog
        ids={deleteIds}
        onOpenChange={(open) => {
          if (!open) setDeleteIds(null);
        }}
        onDeleted={onDeleted}
      />
      <ImportWizardDialog open={importOpen} onOpenChange={setImportOpen} />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </DialogsContext.Provider>
  );
}

export function useDialogs(): DialogsContextValue {
  const context = useContext(DialogsContext);
  if (!context) throw new Error("useDialogs must be used inside <DialogsProvider>.");
  return context;
}
