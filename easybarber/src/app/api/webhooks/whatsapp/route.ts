import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/**
 * Meta WhatsApp Cloud API webhook — the delivery-status callback Twilio
 * never had wired up at all (see docs/whatsapp-integration.md). Two
 * entirely separate mechanisms, per Meta's own docs — conflating them
 * is the most common webhook bug:
 *
 *   - GET: the one-time verification handshake Meta performs when you
 *     register this URL in the App Dashboard. Checked against
 *     META_WEBHOOK_VERIFY_TOKEN, a shared secret YOU choose (not
 *     provided by Meta) when configuring the webhook.
 *   - POST: every actual event delivery afterward. Verified via
 *     X-Hub-Signature-256 — an HMAC-SHA256 of the raw body, keyed with
 *     META_APP_SECRET — computed the same way billing/webhook/route.ts
 *     verifies Asaas's requests, just with HMAC instead of a static
 *     token (Meta's mechanism, not Asaas's).
 *
 * Every write this handler performs is naturally idempotent (never a
 * separate "already processed this event id" ledger): a status update
 * is monotonic (see update_whatsapp_message_status() in
 * 20260101000036_whatsapp_cloud_api_schema.sql) and an opt-out flag
 * set to true twice has the same effect as once — so Meta's
 * at-least-once, possibly out-of-order delivery is always safe here.
 */

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.replace(/^sha256=/, "");

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

const OPT_OUT_KEYWORDS = ["parar", "sair", "cancelar", "stop", "descadastrar"];

function isOptOutMessage(text: string | undefined): boolean {
  if (!text) return false;
  const normalized = text.trim().toLowerCase();
  return OPT_OUT_KEYWORDS.includes(normalized);
}

interface MetaStatusEntry {
  id?: string;
  status?: string;
  errors?: { message?: string; title?: string }[];
}

interface MetaInboundMessage {
  from?: string;
  text?: { body?: string };
  type?: string;
}

interface MetaWebhookPayload {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        statuses?: MetaStatusEntry[];
        messages?: MetaInboundMessage[];
      };
    }[];
  }[];
}

const KNOWN_STATUSES = new Set(["sent", "delivered", "read", "failed"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch (err) {
    console.error("whatsapp webhook: malformed payload", err);
    return NextResponse.json({ error: "malformed payload" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      for (const status of value.statuses ?? []) {
        if (!status.id || !status.status || !KNOWN_STATUSES.has(status.status)) continue;
        const { error } = await supabase.rpc("update_whatsapp_message_status", {
          p_provider_message_id: status.id,
          p_status: status.status as "sent" | "delivered" | "read" | "failed",
          p_error: status.errors?.[0]?.title ?? status.errors?.[0]?.message,
        });
        if (error) {
          console.error("whatsapp webhook: status update failed", error);
        }
      }

      if (value.messages?.length && value.metadata?.phone_number_id) {
        await handleInboundMessages(supabase, value.metadata.phone_number_id, value.messages);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleInboundMessages(
  supabase: ReturnType<typeof createServiceRoleClient>,
  phoneNumberId: string,
  messages: MetaInboundMessage[],
) {
  const optOutSenders = messages
    .filter((m) => isOptOutMessage(m.text?.body))
    .map((m) => m.from)
    .filter((from): from is string => !!from);

  for (const from of optOutSenders) {
    // mark_customer_whatsapp_opt_out() resolves phoneNumberId -> company
    // and normalizes both sides of the phone comparison itself — see
    // 20260101000036_whatsapp_cloud_api_schema.sql.
    const { error } = await supabase.rpc("mark_customer_whatsapp_opt_out", {
      p_phone_number_id: phoneNumberId,
      p_from_phone_digits: from,
    });
    if (error) {
      console.error("whatsapp webhook: opt-out update failed", error);
    }
  }
}
