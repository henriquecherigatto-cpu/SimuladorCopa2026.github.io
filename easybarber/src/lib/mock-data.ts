import { addDays, format } from "date-fns";
import type {
  Appointment,
  BillingEvent,
  BusinessHours,
  Company,
  Customer,
  Plan,
  Professional,
  Service,
} from "@/types";

/**
 * Todos os dados deste arquivo são fictícios e servem apenas para
 * demonstrar a interface do Easy Barber. Nada aqui é persistido em
 * banco de dados — veja o selo "Modo demonstração" na interface.
 */

const todayDate = new Date();
const d = (offset: number) => format(addDays(todayDate, offset), "yyyy-MM-dd");

export const DEMO_COMPANY_ID = "company-barber-013";

export const demoCompany: Company = {
  id: DEMO_COMPANY_ID,
  name: "Barber 013",
  cnpj: "",
  phone: "(19) 99999-0013",
  address: "Rua das Tesouras, 120 — Centro",
  createdAt: "2024-11-02",
  planId: "plan-essencial",
  subscriptionStatus: "ativa",
};

export const demoUser = {
  name: "Carlos",
  role: "owner" as const,
  companyId: DEMO_COMPANY_ID,
};

export const plans: Plan[] = [
  {
    id: "plan-essencial",
    name: "Essencial",
    price: 24.9,
    period: "mensal",
    features: [
      "Agenda de agendamentos",
      "Até 3 profissionais",
      "Clientes ilimitados",
      "Suporte por e-mail",
    ],
    limits: { maxProfessionals: 3, maxCustomers: null },
  },
  {
    id: "plan-profissional",
    name: "Profissional",
    price: 49.9,
    period: "mensal",
    features: [
      "Tudo do plano Essencial",
      "Até 10 profissionais",
      "Lembretes automáticos",
      "Relatórios avançados",
      "Suporte prioritário",
    ],
    limits: { maxProfessionals: 10, maxCustomers: null },
  },
  {
    id: "plan-studio",
    name: "Studio",
    price: 89.9,
    period: "mensal",
    features: [
      "Tudo do plano Profissional",
      "Profissionais ilimitados",
      "Múltiplas unidades",
      "Suporte via WhatsApp",
    ],
    limits: { maxProfessionals: null, maxCustomers: null },
  },
];

export const professionals: Professional[] = [
  {
    id: "prof-carlos",
    companyId: DEMO_COMPANY_ID,
    name: "Carlos",
    phone: "(19) 99999-1010",
    role: "Barbeiro principal",
    color: "#FF6B1A",
    active: true,
    serviceIds: ["svc-corte", "svc-barba", "svc-corte-barba"],
    workHours: { start: "08:00", end: "18:00" },
    daysOff: [],
    appointmentsCount: 25,
  },
  {
    id: "prof-matheus",
    companyId: DEMO_COMPANY_ID,
    name: "Matheus",
    phone: "(19) 99999-2020",
    role: "Barbeiro",
    color: "#2563EB",
    active: true,
    serviceIds: ["svc-corte", "svc-barba", "svc-corte-barba", "svc-sobrancelha"],
    workHours: { start: "09:00", end: "19:00" },
    daysOff: ["Segunda-feira"],
    appointmentsCount: 18,
  },
  {
    id: "prof-joao",
    companyId: DEMO_COMPANY_ID,
    name: "João",
    phone: "(19) 99999-3030",
    role: "Barbeiro",
    color: "#16803C",
    active: true,
    serviceIds: ["svc-corte", "svc-barba", "svc-pigmentacao"],
    workHours: { start: "08:00", end: "17:00" },
    daysOff: [],
    appointmentsCount: 12,
  },
  {
    id: "prof-rafael",
    companyId: DEMO_COMPANY_ID,
    name: "Rafael",
    phone: "(19) 99999-4040",
    role: "Barbeiro (em férias)",
    color: "#9333EA",
    active: false,
    serviceIds: ["svc-corte", "svc-barba"],
    workHours: { start: "08:00", end: "17:00" },
    daysOff: ["Sábado", "Domingo"],
    appointmentsCount: 7,
  },
];

