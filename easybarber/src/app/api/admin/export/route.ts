import { NextResponse } from "next/server";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import {
  NotAuthenticatedError,
  NotPlatformAdminError,
  requirePlatformAdmin,
} from "@/lib/supabase/current-user";
import type { AdminCompanyRow } from "@/lib/actions/admin";

const statusLabel: Record<string, string> = {
  ativa: "Ativa",
  pendente: "Pendente",
  tolerancia: "Em tolerância",
  suspensa: "Suspensa",
  cancelada: "Cancelada",
};

function toRow(c: AdminCompanyRow, appUrl: string) {
  return {
    Empresa: c.company_name,
    Telefone: c.company_phone ?? "",
    Endereço: c.company_address ?? "",
    CNPJ: c.company_cnpj ?? "",
    "E-mail do responsável": c.owner_email ?? "",
    "Link de agendamento": `${appUrl}/agendar/${c.company_slug}`,
    "Cadastrada em": format(new Date(c.company_created_at), "dd/MM/yyyy"),
    Plano: c.plan_name ?? "—",
    "Valor do plano (R$)": c.plan_price_cents != null ? c.plan_price_cents / 100 : "",
    "Status de pagamento": c.subscription_status ? statusLabel[c.subscription_status] : "—",
    "Próximo pagamento": c.next_payment_date
      ? format(new Date(`${c.next_payment_date}T00:00:00`), "dd/MM/yyyy")
      : "",
    "Profissionais ativos": c.professional_count,
    "Clientes cadastrados": c.customer_count,
    "Agendamentos (total)": c.appointment_count,
    "Agendamentos (este mês)": c.appointments_this_month,
    "Mensagens WhatsApp (total)": c.whatsapp_message_count,
    "Custo WhatsApp (R$)": c.whatsapp_cost_cents / 100,
  };
}

/**
 * Admin-only: generates an .xlsx with the full company roster for
 * download. Reuses admin_company_overview() — the same RPC behind the
 * on-screen "Empresas" table — so this is always exactly what's
 * currently in the database, never a separately-maintained query.
 */
export async function GET() {
  try {
    const { supabase } = await requirePlatformAdmin();
    const { data, error } = await supabase.rpc("admin_company_overview");
    if (error) throw error;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const rows = ((data ?? []) as AdminCompanyRow[]).map((c) => toRow(c, appUrl));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = Object.keys(rows[0] ?? {}).map(() => ({ wch: 22 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Barbearias");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="barbearias-${format(new Date(), "yyyy-MM-dd")}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof NotPlatformAdminError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao gerar o arquivo." }, { status: 500 });
  }
}
