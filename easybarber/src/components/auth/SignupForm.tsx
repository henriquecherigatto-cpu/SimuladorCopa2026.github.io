"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Lock, Mail, MapPin, Phone, User } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { createClient } from "@/lib/supabase/client";

const signupSchema = z
  .object({
    companyName: z.string().min(2, "Informe o nome da barbearia"),
    ownerName: z.string().min(2, "Informe o nome do responsável"),
    email: z.string().min(1, "Informe seu e-mail").email("E-mail inválido"),
    phone: z.string().min(8, "Informe um telefone válido"),
    address: z.string().optional(),
    password: z.string().min(6, "Mínimo de 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof signupSchema>;

export function SignupForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

  const [success, setSuccess] = React.useState(false);
  const [pendingConfirmation, setPendingConfirmation] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const onSubmit = async (values: SignupValues) => {
    setServerError(null);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.ownerName } },
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    if (!data.session) {
      // E-mail confirmation is required by the Supabase project's
      // auth settings — the user isn't signed in yet, so we can't
      // call create_company_with_owner() (it needs auth.uid()). The
      // barbearia is created on their first real login instead — see
      // src/app/onboarding/empresa.
      setPendingConfirmation(true);
      return;
    }

    const { error: rpcError } = await supabase.rpc(
      "create_company_with_owner",
      {
        p_name: values.companyName,
        p_phone: values.phone,
        p_address: values.address || undefined,
      },
    );

    if (rpcError) {
      setServerError(
        `Sua conta foi criada, mas não foi possível criar a barbearia automaticamente (${rpcError.message}). Você pode concluir isso ao entrar.`,
      );
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1200);
  };

  if (pendingConfirmation) {
    return (
      <Alert variant="info" title="Confirme seu e-mail">
        Enviamos um link de confirmação para o seu e-mail. Depois de
        confirmar, faça login para concluir o cadastro da sua barbearia.
      </Alert>
    );
  }

  if (success) {
    return (
      <Alert variant="success" title="Barbearia criada com sucesso!">
        Redirecionando para o painel inicial...
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <Input
        label="Nome da barbearia"
        placeholder="Ex: Barber 013"
        leftIcon={<Building2 className="size-4" />}
        error={errors.companyName?.message}
        {...register("companyName")}
      />
      <Input
        label="Nome do responsável"
        placeholder="Seu nome completo"
        leftIcon={<User className="size-4" />}
        error={errors.ownerName?.message}
        {...register("ownerName")}
      />
      <Input
        label="E-mail"
        type="email"
        placeholder="voce@suabarbearia.com.br"
        leftIcon={<Mail className="size-4" />}
        error={errors.email?.message}
        {...register("email")}
      />
      <Input
        label="Telefone"
        type="tel"
        placeholder="(19) 99999-9999"
        leftIcon={<Phone className="size-4" />}
        error={errors.phone?.message}
        {...register("phone")}
      />
      <Input
        label="Endereço (opcional)"
        placeholder="Rua, número, bairro, cidade"
        leftIcon={<MapPin className="size-4" />}
        error={errors.address?.message}
        {...register("address")}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Senha"
          type="password"
          placeholder="Mínimo 6 caracteres"
          leftIcon={<Lock className="size-4" />}
          error={errors.password?.message}
          {...register("password")}
        />
        <Input
          label="Confirmar senha"
          type="password"
          placeholder="Repita a senha"
          leftIcon={<Lock className="size-4" />}
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </div>

      <Button type="submit" fullWidth loading={isSubmitting} className="mt-2">
        Criar conta
      </Button>
    </form>
  );
}
