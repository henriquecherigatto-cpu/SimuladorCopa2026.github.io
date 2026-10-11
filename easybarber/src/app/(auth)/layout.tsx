import type { ReactNode } from "react";
import { Scissors } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-graphite p-10 text-white lg:flex">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden
        />
        <div className="relative flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-orange">
            <Scissors className="size-5" strokeWidth={2.5} />
          </span>
          <span className="text-xl font-bold">Easy Barber</span>
        </div>
        <div className="relative flex flex-col gap-4">
          <p className="text-3xl font-bold leading-tight">
            Sua barbearia
            <br />
            organizada de
            <br />
            forma simples.
          </p>
          <p className="max-w-sm text-sm text-white/60">
            Agenda, clientes, profissionais e assinatura em um só lugar —
            pensado para o dia a dia da sua barbearia.
          </p>
        </div>
        <p className="relative text-xs text-white/40">
          © {new Date().getFullYear()} Easy Barber. Todos os direitos
          reservados.
        </p>
      </div>
      <div className="flex items-center justify-center bg-brand-surface px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
