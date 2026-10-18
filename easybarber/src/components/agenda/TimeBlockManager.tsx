"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { APP_TIMEZONE, cn, todayISOInAppTimezone } from "@/lib/utils";
import {
  createTimeBlock,
  deleteTimeBlock,
  listTimeBlocks,
  type TimeBlockRow,
} from "@/lib/actions/time-blocks";
import type { ProfessionalChip } from "@/components/agenda/AgendaDayView";

const todayISO = todayISOInAppTimezone;
const WHOLE_COMPANY = "";

/**
 * Owner-only: close the agenda — for everyone or for one professional
 * — over a single day or a date range (a holiday, a renovation, a
 * professional's vacation). Backed by time_blocks; professional_id =
 * null blocks the whole company, and a range spanning more than one
 * day is always treated as a full-day closure on every date in it
 * (there's no "closed 14h-17h every day of a 10-day range" case).
 */
export function TimeBlockManager({ professionals }: { professionals: ProfessionalChip[] }) {
  const [open, setOpen] = React.useState(false);
  const [blocks, setBlocks] = React.useState<TimeBlockRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [professionalId, setProfessionalId] = React.useState(WHOLE_COMPANY);
  const [startDate, setStartDate] = React.useState(todayISO());
  const [endDate, setEndDate] = React.useState(todayISO());
  const [allDay, setAllDay] = React.useState(true);
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<TimeBlockRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const isRange = endDate > startDate;

  const loadBlocks = React.useCallback(() => {
    setLoading(true);
    listTimeBlocks().then((result) => {
      setLoading(false);
      if (result.ok) setBlocks(result.data);
    });
  }, []);

  const handleOpen = () => {
    setOpen(true);
    loadBlocks();
  };

  const resetForm = () => {
    setProfessionalId(WHOLE_COMPANY);
    setStartDate(todayISO());
    setEndDate(todayISO());
    setAllDay(true);
    setStartTime("");
    setEndTime("");
    setReason("");
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!startDate || !endDate) {
      setFormError("Selecione o período.");
      return;
    }
    if (endDate < startDate) {
      setFormError("A data final deve ser igual ou depois da data inicial.");
      return;
    }
    if (!isRange && !allDay && (!startTime || !endTime)) {
      setFormError("Informe o horário de início e fim.");
      return;
    }

    setSubmitting(true);
    const result = await createTimeBlock({
      startDate,
      endDate,
      professionalId: professionalId || undefined,
      allDay: isRange ? true : allDay,
      startTime: !isRange && !allDay ? startTime : undefined,
      endTime: !isRange && !allDay ? endTime : undefined,
      reason,
    });
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    resetForm();
    loadBlocks();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteTimeBlock(deleteTarget.id);
    setDeleting(false);
    if (result.ok) {
      setDeleteTarget(null);
      loadBlocks();
    }
  };

  const describeTarget = (block: TimeBlockRow) =>
    block.professional_id
      ? professionals.find((p) => p.id === block.professional_id)?.name ?? "Profissional"
      : "Barbearia toda";

  const formatBlockRange = (block: TimeBlockRow) => {
    const start = toZonedTime(block.starts_at, APP_TIMEZONE);
    const end = toZonedTime(block.ends_at, APP_TIMEZONE);
    const sameDay = format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd");
    const isFullDay = start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 23;
    const dateLabel = format(start, "d 'de' MMMM", { locale: ptBR });
    if (isFullDay && sameDay) return `${dateLabel} · dia inteiro`;
    if (sameDay) return `${dateLabel} · ${format(start, "HH:mm")}–${format(end, "HH:mm")}`;
    return `${format(start, "dd/MM")} – ${format(end, "dd/MM")}`;
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon={<Lock className="size-4" />}
        onClick={handleOpen}
      >
        Bloquear agenda
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Bloquear agenda">
        <div className="flex flex-col gap-5">
          <p className="text-sm text-brand-graphite/60">
            Feche a agenda — de um profissional ou da barbearia toda — em
            um período. Ninguém consegue agendar nesse intervalo, nem
            pelo link público.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {formError && <Alert variant="error">{formError}</Alert>}

            <Select
              label="Quem fica bloqueado?"
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
            >
              <option value={WHOLE_COMPANY}>Barbearia toda</option>
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.name}
                </option>
              ))}
            </Select>

            <div className="grid grid-cols-2 gap-3">
              <Input
                type="date"
                label="De"
                value={startDate}
                min={todayISO()}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
              />
              <Input
                type="date"
                label="Até"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {isRange ? (
              <p className="rounded-xl bg-brand-surface px-3 py-2 text-xs text-brand-graphite/60">
                Bloqueios de mais de um dia fecham o dia inteiro em cada
                data do período.
              </p>
            ) : (
              <>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAllDay(true)}
                    className={cn(
                      "flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                      allDay
                        ? "border-brand-orange bg-brand-orange/10 text-brand-orange"
                        : "border-black/10 text-brand-graphite/60",
                    )}
                  >
                    Dia inteiro
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllDay(false)}
                    className={cn(
                      "flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                      !allDay
                        ? "border-brand-orange bg-brand-orange/10 text-brand-orange"
                        : "border-black/10 text-brand-graphite/60",
                    )}
                  >
                    Período específico
                  </button>
                </div>

                {!allDay && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="time"
                      label="Início"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                    <Input
                      type="time"
                      label="Fim"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            <Input
              label="Motivo (opcional)"
              placeholder="Ex: Feriado, reforma, férias..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <Button type="submit" fullWidth loading={submitting}>
              Bloquear
            </Button>
          </form>

          <div className="flex flex-col gap-2 border-t border-black/5 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-graphite/40">
              Bloqueios programados
            </p>
            {loading ? (
              <p className="py-3 text-center text-sm text-brand-graphite/40">Carregando...</p>
            ) : blocks.length === 0 ? (
              <p className="py-3 text-center text-sm text-brand-graphite/40">
                Nenhum bloqueio programado.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {blocks.map((block) => (
                  <li
                    key={block.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-brand-surface px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-brand-graphite">
                        {describeTarget(block)} · {formatBlockRange(block)}
                      </p>
                      {block.reason && (
                        <p className="truncate text-xs text-brand-graphite/50">{block.reason}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(block)}
                      aria-label="Remover bloqueio"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-brand-graphite/40 hover:bg-black/5 hover:text-brand-error"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remover bloqueio?"
        description={
          deleteTarget
            ? `A agenda volta a ficar disponível para "${describeTarget(deleteTarget)}" em "${formatBlockRange(deleteTarget)}".`
            : ""
        }
        confirmLabel="Remover"
        busy={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
