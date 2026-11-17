"use client";

import { useRouter } from "next/navigation";

import { ImportWizard } from "@/components/import/import-wizard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ImportWizardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar CSV do Nubank</DialogTitle>
          <DialogDescription>
            Conciliação não-destrutiva: nada é gravado antes da sua confirmação, e edições manuais nunca são sobrescritas.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ImportWizard
            compact
            onFinished={() => {
              onOpenChange(false);
              router.push("/");
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
