import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export const metadata: Metadata = { title: "Nova senha — Easy Barber" };

export default function AtualizarSenhaPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
        <Logo />
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
        <h1 className="mb-1 text-lg font-bold text-brand-graphite">
          Defina sua nova senha
        </h1>
        <p className="mb-5 text-sm text-brand-graphite/60">
          Escolha uma nova senha para a sua conta.
        </p>
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
