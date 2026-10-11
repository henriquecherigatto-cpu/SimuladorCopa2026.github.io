"use client";

import { Clock, Scissors, StickyNote, User } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { AppointmentStatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import {
  getCustomerById,
  getProfessionalById,
  getServiceById,
} from "@/lib/mock-data";
import { formatCurrencyBRL } from "@/lib/utils";
import type { Appointment } from "@/types";

export function AppointmentDetailsModal({
  appointment,
  onClose,
}: {
  appointment: Appointment | null;
  onClose: () => void;
}) {
  const customer = appointment ? getCustomerById(appointment.customerId) : null;
  const professional = appointment
    ? getProfessionalById(appointment.professionalId)
    : null;
  const service = appointment ? getServiceById(appointment.serviceId) : null;

  return (
    <Modal open={!!appointment} onClose={onClose} title="Detalhes do agendamento">
      {appointment && customer && professional && service && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={customer.name} size="lg" color={professional.color} />
              <div>
                <p className="text-base font-semibold text-brand-graphite">
                  {customer.name}
                </p>
                <p className="text-sm text-brand-graphite/50">
                  {customer.phone}
                </p>
              </div>
            </div>
            <AppointmentStatusBadge status={appointment.status} />
          </div>

          <dl className="flex flex-col gap-3 rounded-xl bg-brand-surface p-4 text-sm">
            <div className="flex items-center gap-2.5">
              <Clock className="size-4 shrink-0 text-brand-graphite/40" />
              <dt className="sr-only">Horário</dt>
              <dd className="text-brand-graphite">
                {appointment.startTime} – {appointment.endTime}
              </dd>
            </div>
            <div className="flex items-center gap-2.5">
              <Scissors className="size-4 shrink-0 text-brand-graphite/40" />
              <dt className="sr-only">Serviço</dt>
              <dd className="text-brand-graphite">
                {service.name} · {formatCurrencyBRL(service.price)}
              </dd>
            </div>
            <div className="flex items-center gap-2.5">
              <User className="size-4 shrink-0 text-brand-graphite/40" />
              <dt className="sr-only">Profissional</dt>
              <dd className="text-brand-graphite">{professional.name}</dd>
            </div>
            {appointment.notes && (
              <div className="flex items-start gap-2.5">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-brand-graphite/40" />
                <dt className="sr-only">Observações</dt>
                <dd className="text-brand-graphite">{appointment.notes}</dd>
              </div>
            )}
          </dl>

          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={onClose}>
              Fechar
            </Button>
            <Button variant="primary" fullWidth>
              Editar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
