"use client";

import * as React from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { CalendarSearch, Phone, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  cancelPublicAppointmentByPhone,
  fetchPublicCustomerAppointments,
  type PublicCustomerAppointment,
} from "@/lib/actions/public-booking";
import { APP_TIMEZONE, formatBrazilianPhoneInput } from "@/lib/utils";

export function PublicLookupForm({ slug }: { slug: string }) {
  const [phone, setPhone] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [appointments, setAppointments] = React.useState<PublicCustomerAppointment[]>([]);
  const [cancelTarget, setCancelTarget] = React.useState<PublicCustomerAppointment | null>(null);
  const [cancelling, setCancelling] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);

    const result = await cancelPublicAppointmentByPhone({
      slug,
      phone,
      appointmentId: cancelTarget.id,
    });

    setCancelling(false);

    if (!result.ok || !result.data.found) {
      setCancelError(result.ok ? "Não foi possível cancelar este agendamento." : result.error);
      return;
    }

    setAppointments((prev) =>
      prev.map((appt) =>
        appt.id === cancelTarget.id ? { ...appt, status: "cancelado", can_cancel: false } : appt,
      ),
    );
    setCancelTarget(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Informe seu telefone.");
      return;
    }
    setError(null);
    setSearching(true);

    const result = await fetchPublicCustomerAppointments({ slug, phone });

    setSearching(false);
    setSearched(true);

    if (!result.ok) {
      setError(result.error);
      setAppointments([]);
      return;
    }

    setAppointments(result.data);
  };

  // Appointment states aren't shown to the customer (there's no more
  // owner-confirmation step for "agendado" vs "confirmado" to
  // distinguish), so a cancelled/concluded appointment — with nothing
  // left to show or do — is left off the list entirely rather than
  // shown with no visual indication of why its "Cancelar" button is
  // gone.
  const visibleAppointments = appointments.filter(
    (appt) => appt.status !== "cancelado" && appt.status !== "concluido",
  );

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Telefone (WhatsApp)"
          type="tel"
          leftIcon={<Phone className="size-4" />}
          value={phone}
          onChange={(e) => {
            setPhone(formatBrazilianPhoneInput(e.target.value));
            setSearched(false);
          }}
          placeholder="(19) 99999-9999"
        />
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="submit" fullWidth loading={searching}>
          <Search className="size-4" />
          Consultar
        </Button>
      </form>

      {searched && !error && visibleAppointments.length === 0 && (
        <Alert variant="info" title="Nenhum agendamento encontrado">
          Não encontramos agendamentos com esse telefone. Verifique o número ou faça um novo
          agendamento.
        </Alert>
      )}

      {visibleAppointments.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-black/5 pt-4">
          {cancelError && <Alert variant="error">{cancelError}</Alert>}
          {visibleAppointments.map((appt) => {
            const start = toZonedTime(appt.starts_at, APP_TIMEZONE);
            const end = toZonedTime(appt.ends_at, APP_TIMEZONE);
            return (
              <div
                key={appt.id}
                className="flex items-start gap-3 rounded-xl bg-brand-surface p-3.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-orange">
                  <CalendarSearch className="size-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-brand-graphite">
                    {appt.service_name}
                  </p>
                  <p className="text-sm text-brand-graphite/60">
                    com {appt.professional_name}
                  </p>
                  <p className="text-sm text-brand-graphite/60">
                    {format(start, "dd/MM/yyyy")} às {format(start, "HH:mm")} –{" "}
                    {format(end, "HH:mm")}
                  </p>
                  {appt.can_cancel && (
                    <Button
                      variant="danger"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setCancelError(null);
                        setCancelTarget(appt);
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancelar agendamento"
        description={
          cancelTarget
            ? `Tem certeza que deseja cancelar o agendamento de ${cancelTarget.service_name} em ${format(toZonedTime(cancelTarget.starts_at, APP_TIMEZONE), "dd/MM/yyyy")} às ${format(toZonedTime(cancelTarget.starts_at, APP_TIMEZONE), "HH:mm")}?`
            : ""
        }
        confirmLabel="Cancelar agendamento"
        busy={cancelling}
        onConfirm={handleCancel}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}
