"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarCheck, CalendarPlus, Clock, Phone, User } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { ProfessionalPicker } from "@/components/agendar/ProfessionalPicker";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import {
  createPublicBooking,
  fetchPublicAvailableSlots,
  type PublicProfessional,
  type PublicService,
} from "@/lib/actions/public-booking";
import {
  buildGoogleCalendarLink,
  cn,
  formatBrazilianPhoneInput,
  formatCurrencyBRL,
  hhmmToMinutes,
  minutesToHHMM,
} from "@/lib/utils";

export function PublicBookingForm({
  slug,
  companyName,
  companyAddress,
  services,
  professionals,
}: {
  slug: string;
  companyName: string;
  companyAddress: string | null;
  services: PublicService[];
  professionals: PublicProfessional[];
}) {
  const [serviceId, setServiceId] = React.useState("");
  const [professionalIdRaw, setProfessionalIdRaw] = React.useState("");
  const [date, setDate] = React.useState(format(new Date(), "yyyy-MM-dd"));
  const [timeRaw, setTime] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [cancelToken, setCancelToken] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId);

  const eligibleProfessionals = professionals.filter(
    (p) => !serviceId || p.service_ids.includes(serviceId),
  );

  // If the service changes and the selected professional stops being
  // eligible for it, they "disappear" automatically — no effect
  // needed, this is just a derived value.
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
    fetchPublicAvailableSlots({ slug, professionalId, serviceId, date }).then((result) => {
      if (slotsRequestId.current !== requestId) return; // stale response
      setLoadingSlots(false);
      setAvailableSlots(result.ok ? result.data.slots : []);
    });
  }, [slug, serviceId, professionalId, date]);

  const time = availableSlots.includes(timeRaw) ? timeRaw : "";

  const endTime =
    service && time ? minutesToHHMM(hhmmToMinutes(time) + service.duration_min) : null;

  const validate = () => {
    const next: Record<string, string> = {};
    if (!serviceId) next.service = "Selecione um serviço";
    if (!professionalId) next.professional = "Selecione um profissional";
    if (!date) next.date = "Selecione uma data";
    if (!time) next.time = "Selecione um horário disponível";
    if (!customerName.trim()) next.customerName = "Informe seu nome";
    if (customerPhone.replace(/\D/g, "").length < 11) {
      next.customerPhone = "Informe um telefone válido com DDD";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);

    const result = await createPublicBooking({
      slug,
      serviceId,
      professionalId,
      date,
      startTime: time,
      customerName,
      customerPhone,
      customerEmail,
      notes,
    });

    setSubmitting(false);

    if (!result.ok) {
      setServerError(result.error);
      // The slot may no longer be free (someone else just took it) —
      // refresh the list so the visitor sees current reality.
      setTime("");
      fetchPublicAvailableSlots({ slug, professionalId, serviceId, date }).then((r) => {
        setAvailableSlots(r.ok ? r.data.slots : []);
      });
      return;
    }

    setCancelToken(result.data.cancelToken);
  };

  const professional = professionals.find((p) => p.id === professionalId);

  if (cancelToken) {
    const startsAt = new Date(`${date}T${time}:00`);
    const googleCalendarLink =
      service &&
      buildGoogleCalendarLink({
        title: `${service.name} — ${companyName}`,
        description: professional
          ? `Agendamento com ${professional.name} via Easy Barber.`
          : "Agendamento via Easy Barber.",
        location: companyAddress ?? undefined,
        start: startsAt,
        end: new Date(startsAt.getTime() + service.duration_min * 60_000),
      });

    return (
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-black/5 bg-white p-6 py-10 text-center shadow-sm">
        <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CalendarCheck className="size-7" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-brand-graphite">Horário reservado!</h2>
          <p className="mt-1 text-sm text-brand-graphite/60">
            {service?.name} com {professional?.name}
          </p>
          <p className="text-sm text-brand-graphite/60">
            {format(new Date(`${date}T00:00:00`), "dd/MM/yyyy")} às {time}
          </p>
        </div>
        <p className="text-xs text-brand-graphite/50">
          Guarde esta data — a barbearia pode entrar em contato pelo telefone informado para
          confirmar.
        </p>
        {googleCalendarLink && (
          <a
            href={googleCalendarLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-medium text-brand-graphite transition-colors hover:bg-black/5"
          >
            <CalendarPlus className="size-4" />
            Adicionar ao Google Agenda
          </a>
        )}
        <a
          href={`/cancelar/${cancelToken}`}
          className="text-xs font-medium text-brand-graphite/50 hover:text-brand-error hover:underline"
        >
          Não poderá comparecer? Cancelar este agendamento
        </a>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            setCancelToken(null);
            setServiceId("");
            setProfessionalIdRaw("");
            setTime("");
            setCustomerName("");
            setCustomerPhone("");
            setCustomerEmail("");
            setNotes("");
          }}
        >
          Fazer outro agendamento
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6"
      noValidate
    >
      {serverError && <Alert variant="error">{serverError}</Alert>}

      {services.length === 0 ? (
        <Alert variant="info" title="Nenhum horário disponível no momento">
          Esta barbearia ainda não cadastrou serviços para agendamento online. Entre em contato
          diretamente por telefone.
        </Alert>
      ) : (
        <>
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

          <ProfessionalPicker
            label="Profissional"
            placeholder={serviceId ? "Selecione um profissional" : "Selecione um serviço primeiro"}
            professionals={eligibleProfessionals}
            value={professionalId}
            error={errors.professional}
            disabled={!serviceId}
            onChange={setProfessionalIdRaw}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-brand-graphite">Data</label>
              <input
                type="date"
                value={date}
                min={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-black/10 bg-white px-3.5 text-sm text-brand-graphite outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
              />
              {errors.date && <p className="text-xs text-brand-error">{errors.date}</p>}
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
              {errors.time && <p className="text-xs text-brand-error">{errors.time}</p>}
            </div>
          </div>

          {service && time && endTime && (
            <div className="flex items-center gap-2 rounded-xl bg-brand-surface px-3.5 py-2.5 text-sm text-brand-graphite/70">
              <Clock className="size-4 text-brand-orange" />
              Término previsto às <strong className="text-brand-graphite">{endTime}</strong> (
              {service.duration_min} min)
            </div>
          )}

          {professional && (
            <div className="flex items-center gap-2.5 rounded-xl bg-brand-surface px-3.5 py-2.5">
              <Avatar name={professional.name} color={professional.color} size="sm" />
              <p className="text-sm text-brand-graphite">
                Atendimento com <strong>{professional.name}</strong>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4 border-t border-black/5 pt-4">
            <p className="text-sm font-semibold text-brand-graphite">Seus dados</p>
            <Input
              label="Nome completo"
              leftIcon={<User className="size-4" />}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Seu nome"
              error={errors.customerName}
            />
            <Input
              label="Telefone (WhatsApp)"
              type="tel"
              leftIcon={<Phone className="size-4" />}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(formatBrazilianPhoneInput(e.target.value))}
              placeholder="(19) 9 9999-9999"
              error={errors.customerPhone}
            />
            <Input
              label="E-mail (opcional)"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
            <Textarea
              label="Observações (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alguma preferência ou observação?"
            />
          </div>

          <Button type="submit" fullWidth loading={submitting}>
            Confirmar agendamento
          </Button>
        </>
      )}
    </form>
  );
}
