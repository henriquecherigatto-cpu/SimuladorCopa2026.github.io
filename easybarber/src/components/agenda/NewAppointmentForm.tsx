"use client";

import * as React from "react";
import { format } from "date-fns";
import { CheckCircle2, Clock } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import {
  CustomerPicker,
  NewCustomerFields,
  type CustomerOption,
} from "@/components/agenda/CustomerPicker";
import { createAppointment, fetchAvailableSlots } from "@/lib/actions/appointments";
import { cn, formatCurrencyBRL, hhmmToMinutes, minutesToHHMM } from "@/lib/utils";

export interface ServiceOption {
  id: string;
  name: string;
  duration_min: number;
  price_cents: number;
  active: boolean;
}

export interface ProfessionalOption {
  id: string;
  name: string;
  active: boolean;
  professional_services: { service_id: string }[];
}

export function NewAppointmentForm({
  services,
  professionals,
  customers,
}: {
  services: ServiceOption[];
  professionals: ProfessionalOption[];
  customers: CustomerOption[];
}) {
  const [customerMode, setCustomerMode] = React.useState<"existing" | "new">(
    "existing",
  );
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [newCustomerName, setNewCustomerName] = React.useState("");
  const [newCustomerPhone, setNewCustomerPhone] = React.useState("");

  const [serviceId, setServiceId] = React.useState("");
  const [professionalIdRaw, setProfessionalIdRaw] = React.useState("");
  const [date, setDate] = React.useState(format(new Date(), "yyyy-MM-dd"));
  const [timeRaw, setTime] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId);

  const eligibleProfessionals = professionals.filter(
    (p) =>
      p.active &&
      (!serviceId || p.professional_services.some((ps) => ps.service_id === serviceId)),
  );

  // Valores derivados: se o serviço mudar e o profissional selecionado
  // deixar de ser elegível, ele "some" automaticamente sem precisar de efeito.
  const professionalId = eligibleProfessionals.some((p) => p.id === professionalIdRaw)
    ? professionalIdRaw
    : "";

  const [availableSlots, setAvailableSlots] = React.useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const slotsRequestId = React.useRef(0);

  React.useEffect(() => {
    if (!serviceId || !professionalId || !date) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailableSlots([]);
      return;
    }
    const requestId = ++slotsRequestId.current;
    setLoadingSlots(true);
    fetchAvailableSlots({ professionalId, serviceId, date }).then((result) => {
      if (slotsRequestId.current !== requestId) return; // stale response
      setLoadingSlots(false);
      setAvailableSlots(result.ok ? result.data.slots : []);
    });
  }, [serviceId, professionalId, date]);

  const time = availableSlots.includes(timeRaw) ? timeRaw : "";

  const endTime =
    service && time
      ? minutesToHHMM(hhmmToMinutes(time) + service.duration_min)
      : null;

  const validate = () => {
    const next: Record<string, string> = {};
    if (customerMode === "existing" && !customerId) {
      next.customer = "Selecione um cliente";
    }
    if (customerMode === "new") {
      if (!newCustomerName.trim()) next.customer = "Informe o nome do cliente";
      else if (!newCustomerPhone.trim())
        next.customer = "Informe o telefone do cliente";
    }
    if (!serviceId) next.service = "Selecione um serviço";
    if (!professionalId) next.professional = "Selecione um profissional";
    if (!date) next.date = "Selecione uma data";
    if (!time) next.time = "Selecione um horário disponível";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);

    const result = await createAppointment({
      customerId: customerMode === "existing" ? customerId ?? undefined : undefined,
      newCustomer:
        customerMode === "new"
          ? { name: newCustomerName, phone: newCustomerPhone }
          : undefined,
      serviceId,
      professionalId,
      date,
      startTime: time,
      notes,
    });

    setSubmitting(false);

    if (!result.ok) {
      setServerError(result.error);
      // The slot we had may no longer be valid (e.g. someone else just
      // booked it) — refresh the list so the user sees current reality.
      setTime("");
      fetchAvailableSlots({ professionalId, serviceId, date }).then((r) => {
        setAvailableSlots(r.ok ? r.data.slots : []);
      });
      return;
    }

    setSuccess(true);
  };

  const customerName =
    customerMode === "existing"
      ? customers.find((c) => c.id === customerId)?.name
      : newCustomerName;
  const professional = professionals.find((p) => p.id === professionalId);

  if (success) {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="size-7" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-brand-graphite">
            Agendamento confirmado!
          </h2>
          <p className="mt-1 text-sm text-brand-graphite/60">
            {customerName} · {service?.name} com {professional?.name}
          </p>
          <p className="text-sm text-brand-graphite/60">
            {format(new Date(`${date}T00:00:00`), "dd/MM/yyyy")} às {time}
          </p>
        </div>
        <div className="flex w-full gap-2">
          <Button href="/agenda" variant="secondary" fullWidth>
            Ver agenda
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              setSuccess(false);
              setCustomerId(null);
              setNewCustomerName("");
              setNewCustomerPhone("");
              setServiceId("");
              setProfessionalIdRaw("");
              setTime("");
              setNotes("");
            }}
          >
            Novo agendamento
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-brand-graphite">
            Cliente
          </label>
          <div className="flex rounded-lg bg-black/5 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setCustomerMode("existing")}
              className={cn(
                "rounded-md px-2.5 py-1",
                customerMode === "existing"
                  ? "bg-white text-brand-graphite shadow-sm"
                  : "text-brand-graphite/50",
              )}
            >
              Cliente existente
            </button>
            <button
              type="button"
              onClick={() => setCustomerMode("new")}
              className={cn(
                "rounded-md px-2.5 py-1",
                customerMode === "new"
                  ? "bg-white text-brand-graphite shadow-sm"
                  : "text-brand-graphite/50",
              )}
            >
              + Novo cliente
            </button>
          </div>
        </div>
        {customerMode === "existing" ? (
          <CustomerPicker value={customerId} onChange={setCustomerId} customers={customers} />
        ) : (
          <NewCustomerFields
            name={newCustomerName}
            phone={newCustomerPhone}
            onChangeName={setNewCustomerName}
            onChangePhone={setNewCustomerPhone}
          />
        )}
        {errors.customer && (
          <p className="text-xs text-brand-error">{errors.customer}</p>
        )}
      </div>

      <Select
        label="Serviço"
        placeholder="Selecione um serviço"
        value={serviceId}
        error={errors.service}
        onChange={(e) => setServiceId(e.target.value)}
      >
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {s.duration_min} min · {formatCurrencyBRL(s.price_cents / 100)}
          </option>
        ))}
      </Select>

      <Select
        label="Profissional"
        placeholder={
          serviceId
            ? "Selecione um profissional"
            : "Selecione um serviço primeiro"
        }
        value={professionalId}
        error={errors.professional}
        disabled={!serviceId}
        onChange={(e) => setProfessionalIdRaw(e.target.value)}
      >
        {eligibleProfessionals.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-graphite">
            Data
          </label>
          <input
            type="date"
            value={date}
            min={format(new Date(), "yyyy-MM-dd")}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-full rounded-xl border border-black/10 bg-white px-3.5 text-sm text-brand-graphite outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
          />
          {errors.date && (
            <p className="text-xs text-brand-error">{errors.date}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-graphite">
            Horário disponível
          </label>
          {!service || !professionalId ? (
            <p className="flex h-11 items-center text-sm text-brand-graphite/40">
              Escolha o serviço e o profissional
            </p>
          ) : loadingSlots ? (
            <p className="flex h-11 items-center text-sm text-brand-graphite/40">
              Calculando horários...
            </p>
          ) : availableSlots.length === 0 ? (
            <p className="flex h-11 items-center text-sm text-brand-error">
              Sem horários livres nesta data
            </p>
          ) : (
            <div className="scrollbar-thin flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {availableSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                    time === slot
                      ? "border-brand-orange bg-brand-orange text-white"
                      : "border-black/10 bg-white text-brand-graphite hover:border-brand-orange/40",
                  )}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
          {errors.time && (
            <p className="text-xs text-brand-error">{errors.time}</p>
          )}
        </div>
      </div>

      {service && time && endTime && (
        <div className="flex items-center gap-2 rounded-xl bg-brand-surface px-3.5 py-2.5 text-sm text-brand-graphite/70">
          <Clock className="size-4 text-brand-orange" />
          Término previsto às <strong className="text-brand-graphite">{endTime}</strong>
          {" "}({service.duration_min} min)
        </div>
      )}

      <Textarea
        label="Observações (opcional)"
        placeholder="Ex: Preferência de corte"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <Button type="submit" fullWidth loading={submitting}>
        Salvar agendamento
      </Button>
    </form>
  );
}
