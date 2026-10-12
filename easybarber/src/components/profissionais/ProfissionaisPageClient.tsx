"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { cn } from "@/lib/utils";
import {
  addProfessionalBreak,
  createProfessional,
  deleteProfessionalBreak,
  setProfessionalActive,
  setProfessionalServices,
  updateProfessional,
  type ProfessionalInput,
} from "@/lib/actions/professionals";

const PALETTE = ["#FF6B1A", "#2563EB", "#16803C", "#9333EA", "#DC2626", "#0E7490"];
const WEEKDAY_LABELS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export interface ProfessionalRow {
  id: string;
  name: string;
  phone: string | null;
  role_title: string;
  color: string;
  active: boolean;
  work_start: string;
  work_end: string;
  weekly_days_off: number[];
  professional_services: { service: { id: string; name: string } | null }[];
  professional_breaks: { id: string; start_time: string; end_time: string; label: string | null }[];
  appointments: { count: number }[];
}

export interface ServiceOption {
  id: string;
  name: string;
}

export function ProfissionaisPageClient({
  initialProfessionals,
  allServices,
  canManage,
}: {
  initialProfessionals: ProfessionalRow[];
  allServices: ServiceOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [detailsId, setDetailsId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const details = initialProfessionals.find((p) => p.id === detailsId) ?? null;

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleAdd = async (input: ProfessionalInput) => {
    const result = await createProfessional(input);
    if (!result.ok) return result.error;
    setAddOpen(false);
    flash("Profissional cadastrado com sucesso.");
    router.refresh();
    return null;
  };

  const activeCount = initialProfessionals.filter((p) => p.active).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Profissionais"
        description={`${activeCount} ativos de ${initialProfessionals.length} cadastrados`}
        action={
          canManage && (
            <Button icon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>
              Novo profissional
            </Button>
          )
        }
      />

      {notice && <Alert variant="info">{notice}</Alert>}

      {initialProfessionals.length === 0 ? (
        <Card>
          <EmptyState
            icon={UserCog}
            title="Nenhum profissional cadastrado"
            description="Cadastre os profissionais que atendem na sua barbearia."
            action={
              canManage && (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  Novo profissional
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-black/5">
            {initialProfessionals.map((p) => (
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
                      {p.role_title} · {p.appointments[0]?.count ?? 0} agendamentos
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
        allServices={allServices}
      />
      <ProfessionalDetailsModal
        professional={details}
        allServices={allServices}
        canManage={canManage}
        onClose={() => setDetailsId(null)}
        onChanged={(message) => {
          flash(message);
          router.refresh();
        }}
      />
    </div>
  );
}

function AddProfessionalModal({
  open,
  onClose,
  onAdd,
  allServices,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (input: ProfessionalInput) => Promise<string | null>;
  allServices: ServiceOption[];
}) {
  return (
    <Modal open={open} onClose={onClose} title="Novo profissional">
      {open && (
        <AddProfessionalFormFields onAdd={onAdd} onClose={onClose} allServices={allServices} />
      )}
    </Modal>
  );
}

function AddProfessionalFormFields({
  onAdd,
  onClose,
  allServices,
}: {
  onAdd: (input: ProfessionalInput) => Promise<string | null>;
  onClose: () => void;
  allServices: ServiceOption[];
}) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [role, setRole] = React.useState("");
  const [selectedServices, setSelectedServices] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Informe o nome do profissional.");
      return;
    }
    setSubmitting(true);
    const actionError = await onAdd({
      name: name.trim(),
      phone: phone.trim(),
      roleTitle: role.trim(),
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      serviceIds: selectedServices,
    });
    setSubmitting(false);
    if (actionError) setError(actionError);
    else onClose();
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
          {allServices.map((s) => (
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
      <Button type="submit" fullWidth loading={submitting}>
        Salvar profissional
      </Button>
    </form>
  );
}

function ProfessionalDetailsModal({
  professional,
  allServices,
  canManage,
  onClose,
  onChanged,
}: {
  professional: ProfessionalRow | null;
  allServices: ServiceOption[];
  canManage: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  return (
    <Modal open={!!professional} onClose={onClose} title="Detalhes do profissional">
      {professional && (
        <ProfessionalDetailsBody
          professional={professional}
          allServices={allServices}
          canManage={canManage}
          onClose={onClose}
          onChanged={onChanged}
        />
      )}
    </Modal>
  );
}

function ProfessionalDetailsBody({
  professional,
  allServices,
  canManage,
  onClose,
  onChanged,
}: {
  professional: ProfessionalRow;
  allServices: ServiceOption[];
  canManage: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [editingServices, setEditingServices] = React.useState(false);
  const [selectedServices, setSelectedServices] = React.useState<string[]>(
    professional.professional_services
      .map((ps) => ps.service?.id)
      .filter((id): id is string => !!id),
  );
  const [editingInfo, setEditingInfo] = React.useState(false);
  const [name, setName] = React.useState(professional.name);
  const [phone, setPhone] = React.useState(professional.phone ?? "");
  const [roleTitle, setRoleTitle] = React.useState(professional.role_title);
  const [workStart, setWorkStart] = React.useState(professional.work_start.slice(0, 5));
  const [workEnd, setWorkEnd] = React.useState(professional.work_end.slice(0, 5));
  const [daysOff, setDaysOff] = React.useState<number[]>(professional.weekly_days_off);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [editingBreaks, setEditingBreaks] = React.useState(false);
  const [newBreakStart, setNewBreakStart] = React.useState("");
  const [newBreakEnd, setNewBreakEnd] = React.useState("");
  const [newBreakLabel, setNewBreakLabel] = React.useState("");
  const [breaksBusy, setBreaksBusy] = React.useState(false);
  const [breaksError, setBreaksError] = React.useState<string | null>(null);

  const sortedBreaks = [...professional.professional_breaks].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );

  const addBreak = async () => {
    if (!newBreakStart || !newBreakEnd) {
      setBreaksError("Informe o início e o fim da pausa.");
      return;
    }
    setBreaksBusy(true);
    setBreaksError(null);
    const result = await addProfessionalBreak(professional.id, {
      startTime: newBreakStart,
      endTime: newBreakEnd,
      label: newBreakLabel,
    });
    setBreaksBusy(false);
    if (!result.ok) {
      setBreaksError(result.error);
      return;
    }
    setNewBreakStart("");
    setNewBreakEnd("");
    setNewBreakLabel("");
    onChanged("Pausa adicionada.");
  };

  const removeBreak = async (breakId: string) => {
    setBreaksBusy(true);
    setBreaksError(null);
    const result = await deleteProfessionalBreak(breakId);
    setBreaksBusy(false);
    if (!result.ok) {
      setBreaksError(result.error);
      return;
    }
    onChanged("Pausa removida.");
  };

  const toggleDayOff = (day: number) => {
    setDaysOff((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const saveInfo = async () => {
    if (!name.trim()) {
      setError("Informe o nome do profissional.");
      return;
    }
    setBusy(true);
    const result = await updateProfessional(professional.id, {
      name: name.trim(),
      phone: phone.trim(),
      roleTitle: roleTitle.trim(),
      workStart,
      workEnd,
      weeklyDaysOff: daysOff,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditingInfo(false);
    onChanged("Dados do profissional atualizados.");
  };

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const saveServices = async () => {
    setBusy(true);
    const result = await setProfessionalServices(professional.id, selectedServices);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditingServices(false);
    onChanged("Serviços do profissional atualizados.");
  };

  const toggleActive = async () => {
    setBusy(true);
    const result = await setProfessionalActive(professional.id, !professional.active);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged(
      professional.active
        ? "Profissional inativado."
        : "Profissional reativado.",
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert variant="error">{error}</Alert>}

      {editingInfo ? (
        <div className="flex flex-col gap-4">
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Telefone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="Função"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Início do expediente"
              type="time"
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
            />
            <Input
              label="Fim do expediente"
              type="time"
              value={workEnd}
              onChange={(e) => setWorkEnd(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-brand-graphite">
              Dias de folga
            </span>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, day) => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDayOff(day)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium",
                    daysOff.includes(day)
                      ? "border-brand-orange bg-brand-orange/10 text-brand-orange-dark"
                      : "border-black/10 text-brand-graphite/60",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              fullWidth
              onClick={() => setEditingInfo(false)}
            >
              Cancelar
            </Button>
            <Button size="sm" fullWidth loading={busy} onClick={saveInfo}>
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Avatar name={professional.name} color={professional.color} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-brand-graphite">
              {professional.name}
            </p>
            <p className="text-sm text-brand-graphite/60">{professional.role_title}</p>
            {professional.phone && (
              <p className="flex items-center gap-1.5 text-sm text-brand-graphite/60">
                <Phone className="size-3.5" /> {professional.phone}
              </p>
            )}
          </div>
          {canManage && (
            <button
              onClick={() => setEditingInfo(true)}
              className="text-xs font-medium text-brand-orange hover:underline"
            >
              Editar
            </button>
          )}
        </div>
      )}

      {!editingInfo && (
      <>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-sm font-semibold text-brand-graphite">
            Serviços oferecidos
          </p>
          {canManage && !editingServices && (
            <button
              onClick={() => setEditingServices(true)}
              className="text-xs font-medium text-brand-orange hover:underline"
            >
              Editar
            </button>
          )}
        </div>
        {editingServices ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {allServices.map((s) => (
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
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditingServices(false)}>
                Cancelar
              </Button>
              <Button size="sm" loading={busy} onClick={saveServices}>
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {professional.professional_services.length === 0 ? (
              <p className="text-sm text-brand-graphite/50">Nenhum serviço associado.</p>
            ) : (
              professional.professional_services.map(
                (ps) => ps.service && <Badge key={ps.service.id}>{ps.service.name}</Badge>,
              )
            )}
          </div>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-sm font-semibold text-brand-graphite">
            Pausas programadas
          </p>
          {canManage && !editingBreaks && (
            <button
              onClick={() => setEditingBreaks(true)}
              className="text-xs font-medium text-brand-orange hover:underline"
            >
              Editar
            </button>
          )}
        </div>
        {editingBreaks ? (
          <div className="flex flex-col gap-3">
            {breaksError && <Alert variant="error">{breaksError}</Alert>}
            {sortedBreaks.length === 0 ? (
              <p className="text-sm text-brand-graphite/50">Nenhuma pausa cadastrada.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {sortedBreaks.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between rounded-lg bg-brand-surface px-3 py-2 text-sm"
                  >
                    <span className="text-brand-graphite">
                      {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                      {b.label && <span className="text-brand-graphite/50"> · {b.label}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeBreak(b.id)}
                      disabled={breaksBusy}
                      className="text-xs font-medium text-brand-error hover:underline disabled:opacity-50"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Início"
                type="time"
                value={newBreakStart}
                onChange={(e) => setNewBreakStart(e.target.value)}
              />
              <Input
                label="Fim"
                type="time"
                value={newBreakEnd}
                onChange={(e) => setNewBreakEnd(e.target.value)}
              />
            </div>
            <Input
              label="Nome da pausa (opcional)"
              value={newBreakLabel}
              onChange={(e) => setNewBreakLabel(e.target.value)}
              placeholder="Ex: Almoço"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditingBreaks(false)}>
                Concluído
              </Button>
              <Button size="sm" loading={breaksBusy} onClick={addBreak}>
                Adicionar pausa
              </Button>
            </div>
          </div>
        ) : sortedBreaks.length === 0 ? (
          <p className="text-sm text-brand-graphite/50">Nenhuma pausa cadastrada.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sortedBreaks.map((b) => (
              <Badge key={b.id}>
                {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                {b.label ? ` · ${b.label}` : ""}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-brand-surface p-3">
          <p className="text-xs text-brand-graphite/50">Horário de trabalho</p>
          <p className="font-medium text-brand-graphite">
            {professional.work_start.slice(0, 5)} – {professional.work_end.slice(0, 5)}
          </p>
        </div>
        <div className="rounded-xl bg-brand-surface p-3">
          <p className="text-xs text-brand-graphite/50">Folgas</p>
          <p className="font-medium text-brand-graphite">
            {professional.weekly_days_off.length === 0
              ? "Nenhuma"
              : professional.weekly_days_off.map((d) => WEEKDAY_LABELS[d]).join(", ")}
          </p>
        </div>
      </div>
      </>
      )}

      {canManage && (
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
            loading={busy}
            onClick={toggleActive}
          >
            {professional.active ? "Inativar" : "Reativar"}
          </Button>
        </div>
      )}

      <Button variant="secondary" fullWidth onClick={onClose}>
        Fechar
      </Button>
    </div>
  );
}
