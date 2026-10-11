"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  customers as initialCustomers,
  getCustomerAppointments,
  getProfessionalById,
  getServiceById,
} from "@/lib/mock-data";
import type { Customer } from "@/types";

export function ClientesPageClient() {
  const [customers, setCustomers] = React.useState<Customer[]>(initialCustomers);
  const [query, setQuery] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [detailsCustomer, setDetailsCustomer] = React.useState<Customer | null>(
    null,
  );
  const [justAdded, setJustAdded] = React.useState(false);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.phone.replace(/\D/g, "").includes(query.replace(/\D/g, "")),
  );

  const handleAdd = (data: { name: string; phone: string; email?: string }) => {
    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      companyId: customers[0]?.companyId ?? "company-barber-013",
      name: data.name,
      phone: data.phone,
      email: data.email || undefined,
      createdAt: format(new Date(), "yyyy-MM-dd"),
      appointmentsCount: 0,
    };
    setCustomers((prev) => [newCustomer, ...prev]);
    setAddOpen(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 4000);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Clientes"
        description={`${customers.length} clientes cadastrados`}
        action={
          <Button icon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>
            Novo cliente
          </Button>
        }
      />

      {justAdded && (
        <Alert variant="success" title="Cliente cadastrado">
          O novo cliente foi adicionado à lista local de demonstração.
        </Alert>
      )}

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
              customers.length === 0
                ? "Nenhum cliente cadastrado"
                : "Nenhum cliente encontrado"
            }
            description={
              customers.length === 0
                ? "Cadastre o primeiro cliente da sua barbearia."
                : "Tente buscar por outro nome ou telefone."
            }
            action={
              customers.length === 0 ? (
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
                  onClick={() => setDetailsCustomer(c)}
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
                    {c.appointmentsCount} agendamentos
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
        onClose={() => setDetailsCustomer(null)}
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
  onAdd: (data: { name: string; phone: string; email?: string }) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Novo cliente">
      {open && <AddCustomerFormFields onAdd={onAdd} />}
    </Modal>
  );
}

function AddCustomerFormFields({
  onAdd,
}: {
  onAdd: (data: { name: string; phone: string; email?: string }) => void;
}) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Nome e telefone são obrigatórios.");
      return;
    }
    onAdd({ name: name.trim(), phone: phone.trim(), email: email.trim() });
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
      <Button type="submit" fullWidth>
        Salvar cliente
      </Button>
    </form>
  );
}

function CustomerDetailsModal({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const history = customer ? getCustomerAppointments(customer.id) : [];

  return (
    <Modal open={!!customer} onClose={onClose} title="Detalhes do cliente">
      {customer && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar name={customer.name} size="lg" color="#171717" />
            <div>
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
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-brand-graphite">
              Histórico de agendamentos
            </p>
            {history.length === 0 ? (
              <p className="text-sm text-brand-graphite/50">
                Nenhum agendamento registrado ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {history.map((appt) => {
                  const service = getServiceById(appt.serviceId);
                  const professional = getProfessionalById(appt.professionalId);
                  return (
                    <li
                      key={appt.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-brand-surface px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-brand-graphite">
                          {service?.name} · {professional?.name}
                        </p>
                        <p className="text-xs text-brand-graphite/50">
                          {format(new Date(`${appt.date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })} às {appt.startTime}
                        </p>
                      </div>
                      <AppointmentStatusBadge status={appt.status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Button variant="secondary" fullWidth onClick={onClose}>
            Fechar
          </Button>
        </div>
      )}
    </Modal>
  );
}
