"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  LifeBuoy,
  Lock,
  type LucideIcon,
  Mail,
  MessageCircle,
  Palette,
  Phone,
  SlidersHorizontal,
  UserCog,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Switch } from "@/components/ui/Switch";
import { updateCompanySettings, updateBusinessHours } from "@/lib/actions/companies";
import type { WhatsAppConnectionStatus } from "@/lib/actions/whatsapp-connection";
import { WhatsAppConnectionModal } from "@/components/configuracoes/WhatsAppConnectionModal";
import { BusinessHoursFields } from "@/components/shared/BusinessHoursFields";
import { isWhatsAppSendingEnabled } from "@/lib/whatsapp/feature-flag";
import { WEEKDAY_LABELS } from "@/lib/utils";
import type { BusinessHours } from "@/types";

interface CompanyRow {
  id: string;
  name: string;
  phone: string;
  whatsapp_number: string | null;
  address: string | null;
  cnpj: string | null;
}

interface BusinessHoursRow {
  day_of_week: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
}

// Display (and the form) always lists Monday first, matching how a
// Brazilian week reads — business_hours.day_of_week itself is
// Sunday-indexed (0-6), same convention as WEEKDAY_LABELS.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function toDisplayHours(rows: BusinessHoursRow[]): BusinessHours[] {
  return DISPLAY_ORDER.map((dayOfWeek) => {
    const row = rows.find((r) => r.day_of_week === dayOfWeek);
    return {
      day: WEEKDAY_LABELS[dayOfWeek],
      open: row?.is_open ?? false,
      // "08:00:00" (Postgres time) -> "08:00" (<input type="time">)
      start: (row?.start_time ?? "08:00").slice(0, 5),
      end: (row?.end_time ?? "18:00").slice(0, 5),
    };
  });
}

type SectionKey =
  | "company"
  | "hours"
  | "preferences"
  | "notifications"
  | "whatsapp"
  | "security"
  | "help";

interface WhatsAppConfirmationEligibility {
  planIncludesFeature: boolean;
  subscriptionActive: boolean;
}

const WHATSAPP_CONNECTION_SUBTITLE: Record<WhatsAppConnectionStatus["status"], string> = {
  disconnected: "Nenhuma conta conectada",
  connecting: "Conectando…",
  connected: "Conectado",
  error: "Erro na conexão — toque para ver detalhes",
};

