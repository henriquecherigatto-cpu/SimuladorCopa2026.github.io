import type { Metadata } from "next";
import { ConfirmadoOnboardingClient } from "@/components/onboarding/ConfirmadoOnboardingClient";

export const metadata: Metadata = { title: "Confirmando cadastro — Easy Barber" };

export default function OnboardingConfirmadoPage() {
  return <ConfirmadoOnboardingClient />;
}
