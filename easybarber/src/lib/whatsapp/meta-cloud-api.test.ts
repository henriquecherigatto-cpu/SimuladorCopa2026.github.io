import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockDecryptToken, mockMaybeSingle } = vi.hoisted(() => ({
  mockDecryptToken: vi.fn(),
  mockMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/whatsapp/token-crypto", () => ({
  decryptToken: mockDecryptToken,
  encryptToken: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
  }),
}));

import { createMetaCloudApiProvider } from "@/lib/whatsapp/meta-cloud-api";

const CONNECTED_ROW = {
  status: "connected",
  phone_number_id: "1234567890",
  access_token_encrypted: "iv:tag:ciphertext",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockDecryptToken.mockReturnValue("real-access-token");
  mockMaybeSingle.mockResolvedValue({ data: CONNECTED_ROW, error: null });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("MetaCloudApiProvider.sendMessage", () => {
  // Scenario 1: valid credentials, valid send.
  it("sends successfully with valid credentials and returns Meta's message id", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.ABC" }] }), { status: 200 }),
    );

    const provider = await createMetaCloudApiProvider("company-1");
    const result = await provider.sendMessage({
      to: "11999999999",
      template: "booking_confirmation",
      templateVariables: { "1": "Barbearia X" },
    });

    expect(result).toEqual({ ok: true, providerMessageId: "wamid.ABC" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/1234567890/messages");
    expect(init.headers.authorization).toBe("Bearer real-access-token");
    const body = JSON.parse(init.body);
    expect(body.to).toBe("5511999999999");
    expect(body.template.name).toBe("booking_confirmation");
  });

  // Scenario 2: invalid credentials / Meta API error — surfaced as a
  // normal {ok:false}, never thrown, and never retried (the request
  // reached Meta and was explicitly rejected, not rate-limited).
  it("returns a friendly error for invalid credentials without retrying", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Invalid OAuth access token.", code: 190 } }),
        { status: 401 },
      ),
    );

    const provider = await createMetaCloudApiProvider("company-1");
    const result = await provider.sendMessage({
      to: "11999999999",
      template: "booking_confirmation",
      templateVariables: {},
    });

    expect(result).toEqual({ ok: false, error: "Invalid OAuth access token." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Scenario 3: missing/invalid phone number — Meta itself rejects the
  // "to" field; same non-retried {ok:false} handling as any other
  // non-rate-limit error response.
  it("surfaces Meta's rejection of an invalid phone number without retrying", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Invalid parameter", code: 100 } }), {
        status: 400,
      }),
    );

    const provider = await createMetaCloudApiProvider("company-1");
    const result = await provider.sendMessage({
      to: "",
      template: "booking_confirmation",
      templateVariables: {},
    });

    expect(result).toEqual({ ok: false, error: "Invalid parameter" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).to).toBe("55");
  });

  it("retries a rate-limited (429) request and succeeds on the next attempt", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Too many requests", code: 4 } }), {
          status: 429,
          headers: { "retry-after": "0" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ messages: [{ id: "wamid.RETRY" }] }), { status: 200 }),
      );

    const provider = await createMetaCloudApiProvider("company-1");
    const result = await provider.sendMessage({
      to: "11999999999",
      template: "booking_confirmation",
      templateVariables: {},
    });

    expect(result).toEqual({ ok: true, providerMessageId: "wamid.RETRY" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries after a thrown network/timeout error and succeeds on the next attempt", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ messages: [{ id: "wamid.NET" }] }), { status: 200 }),
      );

    const provider = await createMetaCloudApiProvider("company-1");
    const result = await provider.sendMessage({
      to: "11999999999",
      template: "booking_confirmation",
      templateVariables: {},
    });

    expect(result).toEqual({ ok: true, providerMessageId: "wamid.NET" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("is not configured, and never calls Meta, when the company has no connected account", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const provider = await createMetaCloudApiProvider("company-2");
    expect(provider.isConfigured("booking_confirmation")).toBe(false);

    const result = await provider.sendMessage({
      to: "11999999999",
      template: "booking_confirmation",
      templateVariables: {},
    });

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