export const services: Service[] = [
  {
    id: "svc-corte",
    companyId: DEMO_COMPANY_ID,
    name: "Corte de cabelo",
    description: "Corte tradicional ou degradê, à sua escolha.",
    durationMin: 45,
    price: 30,
    active: true,
    professionalIds: ["prof-carlos", "prof-matheus", "prof-joao", "prof-rafael"],
  },
  {
    id: "svc-barba",
    companyId: DEMO_COMPANY_ID,
    name: "Barba",
    description: "Modelagem e acabamento com navalha.",
    durationMin: 30,
    price: 25,
    active: true,
    professionalIds: ["prof-carlos", "prof-matheus", "prof-joao", "prof-rafael"],
  },
  {
    id: "svc-corte-barba",
    companyId: DEMO_COMPANY_ID,
    name: "Corte + Barba",
    description: "Combo completo de corte e barba.",
    durationMin: 75,
    price: 50,
    active: true,
    professionalIds: ["prof-carlos", "prof-matheus"],
  },
  {
    id: "svc-sobrancelha",
    companyId: DEMO_COMPANY_ID,
    name: "Sobrancelha",
    description: "Design de sobrancelha na navalha.",
    durationMin: 20,
    price: 20,
    active: true,
    professionalIds: ["prof-matheus"],
  },
  {
    id: "svc-pigmentacao",
    companyId: DEMO_COMPANY_ID,
    name: "Pigmentação",
    description: "Pigmentação de barba ou cabelo.",
    durationMin: 40,
    price: 40,
    active: true,
    professionalIds: ["prof-joao"],
  },
];

export const customers: Customer[] = [
  {
    id: "cust-joao-silva",
    companyId: DEMO_COMPANY_ID,
    name: "João Silva",
    phone: "(19) 99999-1111",
    email: "joao.silva@exemplo.com",
    createdAt: "2024-12-01",
    appointmentsCount: 5,
  },
  {
    id: "cust-pedro-santos",
    companyId: DEMO_COMPANY_ID,
    name: "Pedro Santos",
    phone: "(19) 99999-2222",
    createdAt: "2025-01-10",
    appointmentsCount: 3,
  },
  {
    id: "cust-lucas-oliveira",
    companyId: DEMO_COMPANY_ID,
    name: "Lucas Oliveira",
    phone: "(19) 99999-3333",
    email: "lucas.oliveira@exemplo.com",
    createdAt: "2025-01-22",
    appointmentsCount: 7,
  },
  {
    id: "cust-gabriel-souza",
    companyId: DEMO_COMPANY_ID,
    name: "Gabriel Souza",
    phone: "(19) 99999-4444",
    createdAt: "2025-02-14",
    appointmentsCount: 2,
  },
  {
    id: "cust-rafael-lima",
    companyId: DEMO_COMPANY_ID,
    name: "Rafael Lima",
    phone: "(19) 99999-5555",
    createdAt: d(-6),
    appointmentsCount: 1,
  },
  {
    id: "cust-bruno-costa",
    companyId: DEMO_COMPANY_ID,
    name: "Bruno Costa",
    phone: "(19) 99999-6666",
    email: "bruno.costa@exemplo.com",
    createdAt: d(-2),
    appointmentsCount: 4,
  },
];

