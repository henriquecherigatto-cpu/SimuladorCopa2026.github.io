import type { Metadata } from "next";
import { AdminPageClient } from "@/components/admin/AdminPageClient";

export const metadata: Metadata = { title: "Administração — Easy Barber" };

export default function AdminPage() {
  return <AdminPageClient />;
}
