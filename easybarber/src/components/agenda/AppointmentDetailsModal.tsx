"use client";

import * as React from "react";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { Clock, Scissors, StickyNote, User } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { AppointmentStatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cancelAppointment, updateAppointmentStatus } from "@/lib/actions/appointments";
import { APP_TIMEZONE, buildWhatsAppLink, formatCurrencyBRL } from "@/lib/utils";
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
  const [confirmCancelOpen, setConfirmCancelOpen] = React.useState(false);

  const { customer, service, professional } = appointment;

  const changeStatus = async (status: "concluido" | "cancelado") => {
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
    // Opens the owner's own WhatsApp with the message already typed —
    // the owner reviews and sends it themselves, it's never sent
    // automatically from the server. Only when there's a number to
    // message and a browser to open it in (this modal is also used,
    // unchanged, by any future non-browser caller).
    if (status === "cancelado" && customer?.phone && typeof window !== "undefined") {
      const message = `Olá, ${customer.name}! Infelizmente precisamos cancelar seu agendamento de ${service?.name ?? "serviço"} em ${formatInTimeZone(appointment.starts_at, APP_TIMEZONE, "dd/MM/yyyy")} às ${formatInTimeZone(appointment.starts_at, APP_TIMEZONE, "HH:mm", { locale: ptBR })}. Pedimos desculpas pelo transtorno e ficamos à disposição para reagendar.`;
      window.open(buildWhatsAppLink(customer.phone, message), "_blank");
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
            {formatInTimeZone(appointment.starts_at, APP_TIMEZONE, "dd/MM/yyyy")} ·{" "}
            {formatInTimeZone(appointment.starts_at, APP_TIMEZONE, "HH:mm", { locale: ptBR })} –{" "}
            {formatInTimeZone(appointment.ends_at, APP_TIMEZONE, "HH:mm", { locale: ptBR })}
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
          <Button
            variant="secondary"
            fullWidth
            loading={busy}
            onClick={() => changeStatus("concluido")}
          >
            Concluir
          </Button>
          <Button
            variant="danger"
            fullWidth
            loading={busy}
            onClick={() => setConfirmCancelOpen(true)}
          >
            Cancelar agendamento
          </Button>
        </div>
      )}

      <Button variant="secondary" fullWidth onClick={onClose}>
        Fechar
      </Button>

      <ConfirmDialog
        open={confirmCancelOpen}
        title="Cancelar agendamento"
        description={`Tem certeza que deseja cancelar o agendamento de ${customer?.name ?? "cliente"}? O WhatsApp vai abrir para você avisar o cliente.`}
        confirmLabel="Cancelar agendamento"
        busy={busy}
        onConfirm={() => {
          setConfirmCancelOpen(false);
          changeStatus("cancelado");
        }}
        onClose={() => setConfirmCancelOpen(false)}
      />
    </div>
  );
}
