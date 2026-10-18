import { cn } from "@/lib/utils";

/**
 * Progress dots for the 3-step mandatory wizard that runs after
 * payment (horários -> serviços -> profissionais) — the payment step
 * itself has its own separate UI, so this only counts these three.
 */
export function OnboardingStepIndicator({
  current,
  total = 3,
}: {
  current: number;
  total?: number;
}) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Etapa ${current} de ${total}`}>
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <span
          key={step}
          className={cn(
            "h-1.5 rounded-full transition-all",
            step === current
              ? "w-6 bg-brand-orange"
              : step < current
                ? "w-1.5 bg-brand-orange/40"
                : "w-1.5 bg-black/10",
          )}
        />
      ))}
    </div>
  );
}
