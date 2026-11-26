"use client";

import { Lock, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { ImportHistory } from "@/components/import/import-history";
import { ImportWizard } from "@/components/import/import-wizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const GUARANTEES = [
  { icon: RefreshCw, title: "Sem duplicar", text: "Pode importar a mesma fatura quantas vezes quiser: o que já existe é ignorado." },
  { icon: Lock, title: "Suas edições ficam", text: "Lançamentos que você editou nunca são sobrescritos." },
  { icon: Trash2, title: "Exclusões respeitadas", text: "O que você apagou não volta em novas importações." },
  { icon: ShieldCheck, title: "Manuais intocados", text: "Gastos lançados à mão no app nunca são alterados." },
];

export function ImportView() {
  const router = useRouter();
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Nova importação</CardTitle>
          <CardDescription>
            Envie a fatura em CSV ou OFX: identificamos o banco, o cartão e as categorias. Nada é gravado antes da sua confirmação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportWizard onFinished={() => router.push("/")} />
        </CardContent>
      </Card>

      <ImportHistory />

      <section aria-labelledby="import-guarantees" className="grid gap-3">
        <h2 id="import-guarantees" className="text-sm font-semibold">
          Sua importação é segura
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {GUARANTEES.map((item) => (
            <li key={item.title} className="flex gap-3 rounded-xl border bg-card p-3.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10">
                <item.icon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
