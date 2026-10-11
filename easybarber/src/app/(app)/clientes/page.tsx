import type { Metadata } from "next";
import { ClientesPageClient } from "@/components/clientes/ClientesPageClient";

export const metadata: Metadata = { title: "Clientes — Easy Barber" };

export default function ClientesPage() {
  return <ClientesPageClient />;
}
