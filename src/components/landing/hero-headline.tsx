/**
 * The brand promise — rendered directly in HTML (zero client JS / zero LCP delay)
 * with a lightweight CSS entrance animation that respects `prefers-reduced-motion`.
 */
export function HeroHeadline() {
  return (
    <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-white motion-safe:animate-[ab-fade-up_360ms_var(--ease-out-strong)_both] sm:text-5xl lg:text-[3.4rem]">
      Seu dinheiro organizado.{" "}
      <span className="bg-gradient-to-r from-white via-blue-100 to-[#93C5FD] bg-clip-text text-transparent">
        Sem planilha e sem susto na fatura.
      </span>
    </h1>
  );
}
