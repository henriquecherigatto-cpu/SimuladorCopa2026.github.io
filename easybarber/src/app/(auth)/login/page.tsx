import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/auth/LoginForm";
import { DemoTag } from "@/components/ui/DemoBanner";

export const metadata: Metadata = { title: "Entrar — Easy Barber" };

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
        <Logo />
        <p className="text-sm text-brand-graphite/60">
          Sua barbearia organizada de forma simples.
        </p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-lg font-bold text-brand-graphite">Entrar</h1>
          <DemoTag />
        </div>
        <LoginForm />
      </div>

      <p className="text-center text-sm text-brand-graphite/60">
        Ainda não tem uma conta?{" "}
        <Link
          href="/cadastro"
          className="font-semibold text-brand-orange hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </div>
  );
}
