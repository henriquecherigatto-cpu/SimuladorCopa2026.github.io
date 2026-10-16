import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Recuperar senha — Easy Barber" };

export default async function RecuperarSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
        <Logo />
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
        <h1 className="mb-1 text-lg font-bold text-brand-graphite">
          Recuperar senha
        </h1>
        <p className="mb-5 text-sm text-brand-graphite/60">
          Informe o e-mail da sua conta para receber as instruções de
          redefinição.
        </p>
        <ForgotPasswordForm initialEmail={email} />
      </div>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-brand-graphite/60 hover:text-brand-graphite"
      >
        <ArrowLeft className="size-4" />
        Voltar para o login
      </Link>
    </div>
  );
}
