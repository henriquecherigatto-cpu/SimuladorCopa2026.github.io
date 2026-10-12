"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Scissors, StickyNote, User } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { AppointmentStatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cancelAppointment, updateAppointmentStatus } from "@/lib/actions/appointments";
import { formatCurrencyBRL } from "@/lib/utils";
import type { AppointmentListItem } from "@/lib/actions/appointments";

export function AppointmentDetailsModal({
  appointment,
  onClose,
  onChanged,
}: {
  appointment: AppointmentListItem | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <Modal open={!!appointment} onClose={onClose} title="Detalhes do agendamento">
      {appointment && (
        <AppointmentDetailsBody
          appointment={appointment}
          onClose={onClose}
          onChanged={onChanged}
        />
      )}
    </Modal>
  );
}

function AppointmentDetailsBody({
  appointment,
  onClose,
  onChanged,
}: {
  appointment: AppointmentListItem;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { customer, service, professional } = appointment;

  const changeStatus = async (
    status: "confirmado" | "concluido" | "cancelado",
  ) => {
    setBusy(true);
    setError(null);
    const result =
      status === "cancelado"
        ? await cancelAppointment(appointment.id)
        : await updateAppointmentStatus(appointment.id, status);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged();
    onClose();
  };

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar
            name={customer?.name ?? "?"}
            size="lg"
            color={professional?.color}
          />
          <div>
            <p className="text-base font-semibold text-brand-graphite">
              {customer?.name}
            </p>
            <p className="text-sm text-brand-graphite/50">{customer?.phone}</p>
          </div>
        </div>
        <AppointmentStatusBadge status={appointment.status} />
      </div>

      <dl className="flex flex-col gap-3 rounded-xl bg-brand-surface p-4 text-sm">
        <div className="flex items-center gap-2.5">
          <Clock className="size-4 shrink-0 text-brand-graphite/40" />
          <dt className="sr-only">Horário</dt>
          <dd className="text-brand-graphite">
            {format(new Date(appointment.starts_at), "dd/MM/yyyy")} ·{" "}
            {format(new Date(appointment.starts_at), "HH:mm", { locale: ptBR })} –{" "}
            {format(new Date(appointment.ends_at), "HH:mm", { locale: ptBR })}
          </dd>
        </div>
        <div className="flex items-center gap-2.5">
          <Scissors className="size-4 shrink-0 text-brand-graphite/40" />
          <dt className="sr-only">Serviço</dt>
          <dd className="text-brand-graphite">
            {service?.name}
            {service && ` · ${formatCurrencyBRL(service.price_cents / 100)}`}
          </dd>
        </div>
        <div className="flex items-center gap-2.5">
          <User className="size-4 shrink-0 text-brand-graphite/40" />
          <dt className="sr-only">Profissional</dt>
          <dd className="text-brand-graphite">{professional?.name}</dd>
        </div>
        {appointment.notes && (
          <div className="flex items-start gap-2.5">
            <StickyNote className="mt-0.5 size-4 shrink-0 text-brand-graphite/40" />
            <dt className="sr-only">Observações</dt>
            <dd className="text-brand-graphite">{appointment.notes}</dd>
          </div>
        )}
      </dl>

      {appointment.status !== "cancelado" && appointment.status !== "concluido" && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {appointment.status === "agendado" && (
              <Button
                variant="secondary"
                fullWidth
                loading={busy}
                onClick={() => changeStatus("confirmado")}
              >
                Confirmar
              </Button>
            )}
            {appointment.status === "confirmado" && (
              <Button
                variant="secondary"
                fullWidth
                loading={busy}
                onClick={() => changeStatus("concluido")}
              >
                Concluir
              </Button>
            )}
          </div>
          <Button
            variant="danger"
            fullWidth
            loading={busy}
            onClick={() => changeStatus("cancelado")}
          >
            Cancelar agendamento
          </Button>
        </div>
      )}

      <Button variant="secondary" fullWidth onClick={onClose}>
        Fechar
      </Button>
    </div>
  );
}
