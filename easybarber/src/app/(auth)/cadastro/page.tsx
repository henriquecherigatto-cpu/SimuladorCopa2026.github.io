import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Criar conta — Easy Barber" };

export default function CadastroPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
        <Logo />
        <p className="text-sm text-brand-graphite/60">
          Crie sua conta e cadastre sua barbearia para começar.
        </p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
        <h1 className="mb-5 text-lg font-bold text-brand-graphite">
          Criar sua conta
        </h1>
        <SignupForm />
      </div>

      <p className="text-center text-sm text-brand-graphite/60">
        Já tem uma conta?{" "}
        <Link
          href="/login"
          className="font-semibold text-brand-orange hover:underline"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
