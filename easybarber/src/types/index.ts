export type UserRole = "platform_admin" | "owner" | "professional";

export type AppointmentStatus =
  | "agendado"
  | "confirmado"
  | "concluido"
  | "cancelado";

export type SubscriptionStatus =
  | "ativa"
  | "pendente"
  | "tolerancia"
  | "suspensa"
  | "cancelada";

export interface Company {
  id: string;
  name: string;
  cnpj?: string;
  phone: string;
  address?: string;
  createdAt: string;
  planId: string;
  subscriptionStatus: SubscriptionStatus;
}

export interface Professional {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  role: string;
  color: string;
  active: boolean;
  serviceIds: string[];
  workHours: { start: string; end: string };
  daysOff: string[];
  appointmentsCount: number;
}

export interface Service {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  durationMin: number;
  price: number;
  active: boolean;
  professionalIds: string[];
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: string;
  appointmentsCount: number;
}

export interface Appointment {
  id: string;
  companyId: string;
  customerId: string;
  professionalId: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: AppointmentStatus;
  notes?: string;
  createdBy: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  period: "mensal";
  features: string[];
  limits: {
    maxProfessionals: number | null;
    maxCustomers: number | null;
  };
}

export interface BillingEvent {
  id: string;
  companyId: string;
  date: string;
  description: string;
  amount: number;
  status: "pago" | "pendente" | "falhou";
}

export interface BusinessHours {
  day: string;
  open: boolean;
  start: string;
  end: string;
}
