"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/supabase/current-user";
import { runAction, type ActionResult } from "@/lib/actions/action-result";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { encryptToken } from "@/lib/whatsapp/token-crypto";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import type { Database } from "@/lib/supabase/database.types";

function assertOwner(role: string) {
  if (role !== "owner") {
    throw new Error("Apenas o proprietário pode gerenciar a conexão com o WhatsApp.");
  }
}

function graphApiVersion(): string {
  return process.env.META_GRAPH_API_VERSION || "v21.0";
}

export interface WhatsAppConnectionStatus {
  status: Database["public"]["Enums"]["whatsapp_connection_status"];
  displayPhoneNumber: string | null;
  connectedAt: string | null;
  lastError: string | null;
}

const DISCONNECTED_STATUS: WhatsAppConnectionStatus = {
  status: "disconnected",
  displayPhoneNumber: null,
  connectedAt: null,
  lastError: null,
};

/** Owner-or-admin-only read of this company's own connection — never the token. See get_whatsapp_connection_status(). */
export async function getWhatsAppConnectionStatus(): Promise<
  ActionResult<WhatsAppConnectionStatus>
> {
  return runAction(async () => {
    const { supabase, companyId } = await requireMembership();
    const { data, error } = await supabase.rpc("get_whatsapp_connection_status", {
      p_company_id: companyId,
    });
    if (error) throw error;

    const row = data?.[0];
    if (!row) return DISCONNECTED_STATUS;
    return {
      status: row.status,
      displayPhoneNumber: row.display_phone_number,
      connectedAt: row.connected_at,
      lastError: row.last_error,
    };
  });
}

/**
 * Confirms the access token can actually read phoneNumberId before we
 * ever store it — catches a mismatched or incomplete Embedded Signup
 * early rather than persisting a connection that can't send. Throws
 * (never returns null) so connectWhatsAppAccount's single try/catch
 * (via runAction) covers this failure the same as any other.
 */
async function fetchDisplayPhoneNumber(
  phoneNumberId: string,
  accessToken: string,
): Promise<string> {
  const url = `https://graph.facebook.com/${graphApiVersion()}/${phoneNumberId}?fields=display_phone_number`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = (await res.json().catch(() => null)) as
    | { display_phone_number?: string; error?: { message?: string } }
    | null;

  if (!res.ok || !payload?.display_phone_number) {
    throw new Error(
      payload?.error?.message ??
        "Não foi possível confirmar o número do WhatsApp conectado. Tente conectar novamente.",
    );
  }
  return payload.display_phone_number;
}

/**
 * Completes Meta's Embedded Signup flow server-side: exchanges the
 * short-lived authorization `code` the client-side JS SDK obtained
 * (never an access token itself — see runEmbeddedSignup() in
 * WhatsAppConnectionModal.tsx) for a real access token via Meta's
 * standard OAuth code-exchange endpoint, confirms that token can read
 * the phone number the signup flow reported, then stores it ENCRYPTED.
 * The plaintext token exists only in this server-side scope — it is
 * never returned to the client, logged, or stored unencrypted.
 */
export async function connectWhatsAppAccount(input: {
  code: string;
  wabaId: string;
  phoneNumberId: string;
}): Promise<ActionResult<{ displayPhoneNumber: string }>> {
  return runAction(async () => {
    const { supabase, companyId, role } = await requireMembership();
    assertOwner(role);

    const code = input.code?.trim();
    const wabaId = input.wabaId?.trim();
    const phoneNumberId = input.phoneNumberId?.trim();
    if (!code || !wabaId || !phoneNumberId) {
      throw new Error(
        "Conexão incompleta — refaça o processo de conexão do WhatsApp até o final.",
      );
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error(
        "A integração com o WhatsApp ainda não foi configurada nesta instância. Fale com o suporte.",
      );
    }

    const tokenUrl = new URL(`https://graph.facebook.com/${graphApiVersion()}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl, { method: "GET" });
    const tokenPayload = (await tokenResponse.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    } | null;

    if (!tokenResponse.ok || !tokenPayload?.access_token) {
      throw new Error(
        tokenPayload?.error?.message ??
          "Não foi possível concluir a autorização com o WhatsApp. Tente novamente.",
      );
    }

    const displayPhoneNumber = await fetchDisplayPhoneNumber(
      phoneNumberId,
      tokenPayload.access_token,
    );

    const tokenExpiresAt = tokenPayload.expires_in
      ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
      : null;

    const { error } = await supabase.rpc("set_whatsapp_connection", {
      p_company_id: companyId,
      p_waba_id: wabaId,
      p_phone_number_id: phoneNumberId,
      p_display_phone_number: displayPhoneNumber,
      p_access_token_encrypted: encryptToken(tokenPayload.access_token),
      p_token_expires_at: tokenExpiresAt,
    });
    if (error) throw error;

    revalidatePath("/configuracoes");
    return { displayPhoneNumber };
  });
}

export async function disconnectWhatsAppAccount(): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { supabase, companyId, role } = await requireMembership();
    assertOwner(role);

    const { error } = await supabase.rpc("clear_whatsapp_connection", {
      p_company_id: companyId,
    });
    if (error) throw error;

    revalidatePath("/configuracoes");
    return undefined;
  });
}

/**
 * Sends one real booking_confirmation template to a number the owner
 * chooses, so they can confirm the connection actually works. The UI
 * requires an explicit confirmation step before calling this — see the
 * ConfirmDialog in ConfiguracoesPageClient.tsx. This is the one place
 * in the whole integration that is SUPPOSED to send a real message
 * outside of the automated test suite (which mocks every send) — it
 * only ever runs when the owner deliberately triggers it.
 */
export async function sendWhatsAppTestMessage(
  testPhoneNumber: string,
): Promise<ActionResult<{ providerMessageId?: string }>> {
  return runAction(async () => {
    const { companyId, role } = await requireMembership();
    assertOwner(role);

    const to = testPhoneNumber.trim();
    if (!to) throw new Error("Informe um número de WhatsApp para enviar o teste.");

    const provider = await getWhatsAppProvider(companyId);
    if (!provider.isConfigured("booking_confirmation")) {
      throw new Error("Conecte uma conta do WhatsApp antes de enviar um teste.");
    }

    const result = await provider.sendMessage({
      to,
      template: "booking_confirmation",
      templateVariables: {
        "1": "Barbearia Teste",
        "2": "Corte de cabelo",
        "3": "Profissional Teste",
        "4": "segunda-feira, 1 de janeiro às 10:00",
        "5": `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/cancelar/teste`,
      },
    });

    const serviceRoleClient = createServiceRoleClient();
    try {
      await serviceRoleClient.rpc("log_whatsapp_message", {
        p_status: result.ok ? "sent" : "failed",
        p_provider: provider.name,
        p_company_id: companyId,
        p_provider_message_id: result.ok ? result.providerMessageId : undefined,
        p_error: result.ok ? undefined : result.error,
        p_template: "booking_confirmation",
      });
    } catch (logError) {
      console.error("Failed to log WhatsApp test message:", logError);
    }

    if (!result.ok) {
      await serviceRoleClient.rpc("set_whatsapp_connection_error", {
        p_company_id: companyId,
        p_error: result.error ?? "Falha ao enviar mensagem de teste.",
      });
    }

    revalidatePath("/configuracoes");

    if (!result.ok) {
      throw new Error(result.error ?? "Falha ao enviar a mensagem de teste.");
    }
    return { providerMessageId: result.providerMessageId };
  });
}
