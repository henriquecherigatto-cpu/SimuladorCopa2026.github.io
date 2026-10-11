import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Scissors,
  Settings,
  UserCog,
  Users,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  matchPrefix?: string;
}

export const primaryNav: NavItem[] = [
  { label: "Painel", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/agenda", icon: CalendarDays, matchPrefix: "/agenda" },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Profissionais", href: "/profissionais", icon: UserCog },
  { label: "Serviços", href: "/servicos", icon: Scissors },
];

export const secondaryNav: NavItem[] = [
  { label: "Configurações", href: "/configuracoes", icon: Settings },
  { label: "Plano e assinatura", href: "/plano", icon: CreditCard },
];

export const adminNav: NavItem[] = [
  { label: "Administração", href: "/admin", icon: Building2 },
];

export const mobileTabNav: NavItem[] = [
  { label: "Painel", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/agenda", icon: CalendarDays, matchPrefix: "/agenda" },
  { label: "Clientes", href: "/clientes", icon: Users },
];