export const appointments: Appointment[] = [
  {
    id: "appt-1",
    companyId: DEMO_COMPANY_ID,
    customerId: "cust-joao-silva",
    professionalId: "prof-carlos",
    serviceId: "svc-corte",
    date: d(0),
    startTime: "09:00",
    endTime: "09:45",
    status: "confirmado",
    createdBy: "Carlos",
  },
  {
    id: "appt-2",
    companyId: DEMO_COMPANY_ID,
    customerId: "cust-pedro-santos",
    professionalId: "prof-carlos",
    serviceId: "svc-corte-barba",
    date: d(0),
    startTime: "10:00",
    endTime: "11:15",
    status: "confirmado",
    createdBy: "Carlos",
  },
  {
    id: "appt-3",
    companyId: DEMO_COMPANY_ID,
    customerId: "cust-lucas-oliveira",
    professionalId: "prof-matheus",
    serviceId: "svc-corte",
    date: d(0),
    startTime: "11:30",
    endTime: "12:15",
    status: "agendado",
    createdBy: "Matheus",
  },
  {
    id: "appt-4",
    companyId: DEMO_COMPANY_ID,
    customerId: "cust-gabriel-souza",
    professionalId: "prof-joao",
    serviceId: "svc-barba",
    date: d(0),
    startTime: "14:00",
    endTime: "14:30",
    status: "confirmado",
    createdBy: "João",
  },
  {
    id: "appt-5",
    companyId: DEMO_COMPANY_ID,
    customerId: "cust-rafael-lima",
    professionalId: "prof-matheus",
    serviceId: "svc-sobrancelha",
    date: d(0),
    startTime: "15:00",
    endTime: "15:20",
    status: "agendado",
    createdBy: "Matheus",
  },
  {
    id: "appt-6",
    companyId: DEMO_COMPANY_ID,
    customerId: "cust-bruno-costa",
    professionalId: "prof-joao",
    serviceId: "svc-pigmentacao",
    date: d(1),
    startTime: "09:30",
    endTime: "10:10",
    status: "agendado",
    createdBy: "João",
  },
  {
    id: "appt-7",
    companyId: DEMO_COMPANY_ID,
    customerId: "cust-joao-silva",
    professionalId: "prof-carlos",
    serviceId: "svc-corte",
    date: d(1),
    startTime: "11:00",
    endTime: "11:45",
    status: "confirmado",
    createdBy: "Carlos",
  },
  {
    id: "appt-8",
    companyId: DEMO_COMPANY_ID,
    customerId: "cust-pedro-santos",
    professionalId: "prof-matheus",
    serviceId: "svc-barba",
    date: d(2),
    startTime: "13:00",
    endTime: "13:30",
    status: "cancelado",
    createdBy: "Matheus",
  },
  {
    id: "appt-9",
    companyId: DEMO_COMPANY_ID,
    customerId: "cust-lucas-oliveira",
    professionalId: "prof-joao",
    serviceId: "svc-corte",
    date: d(2),
    startTime: "16:00",
    endTime: "16:45",
    status: "agendado",
    createdBy: "João",
  },
  {
    id: "appt-10",
    companyId: DEMO_COMPANY_ID,
    customerId: "cust-gabriel-souza",
    professionalId: "prof-carlos",
    serviceId: "svc-corte-barba",
    date: d(-1),
    startTime: "10:00",
    endTime: "11:15",
    status: "concluido",
    createdBy: "Carlos",
  },
  {
    id: "appt-11",
    companyId: DEMO_COMPANY_ID,
    customerId: "cust-bruno-costa",
    professionalId: "prof-matheus",
    serviceId: "svc-corte",
    date: d(-1),
    startTime: "14:30",
    endTime: "15:15",
    status: "concluido",
    createdBy: "Matheus",
  },
  {
    id: "appt-12",
    companyId: DEMO_COMPANY_ID,
    customerId: "cust-rafael-lima",
    professionalId: "prof-joao",
    serviceId: "svc-barba",
    date: d(3),
    startTime: "09:00",
    endTime: "09:30",
    status: "agendado",
    createdBy: "João",
  },
];

export const businessHours: BusinessHours[] = [
  { day: "Segunda-feira", open: true, start: "08:00", end: "19:00" },
  { day: "Terça-feira", open: true, start: "08:00", end: "19:00" },
  { day: "Quarta-feira", open: true, start: "08:00", end: "19:00" },
  { day: "Quinta-feira", open: true, start: "08:00", end: "19:00" },
  { day: "Sexta-feira", open: true, start: "08:00", end: "20:00" },
  { day: "Sábado", open: true, start: "08:00", end: "17:00" },
  { day: "Domingo", open: true, start: "09:00", end: "16:00" },
];

