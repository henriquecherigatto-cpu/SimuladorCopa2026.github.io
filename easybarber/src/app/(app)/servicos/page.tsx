import type { Metadata } from "next";
import { ServicosPageClient } from "@/components/servicos/ServicosPageClient";

export const metadata: Metadata = { title: "Serviços — Easy Barber" };

export default function ServicosPage() {
  return <ServicosPageClient />;
}
