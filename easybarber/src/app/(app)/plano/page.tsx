import type { Metadata } from "next";
import { PlanoPageClient } from "@/components/plano/PlanoPageClient";

export const metadata: Metadata = { title: "Plano e assinatura — Easy Barber" };

export default function PlanoPage() {
  return <PlanoPageClient />;
}
