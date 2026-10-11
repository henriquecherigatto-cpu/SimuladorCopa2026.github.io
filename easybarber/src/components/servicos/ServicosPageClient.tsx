"use client";

import * as React from "react";
import { Clock, Plus, Scissors } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { professionals, services as initialServices } from "@/lib/mock-data";
import { formatCurrencyBRL } from "@/lib/utils";
import type { Service } from "@/types";

export function ServicosPageClient() {
  const [services, setServices] = React.useState<Service[]>(initialServices);
  const [addOpen, setAddOpen] = React.useState(false);
  const [justAdded, setJustAdded] = React.useState(false);

  const handleAdd = (data: {
    name: string;
    description: string;
    durationMin: number;
    price: number;
  }) => {
    const newService: Service = {
      id: `svc-${Date.now()}`,
      companyId: services[0]?.companyId ?? "company-barber-013",
      name: data.name,
      description: data.description || undefined,
      durationMin: data.durationMin,
      price: data.price,
      active: true,
      professionalIds: [],
    };
    setServices((prev) => [newService, ...prev]);
    setAddOpen(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 4000);
  };

  const toggleActive = (id: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Serviços"
        description={`${services.filter((s) => s.active).length} ativos de ${services.length} cadastrados`}
        action={
          <Button icon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>
            Novo serviço
          </Button>
        }
      />

      {justAdded && (
        <Alert variant="success" title="Serviço cadastrado">
          O novo serviço foi adicionado à lista local de demonstração.
        </Alert>
      )}

      {services.length === 0 ? (
        <Card>
          <EmptyState
            icon={Scissors}
            title="Nenhum serviço cadastrado"
            description="Cadastre os serviços oferecidos pela sua barbearia."
            action={
              <Button size="sm" onClick={() => setAddOpen(true)}>
                Novo serviço
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Card key={s.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-brand-graphite">
                    {s.name}
                  </p>
                  {s.description && (
                    <p className="mt-0.5 text-xs text-brand-graphite/50">
                      {s.description}
                    </p>
                  )}
                </div>
                <button onClick={() => toggleActive(s.id)}>
                  <Badge variant={s.active ? "success" : "neutral"}>
                    {s.active ? "Ativo" : "Inativo"}
                  </Badge>
                </button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-brand-graphite/60">
                  <Clock className="size-3.5" /> {s.durationMin} min
                </span>
                <span className="text-base font-bold text-brand-graphite">
                  {formatCurrencyBRL(s.price)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {s.professionalIds.length === 0 ? (
                  <span className="text-xs text-brand-graphite/40">
                    Nenhum profissional associado
                  </span>
                ) : (
                  s.professionalIds.map((id) => {
                    const p = professionals.find((prof) => prof.id === id);
                    return p ? (
                      <span
                        key={id}
                        className="rounded-full bg-brand-surface px-2 py-0.5 text-[11px] font-medium text-brand-graphite/70"
                      >
                        {p.name}
                      </span>
                    ) : null;
                  })
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddServiceModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd}
      />
    </div>
  );
}

function AddServiceModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (data: {
    name: string;
    description: string;
    durationMin: number;
    price: number;
  }) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Novo serviço">
      {open && <AddServiceFormFields onAdd={onAdd} />}
    </Modal>
  );
}

function AddServiceFormFields({
  onAdd,
}: {
  onAdd: (data: {
    name: string;
    description: string;
    durationMin: number;
    price: number;
  }) => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [duration, setDuration] = React.useState("30");
  const [price, setPrice] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const durationNum = Number(duration);
    const priceNum = Number(price.replace(",", "."));
    if (!name.trim()) return setError("Informe o nome do serviço.");
    if (!durationNum || durationNum <= 0)
      return setError("Informe uma duração válida em minutos.");
    if (!priceNum || priceNum <= 0) return setError("Informe um preço válido.");
    onAdd({ name: name.trim(), description: description.trim(), durationMin: durationNum, price: priceNum });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <Alert variant="error">{error}</Alert>}
      <Input
        label="Nome do serviço"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex: Corte de cabelo"
      />
      <Textarea
        label="Descrição (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descreva brevemente o serviço"
      />
      <div className="grid grid-cols-2 gap-4">
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
          type="text"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="30,00"
        />
      </div>
      <Button type="submit" fullWidth>
        Salvar serviço
      </Button>
    </form>
  );
}