export const billingHistory: BillingEvent[] = [
  {
    id: "bill-1",
    companyId: DEMO_COMPANY_ID,
    date: d(-32),
    description: "Assinatura Plano Essencial — mensal",
    amount: 24.9,
    status: "pago",
  },
  {
    id: "bill-2",
    companyId: DEMO_COMPANY_ID,
    date: d(-2),
    description: "Assinatura Plano Essencial — mensal",
    amount: 24.9,
    status: "pago",
  },
];

// ---------------------------------------------------------------------------
// Painel administrativo (plataforma) — múltiplas barbearias fictícias
// ---------------------------------------------------------------------------

export interface AdminCompanyRow {
  id: string;
  name: string;
  planName: string;
  status: SubscriptionStatusLabel;
  professionals: number;
  customers: number;
  nextPayment: string;
}

export type SubscriptionStatusLabel =
  | "Ativo"
  | "Pendente"
  | "Em tolerância"
  | "Suspenso"
  | "Cancelado";

export const adminCompanies: AdminCompanyRow[] = [
  {
    id: DEMO_COMPANY_ID,
    name: "Barber 013",
    planName: "Essencial",
    status: "Ativo",
    professionals: 4,
    customers: 128,
    nextPayment: d(28),
  },
  {
    id: "company-estilo-masculino",
    name: "Estilo Masculino",
    planName: "Essencial",
    status: "Ativo",
    professionals: 2,
    customers: 64,
    nextPayment: d(14),
  },
  {
    id: "company-navalha-club",
    name: "Navalha Club",
    planName: "Studio",
    status: "Ativo",
    professionals: 9,
    customers: 412,
    nextPayment: d(5),
  },
  {
    id: "company-barbearia-centro",
    name: "Barbearia do Centro",
    planName: "Essencial",
    status: "Pendente",
    professionals: 3,
    customers: 95,
    nextPayment: d(-3),
  },
  {
    id: "company-barba-cia",
    name: "Barba & Cia",
    planName: "Profissional",
    status: "Ativo",
    professionals: 5,
    customers: 201,
    nextPayment: d(19),
  },
  {
    id: "company-corte-fino",
    name: "Corte Fino",
    planName: "Essencial",
    status: "Em tolerância",
    professionals: 2,
    customers: 47,
    nextPayment: d(-6),
  },
  {
    id: "company-old-school",
    name: "Old School Barbearia",
    planName: "Profissional",
    status: "Suspenso",
    professionals: 3,
    customers: 88,
    nextPayment: d(-15),
  },
];

export const platformMetrics = {
  totalCompanies: adminCompanies.length,
  activeCompanies: adminCompanies.filter((c) => c.status === "Ativo").length,
  mrr: adminCompanies.reduce((sum, c) => {
    const plan = plans.find((p) => p.name === c.planName);
    return sum + (plan?.price ?? 0);
  }, 0),
  newCompaniesThisMonth: 2,
};

// Helpers de consulta (camada de "API" local — apenas lê os dados acima)

export function getProfessionalById(id: string) {
  return professionals.find((p) => p.id === id);
}

export function getServiceById(id: string) {
  return services.find((s) => s.id === id);
}

export function getCustomerById(id: string) {
  return customers.find((c) => c.id === id);
}

export function getAppointmentsByDate(date: string) {
  return appointments
    .filter((a) => a.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function getCustomerAppointments(customerId: string) {
  return appointments
    .filter((a) => a.customerId === customerId)
    .sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? 1 : -1));
}

const weekdayNames = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function getWeekdayName(dateStr: string): string {
  const dow = new Date(`${dateStr}T00:00:00`).getDay();
  return weekdayNames[dow];
}

export function getBusinessHoursForDate(dateStr: string): BusinessHours {
  const name = getWeekdayName(dateStr);
  return businessHours.find((b) => b.day === name) ?? businessHours[0];
}

export { todayDate };
