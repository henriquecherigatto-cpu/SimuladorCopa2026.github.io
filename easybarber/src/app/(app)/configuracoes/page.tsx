import type { Metadata } from "next";
import { ConfiguracoesPageClient } from "@/components/configuracoes/ConfiguracoesPageClient";

export const metadata: Metadata = { title: "Configurações — Easy Barber" };

export default function ConfiguracoesPage() {
  return <ConfiguracoesPageClient />;
}
