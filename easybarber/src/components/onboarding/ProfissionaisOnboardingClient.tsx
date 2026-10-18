"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Phone, Plus, UserCog } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { OnboardingStepIndicator } from "@/components/onboarding/OnboardingStepIndicator";
import { createProfessional } from "@/lib/actions/professionals";
import { advanceOnboardingStep } from "@/lib/actions/onboarding";
import { formatBrazilianPhoneInput } from "@/lib/utils";

interface ProfessionalRow {
  id: string;
  name: string;
  phone: string | null;
  role_title: string;
}

export function ProfissionaisOnboardingClient({
  initialProfessionals,
  existingServiceIds,
}: {
  initialProfessionals: ProfessionalRow[];
  existingServiceIds: string[];
}) {
  const router = useRouter();
  const [professionals, setProfessionals] = React.useState(initialProfessionals);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [roleTitle, setRoleTitle] = React.useState("");
  const [addError, setAddError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [continueError, setContinueError] = React.useState<string | null>(null);
  const [continuing, setContinuing] = React.useState(false);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!name.trim()) return setAddError("Informe o nome do profissional.");

    setAdding(true);
    // Linked to every service that exists so far — the barbershop is
    // immediately bookable at the end of this step. The owner can
    // fine-tune who does what later in Profissionais.
    const result = await createProfessional({
      name,
      phone: phone || undefined,
      roleTitle: roleTitle || undefined,
      serviceIds: existingServiceIds,
    });
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }

    setProfessionals((prev) => [
      ...prev,
      { id: result.data.id, name: name.trim(), phone: phone || null, role_title: roleTitle || "Barbeiro" },
    ]);
    setName("");
    setPhone("");
    setRoleTitle("");
  };

  const onFinish = async () => {
    setContinueError(null);
    setContinuing(true);
    const result = await advanceOnboardingStep(2);
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
          <OnboardingStepIndicator current={3} />
          <p className="text-sm text-brand-graphite/60">
            Cadastre os profissionais da sua barbearia. É necessário pelo
            menos um para continuar — você pode adicionar mais a qualquer
            momento depois, em Profissionais.
          </p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
          <h1 className="mb-5 flex items-center gap-2 text-lg font-bold text-brand-graphite">
            <UserCog className="size-5 text-brand-orange" />
            Profissionais
          </h1>

          {professionals.length > 0 && (
            <ul className="mb-5 flex flex-col gap-2">
              {professionals.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-xl bg-brand-surface px-3.5 py-2.5"
                >
                  <Check className="size-4 shrink-0 text-brand-success" />
                  <span className="text-sm font-medium text-brand-graphite">{p.name}</span>
                  <span className="text-xs text-brand-graphite/50">{p.role_title}</span>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={onAdd} className="flex flex-col gap-3">
            {addError && <Alert variant="error">{addError}</Alert>}
            <Input
              label="Nome do profissional"
              placeholder="Ex: João Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Telefone (opcional)"
              type="tel"
              leftIcon={<Phone className="size-4" />}
              placeholder="(19) 9 9999-9999"
              value={phone}
              onChange={(e) => setPhone(formatBrazilianPhoneInput(e.target.value))}
            />
            <Input
              label="Função (opcional)"
              placeholder="Barbeiro"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
            />
            <Button type="submit" variant="secondary" fullWidth loading={adding} icon={<Plus className="size-4" />}>
              Adicionar profissional
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
            disabled={professionals.length === 0}
            onClick={onFinish}
            className="mt-5"
          >
            Concluir cadastro
          </Button>
        </div>
      </div>
    </div>
  );
}