export function ConfiguracoesPageClient({
  company: initialCompany,
  businessHours: initialBusinessHours,
  canManage,
  whatsappConfirmation,
  whatsappConnection: initialWhatsappConnection,
}: {
  company: CompanyRow;
  businessHours: BusinessHoursRow[];
  canManage: boolean;
  whatsappConfirmation: WhatsAppConfirmationEligibility;
  whatsappConnection: WhatsAppConnectionStatus;
}) {
  const router = useRouter();
  const [company, setCompany] = React.useState(initialCompany);
  const [hours, setHours] = React.useState<BusinessHours[]>(() =>
    toDisplayHours(initialBusinessHours),
  );
  const [whatsappConnection, setWhatsappConnection] = React.useState(initialWhatsappConnection);
  const [open, setOpen] = React.useState<SectionKey | null>(null);
  const [savedMessage, setSavedMessage] = React.useState<string | null>(null);

  const flashSaved = (message: string) => {
    setOpen(null);
    setSavedMessage(message);
    setTimeout(() => setSavedMessage(null), 4000);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Configurações"
        description="Gerencie as preferências da sua barbearia."
      />

      {savedMessage && <Alert variant="success">{savedMessage}</Alert>}

      <Card className="divide-y divide-black/5 overflow-hidden">
        <SettingsRow
          icon={Building2}
          title="Dados da barbearia"
          subtitle={company.name}
          onClick={() => setOpen("company")}
        />
        <SettingsRow
          icon={Clock}
          title="Horário de funcionamento"
          subtitle={`${hours.filter((h) => h.open).length} dias abertos por semana`}
          onClick={() => setOpen("hours")}
        />
        <SettingsRow
          icon={UserCog}
          title="Profissionais e permissões"
          subtitle="Gerencie sua equipe"
          href="/profissionais"
        />
        <SettingsRow
          icon={SlidersHorizontal}
          title="Preferências de agenda"
          subtitle="Intervalos, confirmação automática"
          onClick={() => setOpen("preferences")}
        />
        <SettingsRow
          icon={Bell}
          title="Notificações"
          subtitle="Lembretes de agendamento"
          onClick={() => setOpen("notifications")}
        />
        {isWhatsAppSendingEnabled() ? (
          canManage && (
            <SettingsRow
              icon={MessageCircle}
              title="Integração com WhatsApp"
              subtitle={WHATSAPP_CONNECTION_SUBTITLE[whatsappConnection.status]}
              onClick={() => setOpen("whatsapp")}
            />
          )
        ) : (
          <SettingsRow
            icon={MessageCircle}
            title="Integração com WhatsApp"
            subtitle="Confirmação automática de agendamento"
            disabled
          />
        )}
        <SettingsRow
          icon={Palette}
          title="Personalização"
          subtitle="Cores e identidade visual"
          disabled
        />
        <SettingsRow
          icon={Lock}
          title="Segurança da conta"
          subtitle="Senha e autenticação"
          onClick={() => setOpen("security")}
        />
        <SettingsRow
          icon={HelpCircle}
          title="Ajuda e suporte"
          subtitle="Fale com a nossa equipe"
          onClick={() => setOpen("help")}
        />
      </Card>

      <CompanyModal
        open={open === "company"}
        company={company}
        canManage={canManage}
        whatsappConfirmation={whatsappConfirmation}
        onClose={() => setOpen(null)}
        onSave={(data) => {
          setCompany((c) => ({ ...c, ...data }));
          flashSaved("Dados da barbearia atualizados.");
          router.refresh();
        }}
      />
      <BusinessHoursModal
        open={open === "hours"}
        hours={hours}
        onClose={() => setOpen(null)}
        onSave={(next) => {
          setHours(next);
          flashSaved("Horário de funcionamento atualizado.");
        }}
      />
      <PreferencesModal
        open={open === "preferences"}
        onClose={() => setOpen(null)}
        onSave={() => flashSaved("Preferências de agenda atualizadas.")}
      />
      <NotificationsModal
        open={open === "notifications"}
        onClose={() => setOpen(null)}
        onSave={() => flashSaved("Preferências de notificação atualizadas.")}
      />
      <WhatsAppConnectionModal
        open={open === "whatsapp"}
        onClose={() => setOpen(null)}
        initialStatus={whatsappConnection}
        onStatusChange={setWhatsappConnection}
      />
      <SecurityModal
        open={open === "security"}
        onClose={() => setOpen(null)}
        onSave={() => flashSaved("Senha atualizada com sucesso.")}
      />
      <HelpModal open={open === "help"} onClose={() => setOpen(null)} />
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
  href,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const content = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-brand-graphite">{title}</p>
        {subtitle && (
          <p className="truncate text-xs text-brand-graphite/50">{subtitle}</p>
        )}
      </div>
      {disabled ? (
        <Badge variant="neutral">Em breve</Badge>
      ) : (
        <ChevronRight className="size-4 shrink-0 text-brand-graphite/30" />
      )}
    </>
  );

  const className =
    "flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-brand-surface disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent sm:px-5";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} className={className}>
      {content}
    </button>
  );
}

function CompanyModal({
  open,
  company,
  canManage,
  whatsappConfirmation,
  onClose,
  onSave,
}: {
  open: boolean;
  company: CompanyRow;
  canManage: boolean;
  whatsappConfirmation: WhatsAppConfirmationEligibility;
  onClose: () => void;
  onSave: (data: Partial<CompanyRow>) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Dados da barbearia">
      {open && (
        <CompanyFormFields
          company={company}
          canManage={canManage}
          whatsappConfirmation={whatsappConfirmation}
          onSave={onSave}
        />
      )}
    </Modal>
  );
}

