"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Ban, CreditCard } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { SUPPORT_WHATSAPP_NUMBER } from "@/components/layout/SupportWhatsAppButton";
import { buildWhatsAppLink } from "@/lib/utils";

export type SubscriptionAlert =
  | { variant: "pendente" }
  | { variant: "suspended" }
  | { variant: "grace"; daysRemaining: number; blockDateLabel: string };

/**
 * Owner-only popup for the subscription states that affect whether
 * the barbershop can take real bookings — rendered once per fresh
 * layout mount (see (app)/layout.tsx), not re-shown on every internal
 * navigation. Closable (this is a warning, not a hard lock: the
 * platform itself stays fully reachable either way — see
 * 20260101000041_pendente_blocks_bookings.sql for what actually stays
 * locked), but reappears on the next full page load/session while the
 * underlying status holds.
 */
export function SubscriptionStatusModal({ alert }: { alert: SubscriptionAlert | null }) {
  const [open, setOpen] = React.useState(!!alert);
  const pathname = usePathname();

  if (!alert) return null;

  // A plain link to /plano is a no-op when that's already the page
  // behind this modal — Next doesn't remount on a same-route
  // navigation, so the modal just sits there looking broken. Closing
  // it instead reveals the payment block right below it.
  const onPlanoPage = pathname === "/plano";

  const whatsappHref = buildWhatsAppLink(
    SUPPORT_WHATSAPP_NUMBER,
    alert.variant === "suspended"
      ? "Olá! Minha assinatura do Easy Barber está suspensa e preciso regularizar o pagamento."
      : "Olá! Recebi um aviso de que meu pagamento do Easy Barber ainda não foi identificado.",
  );

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={undefined}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className={
            alert.variant === "suspended"
              ? "flex size-12 items-center justify-center rounded-full bg-brand-error/10 text-brand-error"
              : "flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600"
          }
        >
          {alert.variant === "suspended" ? (
            <Ban className="size-6" />
          ) : (
            <AlertTriangle className="size-6" />
          )}
        </span>

        {alert.variant === "suspended" && (
          <>
            <h2 className="text-base font-semibold text-brand-graphite">
              Acesso suspenso por falta de pagamento
            </h2>
            <p className="text-sm text-brand-graphite/70">
              Sua assinatura está suspensa. Você ainda pode acessar o sistema
              normalmente, mas <strong>novos agendamentos estão bloqueados</strong>
              {" "}— tanto os que você cria quanto os que seus clientes tentam
              fazer pelo link de agendamento — até a reativação.
            </p>
          </>
        )}

        {alert.variant === "grace" && (
          <>
            <h2 className="text-base font-semibold text-brand-graphite">
              Pagamento não identificado
            </h2>
            <p className="text-sm text-brand-graphite/70">
              Ainda não identificamos o pagamento da sua mensalidade. Você tem{" "}
              <strong>
                {alert.daysRemaining} {alert.daysRemaining === 1 ? "dia" : "dias"}
              </strong>{" "}
              para regularizar — se o pagamento não for identificado, o sistema
              será bloqueado automaticamente em{" "}
              <strong>{alert.blockDateLabel}</strong>.
            </p>
          </>
        )}

        {alert.variant === "pendente" && (
          <>
            <h2 className="text-base font-semibold text-brand-graphite">
              Assinatura ainda não ativada
            </h2>
            <p className="text-sm text-brand-graphite/70">
              Sua barbearia está configurada e pronta. Falta só ativar a
              assinatura em <strong>Plano e assinatura</strong> —{" "}
              <strong>novos agendamentos só ficam disponíveis</strong>, tanto
              os seus quanto os dos seus clientes pelo link público, depois
              que o primeiro pagamento for confirmado.
            </p>
          </>
        )}

        <div className="mt-1 flex w-full flex-col gap-2">
          {alert.variant === "pendente" ? (
            onPlanoPage ? (
              <Button
                fullWidth
                icon={<CreditCard className="size-4" />}
                onClick={() => setOpen(false)}
              >
                Ativar assinatura
              </Button>
            ) : (
              <Button href="/plano" fullWidth icon={<CreditCard className="size-4" />}>
                Ativar assinatura
              </Button>
            )
          ) : (
            <Button
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              fullWidth
              className="gap-2"
              icon={<WhatsAppIcon className="size-4" />}
            >
              Falar no WhatsApp
            </Button>
          )}
          <Button variant="ghost" fullWidth onClick={() => setOpen(false)}>
            Entendi
          </Button>
        </div>
      </div>
    </Modal>
  );
}
