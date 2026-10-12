"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { formatCurrencyBRL } from "@/lib/utils";
import {
  createService,
  setServiceActive,
  updateService,
  type ServiceInput,
} from "@/lib/actions/services";

export interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
  active: boolean;
  professional_services: { professional: { id: string; name: string } | null }[];
}

export function ServicosPageClient({
  initialServices,
  canManage,
}: {
  initialServices: ServiceRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const editingService = initialServices.find((s) => s.id === editId) ?? null;

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleAdd = async (input: ServiceInput) => {
    const result = await createService(input);
    if (!result.ok) return result.error;
    setAddOpen(false);
    flash("Serviço cadastrado com sucesso.");
    router.refresh();
    return null;
  };

  const toggleActive = async (service: ServiceRow) => {
    setTogglingId(service.id);
    const result = await setServiceActive(service.id, !service.active);
    setTogglingId(null);
    if (!result.ok) {
      flash(result.error);
      return;
    }
    router.refresh();
  };

  const activeCount = initialServices.filter((s) => s.active).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Serviços"
        description={`${activeCount} ativos de ${initialServices.length} cadastrados`}
        action={
          canManage && (
            <Button icon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>
              Novo serviço
            </Button>
          )
        }
      />

      {notice && <Alert variant="info">{notice}</Alert>}

      {initialServices.length === 0 ? (
        <Card>
          <EmptyState
            icon={Scissors}
            title="Nenhum serviço cadastrado"
            description="Cadastre os serviços oferecidos pela sua barbearia."
            action={
              canManage && (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  Novo serviço
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initialServices.map((s) => (
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
                <div className="flex shrink-0 items-center gap-2">
                  {canManage && (
                    <button
                      onClick={() => setEditId(s.id)}
                      className="text-xs font-medium text-brand-orange hover:underline"
                    >
                      Editar
                    </button>
                  )}
                  <button
                    onClick={() => canManage && toggleActive(s)}
                    disabled={!canManage || togglingId === s.id}
                  >
                    <Badge variant={s.active ? "success" : "neutral"}>
                      {s.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-brand-graphite/60">
                  <Clock className="size-3.5" /> {s.duration_min} min
                </span>
                <span className="text-base font-bold text-brand-graphite">
                  {formatCurrencyBRL(s.price_cents / 100)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {s.professional_services.length === 0 ? (
                  <span className="text-xs text-brand-graphite/40">
                    Nenhum profissional associado
                  </span>
                ) : (
                  s.professional_services.map(
                    (ps) =>
                      ps.professional && (
                        <span
                          key={ps.professional.id}
                          className="rounded-full bg-brand-surface px-2 py-0.5 text-[11px] font-medium text-brand-graphite/70"
                        >
                          {ps.professional.name}
                        </span>
                      ),
                  )
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddServiceModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      <EditServiceModal
        service={editingService}
        onClose={() => setEditId(null)}
        onSaved={() => {
          setEditId(null);
          flash("Serviço atualizado com sucesso.");
          router.refresh();
        }}
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
  onAdd: (input: ServiceInput) => Promise<string | null>;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Novo serviço">
      {open && <AddServiceFormFields onAdd={onAdd} onClose={onClose} />}
    </Modal>
  );
}

function AddServiceFormFields({
  onAdd,
  onClose,
}: {
  onAdd: (input: ServiceInput) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [duration, setDuration] = React.useState("30");
  const [price, setPrice] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const durationNum = Number(duration);
    const priceNum = Number(price.replace(",", "."));
    if (!name.trim()) return setError("Informe o nome do serviço.");
    if (!durationNum || durationNum <= 0) {
      return setError("Informe uma duração válida em minutos.");
    }
    if (!priceNum || priceNum <= 0) return setError("Informe um preço válido.");

    setSubmitting(true);
    const actionError = await onAdd({
      name: name.trim(),
      description: description.trim(),
      durationMin: durationNum,
      priceCents: Math.round(priceNum * 100),
    });
    setSubmitting(false);
    if (actionError) setError(actionError);
    else onClose();
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
      <Button type="submit" fullWidth loading={submitting}>
        Salvar serviço
      </Button>
    </form>
  );
}

function EditServiceModal({
  service,
  onClose,
  onSaved,
}: {
  service: ServiceRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Modal open={!!service} onClose={onClose} title="Editar serviço">
      {service && (
        <EditServiceFormFields service={service} onClose={onClose} onSaved={onSaved} />
      )}
    </Modal>
  );
}

function EditServiceFormFields({
  service,
  onClose,
  onSaved,
}: {
  service: ServiceRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(service.name);
  const [description, setDescription] = React.useState(service.description ?? "");
  const [duration, setDuration] = React.useState(String(service.duration_min));
  const [price, setPrice] = React.useState((service.price_cents / 100).toFixed(2).replace(".", ","));
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const durationNum = Number(duration);
    const priceNum = Number(price.replace(",", "."));
    if (!name.trim()) return setError("Informe o nome do serviço.");
    if (!durationNum || durationNum <= 0) {
      return setError("Informe uma duração válida em minutos.");
    }
    if (!priceNum || priceNum <= 0) return setError("Informe um preço válido.");

    setSubmitting(true);
    const result = await updateService(service.id, {
      name: name.trim(),
      description: description.trim(),
      durationMin: durationNum,
      priceCents: Math.round(priceNum * 100),
    });
    setSubmitting(false);
    if (!result.ok) setError(result.error);
    else onSaved();
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
      <div className="flex gap-2">
        <Button type="button" variant="secondary" fullWidth onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" fullWidth loading={submitting}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
