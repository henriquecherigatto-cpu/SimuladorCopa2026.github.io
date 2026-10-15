import { Scissors } from "lucide-react";

/**
 * Stands in for a stock photo of "a barber at work" in the benefits
 * section — nobody real is depicted, so there's nothing to license or
 * fabricate. Built entirely from brand elements: the same orange/
 * graphite palette, the Logo's scissors mark ghosted large, and a
 * floating card that mirrors the real appointment chips in
 * AgendaDayView (left accent border, status pill, avatar initials)
 * rather than inventing a new visual language.
 */
export function GraphicPanel() {
  return (
    <div className="relative mx-auto flex aspect-[4/3] w-full max-w-md items-center justify-center sm:aspect-square">
      <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-brand-orange/25 via-brand-orange/5 to-transparent" />
      <Scissors
        className="absolute size-64 -rotate-12 text-white/[0.06]"
        strokeWidth={1}
        aria-hidden="true"
      />
      <div className="absolute size-56 rounded-full bg-brand-orange/25 blur-[90px]" aria-hidden="true" />

      <div className="relative w-72 -rotate-2 rounded-2xl border-l-4 border-brand-orange bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-brand-graphite">
            14:30 · João Pedro
          </span>
          <span className="shrink-0 rounded-full bg-brand-success/10 px-2 py-0.5 text-[11px] font-semibold text-brand-success">
            Confirmado
          </span>
        </div>
        <p className="mt-1 text-xs text-brand-graphite/60">Corte + Barba · Carlos Mendes</p>
        <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-3">
          <span className="flex size-7 items-center justify-center rounded-full bg-brand-orange text-[11px] font-bold text-white">
            CM
          </span>
          <span className="text-xs text-brand-graphite/50">R$ 60,00 · 70 min</span>
        </div>
      </div>
    </div>
  );
}
