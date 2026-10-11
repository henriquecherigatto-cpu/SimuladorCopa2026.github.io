"use client";

import * as React from "react";
import { Phone, Plus, UserCog } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  professionals as initialProfessionals,
  services,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { Professional } from "@/types";

const PALETTE = ["#FF6B1A", "#2563EB", "#16803C", "#9333EA", "#DC2626", "#0E7490"];

export function ProfissionaisPageClient() {
  const [professionals, setProfessionals] = React.useState<Professional[]>(
    initialProfessionals,
  );
  const [addOpen, setAddOpen] = React.useState(false);
  const [detailsId, setDetailsId] = React.useState<string | null>(null);
  const [justAdded, setJustAdded] = React.useState(false);

  const details = professionals.find((p) => p.id === detailsId) ?? null;

  const handleAdd = (data: {
    name: string;
    phone: string;
    role: string;
    serviceIds: string[];
  }) => {
    const newProfessional: Professional = {
      id: `prof-${Date.now()}`,
      companyId: professionals[0]?.companyId ?? "company-barber-013",
      name: data.name,
      phone: data.phone,
      role: data.role || "Barbeiro",
      color: PALETTE[professionals.length % PALETTE.length],
      active: true,
      serviceIds: data.serviceIds,
      workHours: { start: "09:00", end: "18:00" },
      daysOff: ["Domingo"],
      appointmentsCount: 0,
    };
    setProfessionals((prev) => [newProfessional, ...prev]);
    setAddOpen(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 4000);
  };

  const toggleActive = (id: string) => {
    setProfessionals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Profissionais"
        description={`${professionals.filter((p) => p.active).length} ativos de ${professionals.length} cadastrados`}
        action={
          <Button icon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>
            Novo profissional
          </Button>
        }
      />

      {justAdded && (
        <Alert variant="success" title="Profissional cadastrado">
          O novo profissional foi adicionado à lista local de demonstração.
        </Alert>
      )}

      {professionals.length === 0 ? (
        <Card>
          <EmptyState
            icon={UserCog}
            title="Nenhum profissional cadastrado"
            description="Cadastre os profissionais que atendem na sua barbearia."
            action={
              <Button size="sm" onClick={() => setAddOpen(true)}>
                Novo profissional
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-black/5">
            {professionals.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setDetailsId(p.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-brand-surface sm:px-5"
                >
                  <Avatar name={p.name} color={p.color} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-graphite">
                      {p.name}
                    </p>
                    <p className="truncate text-xs text-brand-graphite/50">
                      {p.role} · {p.appointmentsCount} agendamentos
                    </p>
                  </div>
                  <Badge variant={p.active ? "success" : "neutral"}>
                    {p.active ? "Ativo" : "Inativo"}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <AddProfessionalModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd}
      />
      <ProfessionalDetailsModal
        professional={details}
        onClose={() => setDetailsId(null)}
        onToggleActive={() => details && toggleActive(details.id)}
      />
    </div>
  );
}

function AddProfessionalModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (data: {
    name: string;
    phone: string;
    role: string;
    serviceIds: string[];
  }) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Novo profissional">
      {open && <AddProfessionalFormFields onAdd={onAdd} />}
    </Modal>
  );
}

function AddProfessionalFormFields({
  onAdd,
}: {
  onAdd: (data: {
    name: string;
    phone: string;
    role: string;
    serviceIds: string[];
  }) => void;
}) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [role, setRole] = React.useState("");
  const [selectedServices, setSelectedServices] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Nome e telefone são obrigatórios.");
      return;
    }
    onAdd({ name: name.trim(), phone: phone.trim(), role: role.trim(), serviceIds: selectedServices });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <Alert variant="error">{error}</Alert>}
      <Input
        label="Nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome do profissional"
      />
      <Input
        label="Telefone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="(19) 99999-9999"
      />
      <Input
        label="Função (opcional)"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Ex: Barbeiro"
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-brand-graphite">
          Serviços oferecidos
        </span>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => toggleService(s.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                selectedServices.includes(s.id)
                  ? "border-brand-orange bg-brand-orange/10 text-brand-orange-dark"
                  : "border-black/10 text-brand-graphite/60",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
      <Button type="submit" fullWidth>
        Salvar profissional
      </Button>
    </form>
  );
}

function ProfessionalDetailsModal({
  professional,
  onClose,
  onToggleActive,
}: {
  professional: Professional | null;
  onClose: () => void;
  onToggleActive: () => void;
}) {
  return (
    <Modal open={!!professional} onClose={onClose} title="Detalhes do profissional">
      {professional && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar name={professional.name} color={professional.color} size="lg" />
            <div>
              <p className="text-base font-semibold text-brand-graphite">
                {professional.name}
              </p>
              <p className="text-sm text-brand-graphite/60">{professional.role}</p>
              <p className="flex items-center gap-1.5 text-sm text-brand-graphite/60">
                <Phone className="size-3.5" /> {professional.phone}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-brand-graphite">
              Serviços oferecidos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {professional.serviceIds.length === 0 ? (
                <p className="text-sm text-brand-graphite/50">Nenhum serviço associado.</p>
              ) : (
                professional.serviceIds.map((id) => {
                  const s = services.find((svc) => svc.id === id);
                  return s ? <Badge key={id}>{s.name}</Badge> : null;
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-brand-surface p-3">
              <p className="text-xs text-brand-graphite/50">Horário de trabalho</p>
              <p className="font-medium text-brand-graphite">
                {professional.workHours.start} – {professional.workHours.end}
              </p>
            </div>
            <div className="rounded-xl bg-brand-surface p-3">
              <p className="text-xs text-brand-graphite/50">Folgas</p>
              <p className="font-medium text-brand-graphite">
                {professional.daysOff.join(", ") || "Nenhuma"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-black/10 p-3">
            <div>
              <p className="text-sm font-medium text-brand-graphite">
                {professional.active ? "Profissional ativo" : "Profissional inativo"}
              </p>
              <p className="text-xs text-brand-graphite/50">
                Inativar não apaga o histórico de agendamentos.
              </p>
            </div>
            <Button
              size="sm"
              variant={professional.active ? "danger" : "secondary"}
              onClick={onToggleActive}
            >
              {professional.active ? "Inativar" : "Reativar"}
            </Button>
          </div>

          <Button variant="secondary" fullWidth onClick={onClose}>
            Fechar
          </Button>
        </div>
      )}
    </Modal>
  );
}
