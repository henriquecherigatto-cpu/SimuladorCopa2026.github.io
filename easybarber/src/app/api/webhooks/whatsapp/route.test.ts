import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ rpc: mockRpc }),
}));

import { GET, POST } from "@/app/api/webhooks/whatsapp/route";

const APP_SECRET = "test-app-secret";
const VERIFY_TOKEN = "test-verify-token";

function sign(rawBody: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(rawBody, "utf8").digest("hex")}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("META_APP_SECRET", APP_SECRET);
  vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", VERIFY_TOKEN);
  mockRpc.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/webhooks/whatsapp — one-time verification handshake", () => {
  it("echoes the challenge when hub.mode and hub.verify_token match", async () => {
    const url = `https://example.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1234`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("1234");
  });

  it("rejects a wrong verify_token", async () => {
    const url = `https://example.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1234`;
    const res = await GET(new Request(url));
    expect(res.status).toBe(403);
  });
});

// Scenario 7: webhook signature validation — distinct from the GET
// handshake above, this is the per-delivery X-Hub-Signature-256 check
// (HMAC-SHA256 over the raw body, keyed with META_APP_SECRET).
describe("POST /api/webhooks/whatsapp — per-delivery signature validation", () => {
  const statusPayload = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              statuses: [{ id: "wamid.1", status: "delivered" }],
            },
          },
        ],
      },
    ],
  });

  it("accepts a correctly signed request and updates the message status", async () => {
    const res = await POST(
      new Request("https://example.com/api/webhooks/whatsapp", {
        method: "POST",
        body: statusPayload,
        headers: { "x-hub-signature-256": sign(statusPayload) },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("update_whatsapp_message_status", {
      p_provider_message_id: "wamid.1",
      p_status: "delivered",
      p_error: undefined,
    });
  });

  it("rejects a tampered body even with a signature valid for the original body", async () => {
    const tamperedBody = statusPayload.replace("delivered", "read");

    const res = await POST(
      new Request("https://example.com/api/webhooks/whatsapp", {
        method: "POST",
        body: tamperedBody,
        headers: { "x-hub-signature-256": sign(statusPayload) },
      }),
    );

    expect(res.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects a request with no signature header at all", async () => {
    const res = await POST(
      new Request("https://example.com/api/webhooks/whatsapp", {
        method: "POST",
        body: statusPayload,
      }),
    );

    expect(res.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const wrongSignature = `sha256=${createHmac("sha256", "wrong-secret")
      .update(statusPayload, "utf8")
      .digest("hex")}`;

    const res = await POST(
      new Request("https://example.com/api/webhooks/whatsapp", {
        method: "POST",
        body: statusPayload,
        headers: { "x-hub-signature-256": wrongSignature },
      }),
    );

    expect(res.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("processes an inbound opt-out keyword reply", async () => {
    const optOutPayload = JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "123" },
                messages: [{ from: "5511999999999", text: { body: "PARAR" } }],
              },
            },
          ],
        },
      ],
    });

    const res = await POST(
      new Request("https://example.com/api/webhooks/whatsapp", {
        method: "POST",
        body: optOutPayload,
        headers: { "x-hub-signature-256": sign(optOutPayload) },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("mark_customer_whatsapp_opt_out", {
      p_phone_number_id: "123",
      p_from_phone_digits: "5511999999999",
    });
  });
});