function WhatsAppConfirmationNote({
  eligibility,
}: {
  eligibility: WhatsAppConfirmationEligibility;
}) {
  // The feature itself is paused (see feature-flag.ts) and the plan
  // that would unlock it is marked "coming soon" — pointing someone
  // at an unpurchasable plan for a feature that doesn't send yet
  // would be actively misleading.
  if (!isWhatsAppSendingEnabled()) return null;
  if (eligibility.planIncludesFeature && eligibility.subscriptionActive) {
    return null;
  }

  const message = !eligibility.planIncludesFeature
    ? "A confirmação automática do agendamento por WhatsApp é exclusiva do plano Profissional."
    : "Sua assinatura precisa estar em dia para a confirmação automática por WhatsApp voltar a funcionar.";

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-brand-surface p-3.5">
      <p className="text-sm text-brand-graphite/70">{message}</p>
      <Link
        href="/plano"
        className="text-sm font-medium text-brand-orange hover:underline"
      >
        {!eligibility.planIncludesFeature ? "Ver planos" : "Ver assinatura"} →
      </Link>
    </div>
  );
}

function CompanyFormFields({
  company,
  canManage,
  whatsappConfirmation,
  onSave,
}: {
  company: CompanyRow;
  canManage: boolean;
  whatsappConfirmation: WhatsAppConfirmationEligibility;
  onSave: (data: Partial<CompanyRow>) => void;
}) {
  const [name, setName] = React.useState(company.name);
  const [phone, setPhone] = React.useState(company.phone);
  const [whatsappNumber, setWhatsappNumber] = React.useState(company.whatsapp_number ?? "");
  const [address, setAddress] = React.useState(company.address ?? "");
  const [cnpj, setCnpj] = React.useState(company.cnpj ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setError(null);
    setSubmitting(true);
    const result = await updateCompanySettings({
      name,
      phone,
      whatsappNumber,
      address,
      cnpj,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSave({
      name: name.trim(),
      phone: phone.trim(),
      whatsapp_number: whatsappNumber.trim() || null,
      address: address.trim() || null,
      cnpj: cnpj.trim() || null,
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <Alert variant="error">{error}</Alert>}
      {!canManage && (
        <Alert variant="info">Apenas o proprietário pode alterar os dados da barbearia.</Alert>
      )}
      <Input
        label="Nome da barbearia"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={!canManage}
      />
      <Input
        label="Telefone"
        leftIcon={<Phone className="size-4" />}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={!canManage}
      />
      <Input
        label="Número do WhatsApp"
        type="tel"
        leftIcon={<MessageCircle className="size-4" />}
        value={whatsappNumber}
        onChange={(e) => setWhatsappNumber(e.target.value)}
        placeholder="(19) 99999-9999"
        hint="Usado no botão de WhatsApp da página pública. Se deixar em branco, usamos o telefone acima."
        disabled={!canManage}
      />
      <WhatsAppConfirmationNote eligibility={whatsappConfirmation} />
      <Input
        label="Endereço"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        disabled={!canManage}
      />
      <Input
        label="CPF ou CNPJ"
        leftIcon={<FileText className="size-4" />}
        value={cnpj}
        onChange={(e) => setCnpj(e.target.value)}
        placeholder="Apenas números"
        hint="Necessário para gerar cobranças via Pix na tela de Plano e assinatura. Pode ser o CPF do responsável ou o CNPJ da barbearia — o que você tiver."
        disabled={!canManage}
      />
      {canManage && (
        <Button type="submit" fullWidth loading={submitting}>
          Salvar alterações
        </Button>
      )}
    </form>
  );
}

function BusinessHoursModal({
  open,
  hours,
  onClose,
  onSave,
}: {
  open: boolean;
  hours: BusinessHours[];
  onClose: () => void;
  onSave: (hours: BusinessHours[]) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Horário de funcionamento" className="max-w-lg">
      {open && <BusinessHoursFormFields hours={hours} onSave={onSave} />}
    </Modal>
  );
}

function BusinessHoursFormFields({
  hours,
  onSave,
}: {
  hours: BusinessHours[];
  onSave: (hours: BusinessHours[]) => void;
}) {
  const [draft, setDraft] = React.useState(hours);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    const result = await updateBusinessHours(draft);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSave(draft);
  };

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert variant="error">{error}</Alert>}
      <BusinessHoursFields hours={draft} onChange={setDraft} />
      <Button fullWidth loading={submitting} onClick={onSubmit}>
        Salvar horários
      </Button>
    </div>
  );
}

function PreferencesModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [interval, setIntervalMin] = React.useState("15");
  const [showCancelled, setShowCancelled] = React.useState(true);

  return (
    <Modal open={open} onClose={onClose} title="Preferências de agenda">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-graphite">
            Intervalo entre horários disponíveis
          </label>
          <select
            value={interval}
            onChange={(e) => setIntervalMin(e.target.value)}
            className="h-11 rounded-xl border border-black/10 px-3.5 text-sm"
          >
            <option value="15">15 minutos</option>
            <option value="30">30 minutos</option>
            <option value="60">60 minutos</option>
          </select>
        </div>
        <ToggleRow
          label="Exibir agendamentos cancelados na agenda"
          checked={showCancelled}
          onChange={setShowCancelled}
        />
        <Button fullWidth onClick={onSave}>
          Salvar preferências
        </Button>
      </div>
    </Modal>
  );
}

function NotificationsModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [email, setEmail] = React.useState(true);
  const [whatsapp, setWhatsapp] = React.useState(true);
  const [cancelAlert, setCancelAlert] = React.useState(false);

  return (
    <Modal open={open} onClose={onClose} title="Notificações">
      <div className="flex flex-col gap-4">
        <ToggleRow
          label="Lembrete por e-mail"
          description="Enviado 24h antes do atendimento"
          checked={email}
          onChange={setEmail}
        />
        <ToggleRow
          label="Lembrete por WhatsApp"
          checked={whatsapp}
          onChange={setWhatsapp}
        />
        <ToggleRow
          label="Avisar sobre cancelamentos"
          checked={cancelAlert}
          onChange={setCancelAlert}
        />
        <Button fullWidth onClick={onSave}>
          Salvar notificações
        </Button>
      </div>
    </Modal>
  );
}

function SecurityModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Segurança da conta">
      {open && <SecurityFormFields onSave={onSave} />}
    </Modal>
  );
}

function SecurityFormFields({ onSave }: { onSave: () => void }) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!current || next.length < 6) {
          setError("Informe a senha atual e uma nova senha com 6+ caracteres.");
          return;
        }
        onSave();
      }}
      className="flex flex-col gap-4"
    >
      {error && <Alert variant="error">{error}</Alert>}
      <Input
        label="Senha atual"
        type="password"
        leftIcon={<Lock className="size-4" />}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <Input
        label="Nova senha"
        type="password"
        leftIcon={<Lock className="size-4" />}
        value={next}
        onChange={(e) => setNext(e.target.value)}
        hint="Mínimo de 6 caracteres"
      />
      <Button type="submit" fullWidth>
        Atualizar senha
      </Button>
    </form>
  );
}

function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Ajuda e suporte">
      <div className="flex flex-col gap-4 text-sm text-brand-graphite/70">
        <div className="flex items-center gap-3 rounded-xl bg-brand-surface p-3">
          <Mail className="size-4 shrink-0 text-brand-orange" />
          <div>
            <p className="font-medium text-brand-graphite">E-mail de suporte</p>
            <p>suporte@easybarber.com.br</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-brand-surface p-3">
          <LifeBuoy className="size-4 shrink-0 text-brand-orange" />
          <div>
            <p className="font-medium text-brand-graphite">Central de ajuda</p>
            <p>Perguntas frequentes e tutoriais em breve.</p>
          </div>
        </div>
        <Button variant="secondary" fullWidth onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Modal>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-brand-graphite">{label}</p>
        {description && (
          <p className="text-xs text-brand-graphite/50">{description}</p>
        )}
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}
