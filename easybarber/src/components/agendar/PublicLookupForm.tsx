"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarSearch, Phone, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { AppointmentStatusBadge } from "@/components/ui/StatusBadge";
import {
  fetchPublicCustomerAppointments,
  type PublicCustomerAppointment,
} from "@/lib/actions/public-booking";

export function PublicLookupForm({ slug }: { slug: string }) {
  const [phone, setPhone] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [appointments, setAppointments] = React.useState<PublicCustomerAppointment[]>([]);

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

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Telefone (WhatsApp)"
          type="tel"
          leftIcon={<Phone className="size-4" />}
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
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

      {searched && !error && appointments.length === 0 && (
        <Alert variant="info" title="Nenhum agendamento encontrado">
          Não encontramos agendamentos com esse telefone. Verifique o número ou faça um novo
          agendamento.
        </Alert>
      )}

      {appointments.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-black/5 pt-4">
          {appointments.map((appt) => {
            const start = new Date(appt.starts_at);
            const end = new Date(appt.ends_at);
            return (
              <div
                key={appt.id}
                className="flex items-start gap-3 rounded-xl bg-brand-surface p-3.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-orange">
                  <CalendarSearch className="size-4" />
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-brand-graphite">
                      {appt.service_name}
                    </p>
                    <AppointmentStatusBadge status={appt.status} />
                  </div>
                  <p className="text-sm text-brand-graphite/60">
                    com {appt.professional_name}
                  </p>
                  <p className="text-sm text-brand-graphite/60">
                    {format(start, "dd/MM/yyyy")} às {format(start, "HH:mm")} –{" "}
                    {format(end, "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
