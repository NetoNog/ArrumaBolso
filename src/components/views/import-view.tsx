"use client";

import { Lock, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { ImportHistory } from "@/components/import/import-history";
import { ImportWizard } from "@/components/import/import-wizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const GUARANTEES = [
  { icon: RefreshCw, title: "Reimportação idempotente", text: "Hash determinístico por linha: o mesmo CSV pode ser importado quantas vezes quiser." },
  { icon: Lock, title: "Edições soberanas", text: "Lançamentos editados ficam protegidos e nunca são sobrescritos." },
  { icon: Trash2, title: "Exclusões respeitadas", text: "O que você apaga entra na lista de bloqueio e não ressuscita." },
  { icon: ShieldCheck, title: "Manuais intocados", text: "Lançamentos criados no app jamais são alterados por uma importação." },
];

export function ImportView() {
  const router = useRouter();
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {GUARANTEES.map((item) => (
          <div key={item.title} className="flex gap-3 rounded-xl border bg-card p-3.5 shadow-panel">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10">
              <item.icon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Nova importação</CardTitle>
          <CardDescription>Upload → relatório de conciliação → confirmação. Nada é gravado antes do último passo.</CardDescription>
        </CardHeader>
        <CardContent>
          <ImportWizard onFinished={() => router.push("/")} />
        </CardContent>
      </Card>
      <ImportHistory />
    </div>
  );
}
