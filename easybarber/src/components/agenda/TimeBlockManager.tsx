"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import {
  createCompanyTimeBlock,
  deleteCompanyTimeBlock,
  listCompanyTimeBlocks,
  type CompanyTimeBlockRow,
} from "@/lib/actions/time-blocks";

const todayISO = () => format(new Date(), "yyyy-MM-dd");

/**
 * Owner-only: close the whole agenda (every professional) for a date
 * — a holiday, a full-day shutdown, or just part of a day (e.g. a
 * morning reserved for a store event). Backed by time_blocks with
 * professional_id = null, which the booking RPCs and the
 * business-hours trigger already treat as a hard block — this only
 * adds the owner-facing create/list/delete UI on top.
 */
export function TimeBlockManager() {
  const [open, setOpen] = React.useState(false);
  const [blocks, setBlocks] = React.useState<CompanyTimeBlockRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [date, setDate] = React.useState(todayISO());
  const [allDay, setAllDay] = React.useState(true);
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CompanyTimeBlockRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const loadBlocks = React.useCallback(() => {
    setLoading(true);
    listCompanyTimeBlocks().then((result) => {
      setLoading(false);
      if (result.ok) setBlocks(result.data);
    });
  }, []);

  const handleOpen = () => {
    setOpen(true);
    loadBlocks();
  };

  const resetForm = () => {
    setDate(todayISO());
    setAllDay(true);
    setStartTime("");
    setEndTime("");
    setReason("");
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!date) {
      setFormError("Selecione uma data.");
      return;
    }
    if (!allDay && (!startTime || !endTime)) {
      setFormError("Informe o horário de início e fim.");
      return;
    }

    setSubmitting(true);
    const result = await createCompanyTimeBlock({
      date,
      allDay,
      startTime: allDay ? undefined : startTime,
      endTime: allDay ? undefined : endTime,
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
    const result = await deleteCompanyTimeBlock(deleteTarget.id);
    setDeleting(false);
    if (result.ok) {
      setDeleteTarget(null);
      loadBlocks();
    }
  };

  const formatBlockRange = (block: CompanyTimeBlockRow) => {
    const start = new Date(block.starts_at);
    const end = new Date(block.ends_at);
    const sameDay = format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd");
    const isFullDay = start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 23;
    const dateLabel = format(start, "d 'de' MMMM", { locale: ptBR });
    if (isFullDay && sameDay) return `${dateLabel} · dia inteiro`;
    if (sameDay) return `${dateLabel} · ${format(start, "HH:mm")}–${format(end, "HH:mm")}`;
    return `${format(start, "dd/MM HH:mm")} – ${format(end, "dd/MM HH:mm")}`;
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon={<Lock className="size-4" />}
        onClick={handleOpen}
      >
        <span className="hidden sm:inline">Bloquear dia</span>
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Bloquear agenda">
        <div className="flex flex-col gap-5">
          <p className="text-sm text-brand-graphite/60">
            Feche a agenda para todos os profissionais em uma data — um
            feriado, uma reforma, um evento. Ninguém consegue agendar nesse
            período, nem pelo link público.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {formError && <Alert variant="error">{formError}</Alert>}

            <Input
              type="date"
              label="Data"
              value={date}
              min={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />

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

            <Input
              label="Motivo (opcional)"
              placeholder="Ex: Feriado, reforma..."
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
                        {formatBlockRange(block)}
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
            ? `A agenda volta a ficar disponível em "${formatBlockRange(deleteTarget)}".`
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
