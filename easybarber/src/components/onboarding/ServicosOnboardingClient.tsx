"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Plus, Scissors } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { OnboardingStepIndicator } from "@/components/onboarding/OnboardingStepIndicator";
import { createService } from "@/lib/actions/services";
import { advanceOnboardingStep } from "@/lib/actions/onboarding";
import { formatCurrencyBRL } from "@/lib/utils";

interface ServiceRow {
  id: string;
  name: string;
  duration_min: number;
  price_cents: number;
}

export function ServicosOnboardingClient({
  initialServices,
}: {
  initialServices: ServiceRow[];
}) {
  const router = useRouter();
  const [services, setServices] = React.useState(initialServices);
  const [name, setName] = React.useState("");
  const [duration, setDuration] = React.useState("30");
  const [price, setPrice] = React.useState("");
  const [addError, setAddError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [continueError, setContinueError] = React.useState<string | null>(null);
  const [continuing, setContinuing] = React.useState(false);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!name.trim()) return setAddError("Informe o nome do serviço.");
    const durationNum = Number(duration);
    if (!durationNum || durationNum <= 0) {
      return setAddError("Informe uma duração válida em minutos.");
    }
    const priceNum = Number(price.replace(",", "."));
    if (!priceNum || priceNum <= 0) return setAddError("Informe um preço válido.");

    setAdding(true);
    const result = await createService({
      name,
      durationMin: durationNum,
      priceCents: Math.round(priceNum * 100),
    });
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }

    setServices((prev) => [
      ...prev,
      { id: result.data.id, name: name.trim(), duration_min: durationNum, price_cents: Math.round(priceNum * 100) },
    ]);
    setName("");
    setDuration("30");
    setPrice("");
  };

  const onContinue = async () => {
    setContinueError(null);
    setContinuing(true);
    const result = await advanceOnboardingStep(1);
    setContinuing(false);
    if (!result.ok) {
      setContinueError(result.error);
      return;
    }
    router.push(result.data.nextRoute);
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-surface px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <OnboardingStepIndicator current={2} />
          <p className="text-sm text-brand-graphite/60">
            Cadastre os serviços que sua barbearia oferece. É necessário pelo
            menos um para continuar — você pode adicionar mais a qualquer
            momento depois, em Serviços.
          </p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
          <h1 className="mb-5 flex items-center gap-2 text-lg font-bold text-brand-graphite">
            <Scissors className="size-5 text-brand-orange" />
            Serviços
          </h1>

          {services.length > 0 && (
            <ul className="mb-5 flex flex-col gap-2">
              {services.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-brand-surface px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-brand-success" />
                    <span className="text-sm font-medium text-brand-graphite">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-brand-graphite/60">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" /> {s.duration_min} min
                    </span>
                    <span>{formatCurrencyBRL(s.price_cents / 100)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={onAdd} className="flex flex-col gap-3">
            {addError && <Alert variant="error">{addError}</Alert>}
            <Input
              label="Nome do serviço"
              placeholder="Ex: Corte de cabelo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Duração (min)"
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
              <Input
                label="Preço (R$)"
                placeholder="0,00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" fullWidth loading={adding} icon={<Plus className="size-4" />}>
              Adicionar serviço
            </Button>
          </form>

          {continueError && (
            <Alert variant="error" className="mt-4">
              {continueError}
            </Alert>
          )}
          <Button
            fullWidth
            loading={continuing}
            disabled={services.length === 0}
            onClick={onContinue}
            className="mt-5"
          >
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
