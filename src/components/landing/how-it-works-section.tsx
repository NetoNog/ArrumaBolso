const STEPS = [
  {
    title: "Crie sua conta",
    description: "Gratuita, com e-mail ou Google. A conta começa vazia: os dados são só seus.",
  },
  {
    title: "Importe ou lance",
    description: "Envie o CSV da fatura do Nubank ou registre entradas e saídas à mão, em segundos.",
  },
  {
    title: "Acompanhe e planeje",
    description: "Veja o saldo do mês, receba alertas de duplicidade e planeje os próximos 12 meses.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section id="como-funciona" aria-labelledby="how-title" className="scroll-mt-20 border-t bg-muted/40 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="how-title" className="text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Comece em três passos
        </h2>
        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative rounded-2xl border bg-card p-6 shadow-panel">
              <span className="num flex size-9 items-center justify-center rounded-full bg-[#2563EB] text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
