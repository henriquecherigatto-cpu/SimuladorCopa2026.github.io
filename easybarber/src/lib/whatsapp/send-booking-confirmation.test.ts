import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicBookingResult } from "@/lib/actions/public-booking";

const { mockCreateServiceRoleClient, mockGetWhatsAppProvider, mockIsConfigured, mockSendMessage } =
  vi.hoisted(() => ({
    mockCreateServiceRoleClient: vi.fn(),
    mockGetWhatsAppProvider: vi.fn(),
    mockIsConfigured: vi.fn(),
    mockSendMessage: vi.fn(),
  }));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mockCreateServiceRoleClient,
}));

vi.mock("@/lib/whatsapp/provider", () => ({
  getWhatsAppProvider: mockGetWhatsAppProvider,
}));

const { sendBookingConfirmation } = await import("@/lib/whatsapp/send-booking-confirmation");

interface FakeClientConfig {
  eligible?: boolean;
  eligibilityError?: unknown;
  appointment?: { company_id: string; customer_id: string } | null;
  customer?: { whatsapp_opt_out: boolean } | null;
  existingMessage?: { id: string } | null;
}

function createFakeServiceClient(config: FakeClientConfig = {}) {
  const rpc = vi.fn((name: string) => {
    if (name === "whatsapp_confirmation_allowed") {
      return Promise.resolve({
        data: config.eligibilityError ? null : config.eligible ?? true,
        error: config.eligibilityError ?? null,
      });
    }
    if (name === "log_whatsapp_message" || name === "set_whatsapp_connection_error") {
      return Promise.resolve({ data: null, error: null });
    }
    throw new Error(`Unexpected rpc call: ${name}`);
  });

  const from = vi.fn((table: string) => {
    if (table === "appointments") {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data:
                  config.appointment === undefined
                    ? { company_id: "company-1", customer_id: "cust-1" }
                    : config.appointment,
                error: null,
              }),
          }),
        }),
      };
    }
    if (table === "customers") {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data:
                  config.customer === undefined ? { whatsapp_opt_out: false } : config.customer,
                error: null,
              }),
          }),
        }),
      };
    }
    if (table === "whatsapp_messages") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              neq: () => ({
                limit: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: config.existingMessage ?? null, error: null }),
                }),
              }),
            }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { rpc, from };
}

const BOOKING: PublicBookingResult = {
  id: "appt-1",
  cancelToken: "cancel-token-1",
  found: true,
  companyName: "Barbearia Teste",
  serviceName: "Corte",
  professionalName: "João",
  startsAt: "2026-01-01T12:00:00+00:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  mockSendMessage.mockResolvedValue({ ok: true, providerMessageId: "wamid.OK" });
  mockGetWhatsAppProvider.mockResolvedValue({
    name: "meta_cloud_api",
    isConfigured: mockIsConfigured,
    sendMessage: mockSendMessage,
  });
});

describe("sendBookingConfirmation", () => {
  it("sends the confirmation and logs it as sent on the happy path", async () => {
    const client = createFakeServiceClient();
    mockCreateServiceRoleClient.mockReturnValue(client);

    await sendBookingConfirmation("11999999999", BOOKING);

    expect(mockGetWhatsAppProvider).toHaveBeenCalledWith("company-1");
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith(
      "log_whatsapp_message",
      expect.objectContaining({ p_status: "sent", p_provider_message_id: "wamid.OK" }),
    );
  });

  // Scenario: a send failure must never affect the already-saved
  // appointment — this function only ever reads appointments/customers
  // and writes to whatsapp_messages, so "doesn't lose the appointment"
  // means it completes normally (no throw) and logs the failure.
  it("completes without throwing, logs a failure, and records a connection error when the send fails", async () => {
    mockSendMessage.mockResolvedValue({ ok: false, error: "Meta Graph API error (500)" });
    const client = createFakeServiceClient();
    mockCreateServiceRoleClient.mockReturnValue(client);

    await expect(sendBookingConfirmation("11999999999", BOOKING)).resolves.toBeUndefined();

    expect(client.rpc).toHaveBeenCalledWith(
      "log_whatsapp_message",
      expect.objectContaining({ p_status: "failed", p_error: "Meta Graph API error (500)" }),
    );
    expect(client.rpc).toHaveBeenCalledWith("set_whatsapp_connection_error", {
      p_company_id: "company-1",
      p_error: "Meta Graph API error (500)",
    });
  });

  // Scenario: duplicate-message prevention — a non-failed
  // booking_confirmation row already exists for this appointment.
  it("never sends again when a non-failed confirmation already exists", async () => {
    const client = createFakeServiceClient({ existingMessage: { id: "msg-1" } });
    mockCreateServiceRoleClient.mockReturnValue(client);

    await sendBookingConfirmation("11999999999", BOOKING);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  // Scenario: blocking notifications when the customer hasn't
  // authorized them (opted out).
  it("never sends to a customer who has opted out", async () => {
    const client = createFakeServiceClient({ customer: { whatsapp_opt_out: true } });
    mockCreateServiceRoleClient.mockReturnValue(client);

    await sendBookingConfirmation("11999999999", BOOKING);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("never sends when the company is not eligible (wrong plan/subscription)", async () => {
    const client = createFakeServiceClient({ eligible: false });
    mockCreateServiceRoleClient.mockReturnValue(client);

    await sendBookingConfirmation("11999999999", BOOKING);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("fails closed (never sends) when the eligibility check itself errors", async () => {
    const client = createFakeServiceClient({ eligibilityError: new Error("db unavailable") });
    mockCreateServiceRoleClient.mockReturnValue(client);

    await sendBookingConfirmation("11999999999", BOOKING);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("never sends when the provider has no connected account for the company", async () => {
    mockIsConfigured.mockReturnValue(false);
    const client = createFakeServiceClient();
    mockCreateServiceRoleClient.mockReturnValue(client);

    await sendBookingConfirmation("11999999999", BOOKING);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("does nothing at all for a booking that was never found", async () => {
    await sendBookingConfirmation("11999999999", { ...BOOKING, found: false });

    expect(mockCreateServiceRoleClient).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
