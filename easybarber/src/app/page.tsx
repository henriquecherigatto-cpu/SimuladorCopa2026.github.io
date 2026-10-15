import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  LayoutDashboard,
  Scissors,
  Smartphone,
  Users,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { PhoneMockup } from "@/components/marketing/PhoneMockup";
import { GraphicPanel } from "@/components/marketing/GraphicPanel";
import { buildWhatsAppLink } from "@/lib/utils";
import { SUPPORT_WHATSAPP_NUMBER } from "@/components/layout/SupportWhatsAppButton";

export const metadata: Metadata = {
  title: "Easy Barber — Sua barbearia organizada de forma simples",
  description:
    "Sistema completo de agendamento e gestão para barbearias: agenda online, clientes, profissionais e serviços em um só lugar.",
};

const TRUST_BULLETS = ["Acesso pela internet", "Funciona no celular", "Suporte especializado"];

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Agendamento online",
    description: "Clientes marcam horário sozinhos, 24 horas por dia, pelo link da sua barbearia.",
  },
  {
    icon: Users,
    title: "Gestão de clientes",
    description: "Cadastre clientes e acompanhe o histórico de atendimentos de cada um.",
  },
  {
    icon: Scissors,
    title: "Profissionais e serviços",
    description: "Defina quem atende o quê, com duração e preço de cada serviço.",
  },
  {
    icon: LayoutDashboard,
    title: "Painel do dia",
    description: "Veja de relance quantos agendamentos, clientes novos e quanto já faturou no dia.",
  },
  {
    icon: Smartphone,
    title: "Acesso em qualquer lugar",
    description: "Funciona direto do navegador, no computador ou no celular — sem instalar nada.",
  },
];

const BENEFITS = [
  "Menos tempo organizando horário pelo WhatsApp",
  "Agenda sempre atualizada, sem conflito de horário",
  "Mais controle sobre clientes e profissionais",
  "Fácil de usar, sem complicação",
];

export default function MarketingHomePage() {
  const whatsappHref = buildWhatsAppLink(
    SUPPORT_WHATSAPP_NUMBER,
    "Olá! Quero saber mais sobre o Easy Barber.",
  );

  return (
    <div className="flex min-h-dvh flex-col bg-brand-surface">
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section id="inicio" className="relative overflow-hidden bg-brand-graphite">
          <div
            className="pointer-events-none absolute -right-40 -top-40 size-[560px] rounded-full bg-brand-orange/25 blur-[120px]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -left-32 bottom-0 size-[420px] rounded-full bg-brand-orange/10 blur-[100px]"
            aria-hidden="true"
          />
          <div
            className="bg-grain pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
            aria-hidden="true"
          />

          <div className="relative mx-auto grid max-w-6xl gap-16 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10 lg:py-28">
            <div className="flex flex-col gap-6">
              <span
                className="inline-flex w-fit items-center rounded-full border border-brand-orange/30 bg-brand-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-orange"
                style={{ animation: "fade-up 0.6s ease both" }}
              >
                Sua barbearia organizada de forma simples
              </span>
              <h1
                className="font-display text-4xl font-semibold leading-[1.08] text-white sm:text-5xl lg:text-[3.4rem]"
                style={{ animation: "fade-up 0.6s ease 0.08s both" }}
              >
                Mais tempo para o que <span className="text-brand-orange">realmente importa</span>.
              </h1>
              <p
                className="max-w-md text-base text-white/70 sm:text-lg"
                style={{ animation: "fade-up 0.6s ease 0.16s both" }}
              >
                O Easy Barber é um sistema completo de agendamento e gestão para barbearias.
                Organize sua agenda, gerencie clientes, profissionais e serviços, tudo em um só
                lugar, de forma simples e moderna.
              </p>
              <div
                className="flex flex-wrap items-center gap-3"
                style={{ animation: "fade-up 0.6s ease 0.24s both" }}
              >
                <Button
                  href="/cadastro"
                  size="lg"
                  className="gap-2 rounded-full"
                  icon={<ArrowRight className="size-4" />}
                >
                  Começar agora
                </Button>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  <WhatsAppIcon className="size-4" />
                  Falar no WhatsApp
                </a>
              </div>
              <ul
                className="flex flex-wrap gap-x-6 gap-y-2"
                style={{ animation: "fade-up 0.6s ease 0.32s both" }}
              >
                {TRUST_BULLETS.map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-sm text-white/70">
                    <CheckCircle2 className="size-4 shrink-0 text-brand-orange" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="relative mx-auto h-[380px] w-full max-w-sm lg:h-[480px] lg:max-w-none"
              style={{ animation: "fade-scale 0.7s ease 0.3s both" }}
            >
              <PhoneMockup
                src="/marketing/screenshot-agenda.png"
                alt="Tela de agenda do Easy Barber"
                className="left-2 top-10 -rotate-6 sm:left-8 lg:left-10"
              />
              <PhoneMockup
                src="/marketing/screenshot-dashboard.png"
                alt="Painel inicial do Easy Barber"
                className="right-2 top-0 rotate-3 sm:right-6 lg:right-4"
                priority
              />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="funcionalidades" className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-xl text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-orange">
                Funcionalidades
              </span>
              <h2 className="mt-3 font-display text-3xl font-semibold text-brand-graphite sm:text-4xl">
                Tudo que sua barbearia precisa, num só lugar
              </h2>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
                >
                  <span className="flex size-12 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange transition-colors group-hover:bg-brand-orange group-hover:text-white">
                    <feature.icon className="size-6" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold text-brand-graphite">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-brand-graphite/60">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Built for barbershops */}
        <section className="bg-brand-graphite px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            <GraphicPanel />
            <div className="flex flex-col gap-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-orange">
                Feito para barbearias
              </span>
              <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">
                Simplifique a rotina da sua barbearia
              </h2>
              <p className="text-white/70">
                Com o Easy Barber, você reduz a bagunça na agenda, organiza seus profissionais e
                oferece uma experiência melhor para seus clientes.
              </p>
              <ul className="flex flex-col gap-3">
                {BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2.5 text-sm text-white/85">
                    <CheckCircle2 className="size-5 shrink-0 text-brand-orange" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <Button href="/cadastro" size="lg" className="rounded-full">
                  Começar agora
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="bg-brand-orange px-4 py-16 text-center sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">
              Pronto para organizar sua barbearia?
            </h2>
            <p className="mt-3 text-white/90">
              Comece agora e tenha sua agenda funcionando em poucos minutos.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button href="/cadastro" size="lg" variant="secondary" className="rounded-full">
                Começar agora
              </Button>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <WhatsAppIcon className="size-4" />
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-brand-black px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <Logo wordmarkClassName="text-white" />
          <div className="flex items-center gap-5 text-sm text-white/50">
            <Link href="/login" className="transition-colors hover:text-white">
              Entrar
            </Link>
            <Link href="/cadastro" className="transition-colors hover:text-white">
              Criar conta
            </Link>
          </div>
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Easy Barber. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
