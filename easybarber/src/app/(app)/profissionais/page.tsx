import type { Metadata } from "next";
import { ProfissionaisPageClient } from "@/components/profissionais/ProfissionaisPageClient";

export const metadata: Metadata = { title: "Profissionais — Easy Barber" };

export default function ProfissionaisPage() {
  return <ProfissionaisPageClient />;
}
