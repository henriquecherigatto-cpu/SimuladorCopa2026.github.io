import type { Metadata } from "next";
import { getPublicAppointmentByToken } from "@/lib/actions/public-booking";
import { CancelAppointmentClient } from "@/components/cancelar/CancelAppointmentClient";

export const metadata: Metadata = { title: "Cancelar agendamento — Easy Barber" };

export default async function CancelarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPublicAppointmentByToken(token);
  const summary = result.ok ? result.data : { found: false as const };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-brand-surface px-4 py-10">
      <div className="w-full max-w-md">
        <CancelAppointmentClient token={token} initialSummary={summary} />
      </div>
      <p className="mt-6 text-center text-xs text-brand-graphite/40">
        Agendamento via Easy Barber
      </p>
    </div>
  );
}
