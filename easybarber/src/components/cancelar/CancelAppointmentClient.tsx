"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarX2, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  cancelPublicAppointment,
  type PublicAppointmentSummary,
} from "@/lib/actions/public-booking";

export function CancelAppointmentClient({
  token,
  initialSummary,
}: {
  token: string;
  initialSummary: PublicAppointmentSummary;
}) {
  const [summary, setSummary] = React.useState(initialSummary);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);
    const result = await cancelPublicAppointment(token);
    setCancelling(false);
    setConfirmOpen(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSummary(result.data);
  };

  if (!summary.found) {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-red-100 text-red-600">
          <XCircle className="size-7" />
        </span>
        <h1 className="text-lg font-bold text-brand-graphite">Link inválido</h1>
        <p className="text-sm text-brand-graphite/60">
          Não encontramos nenhum agendamento para este link. Ele pode ter expirado ou estar
          incorreto.
        </p>
      </Card>
    );
  }

  const startsAt = summary.startsAt ? new Date(summary.startsAt) : null;

  if (summary.status === "cancelado") {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="size-7" />
        </span>
        <h1 className="text-lg font-bold text-brand-graphite">Agendamento cancelado</h1>
        <p className="text-sm text-brand-graphite/60">
          {summary.serviceName} com {summary.professionalName}
          {startsAt && (
            <>
              {" "}
              — {format(startsAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </>
          )}
        </p>
        <p className="text-xs text-brand-graphite/50">
          O horário já está livre na agenda de {summary.companyName}.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-5 p-6">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
          <CalendarX2 className="size-6" />
        </span>
        <h1 className="text-lg font-bold text-brand-graphite">{summary.companyName}</h1>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-brand-surface p-4">
        <p className="text-sm font-semibold text-brand-graphite">{summary.serviceName}</p>
        <p className="text-sm text-brand-graphite/60">com {summary.professionalName}</p>
        {startsAt && (
          <p className="text-sm text-brand-graphite/60">
            {format(startsAt, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </p>
        )}
      </div>

      {summary.canCancel ? (
        <Button variant="danger" fullWidth onClick={() => setConfirmOpen(true)}>
          Cancelar agendamento
        </Button>
      ) : (
        <Alert variant="info">
          {summary.status === "concluido"
            ? "Este atendimento já foi concluído e não pode mais ser cancelado."
            : "Este horário já passou e não pode mais ser cancelado."}
        </Alert>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Cancelar agendamento"
        description="Tem certeza que deseja cancelar este agendamento? O horário será liberado para outros clientes."
        confirmLabel="Cancelar agendamento"
        busy={cancelling}
        onConfirm={handleCancel}
        onClose={() => setConfirmOpen(false)}
      />
    </Card>
  );
}
