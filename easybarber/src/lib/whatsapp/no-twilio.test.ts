import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
  }),
}));

import { getWhatsAppProvider } from "@/lib/whatsapp/provider";

// Scenario 10: absence of a functional Twilio dependency. twilio.ts
// itself still exists on disk (removal is deliberately deferred to
// after this migration is tested — see docs/whatsapp-integration.md),
// but nothing in the active send path may import or call it anymore.
describe("no functional Twilio dependency remains in the active send path", () => {
  it("getWhatsAppProvider always resolves to the Meta Cloud API provider, never Twilio", async () => {
    const provider = await getWhatsAppProvider("any-company-id");
    expect(provider.name).toBe("meta_cloud_api");
  });

  // A prose mention of "Twilio" in a comment (e.g. provider.ts
  // contrasting the old one-shared-sender design with the new
  // per-company one) is legitimate history, not a dependency — what
  // actually matters is that nothing here imports the old adapter or
  // reads one of its env vars.
  it.each([
    "src/lib/whatsapp/provider.ts",
    "src/lib/whatsapp/send-booking-confirmation.ts",
    "src/lib/actions/subscription-notifications.ts",
  ])("%s does not import the Twilio adapter or reference a TWILIO_* env var", (relativePath) => {
    const source = readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8");
    expect(source).not.toMatch(/from\s+["']@\/lib\/whatsapp\/twilio["']/);
    expect(source).not.toMatch(/\bTWILIO_[A-Z_]+\b/);
  });
});
