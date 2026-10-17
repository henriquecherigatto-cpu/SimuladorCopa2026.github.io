"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { Mail, Phone, Plus, Search, UserRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { AppointmentStatusBadge } from "@/components/ui/StatusBadge";
import {
  createCustomer,
  getCustomerAppointmentHistory,
  updateCustomer,
  type CustomerAppointmentHistoryItem,
  type CustomerInput,
} from "@/lib/actions/customers";
import { APP_TIMEZONE } from "@/lib/utils";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
  appointments: { count: number }[];
}

export function ClientesPageClient({
  initialCustomers,
}: {
  initialCustomers: CustomerRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [detailsId, setDetailsId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const detailsCustomer = initialCustomers.find((c) => c.id === detailsId) ?? null;

  const filtered = initialCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.phone.replace(/\D/g, "").includes(query.replace(/\D/g, "")),
  );

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleAdd = async (input: CustomerInput) => {
    const result = await createCustomer(input);
    if (!result.ok) return result.error;
    setAddOpen(false);
    flash("Cliente cadastrado com sucesso.");
    router.refresh();
    return null;
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Clientes"
        description={`${initialCustomers.length} clientes cadastrados`}
        action={
          <Button icon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>
            Novo cliente
          </Button>
        }
      />

      {notice && <Alert variant="info">{notice}</Alert>}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-graphite/40" />
        <input
          type="text"
          placeholder="Buscar cliente por nome ou telefone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 w-full rounded-xl border border-black/10 bg-white pl-10 pr-3.5 text-sm text-brand-graphite outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={UserRound}
            title={
              initialCustomers.length === 0
                ? "Nenhum cliente cadastrado"
                : "Nenhum cliente encontrado"
            }
            description={
              initialCustomers.length === 0
                ? "Cadastre o primeiro cliente da sua barbearia."
                : "Tente buscar por outro nome ou telefone."
            }
            action={
              initialCustomers.length === 0 ? (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  Novo cliente
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-black/5">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setDetailsId(c.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-brand-surface sm:px-5"
                >
                  <Avatar name={c.name} size="md" color="#171717" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-graphite">
                      {c.name}
                    </p>
                    <p className="truncate text-xs text-brand-graphite/50">
                      {c.phone}
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-xs text-brand-graphite/40 sm:block">
                    {c.appointments[0]?.count ?? 0} agendamentos
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <AddCustomerModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      <CustomerDetailsModal
        customer={detailsCustomer}
        onClose={() => setDetailsId(null)}
        onChanged={(message) => {
          flash(message);
          router.refresh();
        }}
      />
    </div>
  );
}

function AddCustomerModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (input: CustomerInput) => Promise<string | null>;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Novo cliente">
      {open && <AddCustomerFormFields onAdd={onAdd} onClose={onClose} />}
    </Modal>
  );
}

function AddCustomerFormFields({
  onAdd,
  onClose,
}: {
  onAdd: (input: CustomerInput) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Nome e telefone são obrigatórios.");
      return;
    }
    setSubmitting(true);
    const actionError = await onAdd({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
    setSubmitting(false);
    if (actionError) setError(actionError);
    else onClose();
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <Alert variant="error">{error}</Alert>}
      <Input
        label="Nome completo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome do cliente"
      />
      <Input
        label="Telefone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="(19) 99999-9999"
      />
      <Input
        label="E-mail (opcional)"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="cliente@exemplo.com"
      />
      <Button type="submit" fullWidth loading={submitting}>
        Salvar cliente
      </Button>
    </form>
  );
}

function CustomerDetailsModal({
  customer,
  onClose,
  onChanged,
}: {
  customer: CustomerRow | null;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [history, setHistory] = React.useState<CustomerAppointmentHistoryItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!customer) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHistory(null);
      return;
    }
    setLoading(true);
    getCustomerAppointmentHistory(customer.id).then((result) => {
      setLoading(false);
      setHistory(result.ok ? result.data : []);
    });
  }, [customer]);

  React.useEffect(() => {
    if (!customer) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditing(false);
    setName(customer.name);
    setPhone(customer.phone);
    setEmail(customer.email ?? "");
    setError(null);
  }, [customer]);

  const saveEdit = async () => {
    if (!customer) return;
    if (!name.trim() || !phone.trim()) {
      setError("Nome e telefone são obrigatórios.");
      return;
    }
    setBusy(true);
    const result = await updateCustomer(customer.id, {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    onChanged("Dados do cliente atualizados.");
  };

  return (
    <Modal open={!!customer} onClose={onClose} title="Detalhes do cliente">
      {customer && (
        <div className="flex flex-col gap-5">
          {error && <Alert variant="error">{error}</Alert>}

          {editing ? (
            <div className="flex flex-col gap-4">
              <Input label="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
              <Input
                label="Telefone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                label="E-mail (opcional)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  fullWidth
                  onClick={() => setEditing(false)}
                >
                  Cancelar
                </Button>
                <Button size="sm" fullWidth loading={busy} onClick={saveEdit}>
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Avatar name={customer.name} size="lg" color="#171717" />
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-brand-graphite">
                  {customer.name}
                </p>
                <p className="flex items-center gap-1.5 text-sm text-brand-graphite/60">
                  <Phone className="size-3.5" /> {customer.phone}
                </p>
                {customer.email && (
                  <p className="flex items-center gap-1.5 text-sm text-brand-graphite/60">
                    <Mail className="size-3.5" /> {customer.email}
                  </p>
                )}
              </div>
              <button
                onClick={() => setEditing(true)}
                className="text-xs font-medium text-brand-orange hover:underline"
              >
                Editar
              </button>
            </div>
          )}

          {!editing && (
          <div>
            <p className="mb-2 text-sm font-semibold text-brand-graphite">
              Histórico de agendamentos
            </p>
            {loading ? (
              <p className="text-sm text-brand-graphite/50">Carregando...</p>
            ) : !history || history.length === 0 ? (
              <p className="text-sm text-brand-graphite/50">
                Nenhum agendamento registrado ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {history.map((appt) => (
                  <li
                    key={appt.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-brand-surface px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-brand-graphite">
                        {appt.service?.name} · {appt.professional?.name}
                      </p>
                      <p className="text-xs text-brand-graphite/50">
                        {formatInTimeZone(appt.starts_at, APP_TIMEZONE, "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <AppointmentStatusBadge
                      status={appt.status as "agendado" | "confirmado" | "concluido" | "cancelado"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}

          {!editing && (
          <Button variant="secondary" fullWidth onClick={onClose}>
            Fechar
          </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
