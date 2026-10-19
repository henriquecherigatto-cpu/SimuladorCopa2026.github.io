import type { Metadata } from "next";
import { SairClient } from "@/components/auth/SairClient";

export const metadata: Metadata = { title: "Saindo... — Easy Barber" };

export default function SairPage() {
  return <SairClient />;
}
