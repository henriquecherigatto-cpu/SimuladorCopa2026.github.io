"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { BusinessHoursFields } from "@/components/shared/BusinessHoursFields";
import { OnboardingStepIndicator } from "@/components/onboarding/OnboardingStepIndicator";
import { updateBusinessHours } from "@/lib/actions/companies";
import { advanceOnboardingStep } from "@/lib/actions/onboarding";
import type { BusinessHours } from "@/types";

export function HorariosOnboardingClient({
  initialHours,
}: {
  initialHours: BusinessHours[];
}) {
  const router = useRouter();
  const [hours, setHours] = React.useState(initialHours);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);

    const hoursResult = await updateBusinessHours(hours);
    if (!hoursResult.ok) {
      setSubmitting(false);
      setError(hoursResult.error);
      return;
    }

    const advanceResult = await advanceOnboardingStep(0);
    setSubmitting(false);
    if (!advanceResult.ok) {
      setError(advanceResult.error);
      return;
    }
    router.push(advanceResult.data.nextRoute);
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-surface px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <OnboardingStepIndicator current={1} />
          <p className="text-sm text-brand-graphite/60">
            Confirme o horário de funcionamento da sua barbearia. Você pode
            ajustar isso a qualquer momento depois, em Configurações.
          </p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
          <h1 className="mb-5 flex items-center gap-2 text-lg font-bold text-brand-graphite">
            <Clock className="size-5 text-brand-orange" />
            Horário de funcionamento
          </h1>
          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}
          <BusinessHoursFields hours={hours} onChange={setHours} />
          <Button fullWidth loading={submitting} onClick={onSubmit} className="mt-5">
            Confirmar e continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
