"use client";

import * as React from "react";
import { AlertTriangle, Ban } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { SUPPORT_WHATSAPP_NUMBER } from "@/components/layout/SupportWhatsAppButton";
import { buildWhatsAppLink } from "@/lib/utils";

export type SubscriptionAlert =
  | { variant: "suspended" }
  | { variant: "grace"; daysRemaining: number; blockDateLabel: string };

/**
 * Owner-only popup for the two subscription states that affect
 * whether the barbershop can keep booking — rendered once per fresh
 * layout mount (see (app)/layout.tsx), not re-shown on every internal
 * navigation. Closable (this is a warning, not a hard lock: the
 * platform itself stays fully reachable either way), but reappears on
 * the next full page load/session while the underlying status holds.
 */
export function SubscriptionStatusModal({ alert }: { alert: SubscriptionAlert | null }) {
  const [open, setOpen] = React.useState(!!alert);

  if (!alert) return null;

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

        {alert.variant === "suspended" ? (
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
        ) : (
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

        <div className="mt-1 flex w-full flex-col gap-2">
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
          <Button variant="ghost" fullWidth onClick={() => setOpen(false)}>
            Entendi
          </Button>
        </div>
      </div>
    </Modal>
  );
}
