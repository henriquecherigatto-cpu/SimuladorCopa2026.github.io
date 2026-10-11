"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const loginSchema = z.object({
  email: z.string().min(1, "Informe seu e-mail").email("E-mail inválido"),
  password: z.string().min(1, "Informe sua senha"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "carlos@barber013.com.br", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    await new Promise((resolve) => setTimeout(resolve, 700));

    if (values.password.length < 4) {
      setServerError(
        "E-mail ou senha incorretos. Verifique os dados e tente novamente.",
      );
      return;
    }

    router.push("/dashboard");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <Input
        label="E-mail"
        type="email"
        placeholder="voce@suabarbearia.com.br"
        leftIcon={<Mail className="size-4" />}
        error={errors.email?.message}
        {...register("email")}
      />
      <Input
        label="Senha"
        type="password"
        placeholder="Digite sua senha"
        leftIcon={<Lock className="size-4" />}
        error={errors.password?.message}
        {...register("password")}
      />

      <div className="flex justify-end">
        <a
          href="/recuperar-senha"
          className="text-sm font-medium text-brand-orange hover:underline"
        >
          Esqueceu a senha?
        </a>
      </div>

      <Button type="submit" fullWidth loading={isSubmitting}>
        Entrar
      </Button>

      <p className="text-center text-xs text-brand-graphite/50">
        Dica de demonstração: use qualquer e-mail e uma senha com 4+
        caracteres para entrar.
      </p>
    </form>
  );
}
