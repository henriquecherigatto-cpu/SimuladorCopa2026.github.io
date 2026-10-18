"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, CreditCard, Lock, Mail, MapPin, Phone, User } from "lucide-react";
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
    cnpj: z.string().min(11, "Informe um CPF ou CNPJ válido"),
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
  const [duplicateEmail, setDuplicateEmail] = React.useState<string | null>(null);

  const onSubmit = async (values: SignupValues) => {
    setServerError(null);
    setDuplicateEmail(null);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        // company_* fields are stored here so the /onboarding/confirmado
        // page can create the barbearia automatically once the e-mail
        // is confirmed — the RPC below can't run until THEN if
        // confirmations are required (no session exists yet), and
        // without this the owner would have to type everything again.
        data: {
          full_name: values.ownerName,
          company_name: values.companyName,
          company_phone: values.phone,
          company_cnpj: values.cnpj,
          company_address: values.address || undefined,
        },
        emailRedirectTo: `${window.location.origin}/onboarding/confirmado`,
      },
    });

    if (error) {
      // Supabase's own wording for this case ("User already registered")
      // only comes back when email confirmations are OFF for the
      // project. See the identities check below for the ON case.
      if (error.code === "user_already_exists" || error.message.includes("already registered")) {
        setDuplicateEmail(values.email);
        return;
      }
      setServerError(error.message);
      return;
    }

    // With email confirmations ON, signUp() for an email that already
    // belongs to a CONFIRMED account doesn't return an error at all —
    // Supabase deliberately returns an obfuscated "success" (no
    // session, a user object with an empty identities array) so a
    // stranger can't use this form to probe which emails are
    // registered. Checking identities.length === 0 is Supabase's own
    // documented way to tell "I'm signing up with my own email, and it
    // turns out it's already mine" apart from a genuinely new signup —
    // it reveals nothing to anyone who doesn't already know this email
    // is theirs, since it only ever surfaces to whoever just typed it
    // into this exact form.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setDuplicateEmail(values.email);
      return;
    }

    if (!data.session) {
      // E-mail confirmation is required by the Supabase project's
      // auth settings — the user isn't signed in yet, so we can't
      // call create_company_with_owner() (it needs auth.uid()). The
      // company_* fields above are stored in user_metadata so
      // /onboarding/confirmado — where emailRedirectTo above sends
      // the confirmation link — can create the barbearia automatically
      // once the e-mail is confirmed and a session exists, without
      // asking for any of this again. /onboarding/empresa is only a
      // fallback for accounts that somehow reach the app with no
      // metadata to work with.
      setPendingConfirmation(true);
      return;
    }

    const { error: rpcError } = await supabase.rpc(
      "create_company_with_owner",
      {
        p_name: values.companyName,
        p_phone: values.phone,
        p_cnpj: values.cnpj,
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
      // Every new signup needs a first payment before using the app —
      // see src/app/(app)/layout.tsx's pendente gate.
      router.push("/onboarding/pagamento");
      router.refresh();
    }, 1200);
  };

  if (duplicateEmail) {
    return (
      <Alert variant="info" title="Esse e-mail já tem uma conta">
        Já existe uma barbearia cadastrada com {duplicateEmail}. Se o acesso é
        seu,{" "}
        <Link
          href={`/recuperar-senha?email=${encodeURIComponent(duplicateEmail)}`}
          className="font-semibold underline"
        >
          recupere sua senha
        </Link>{" "}
        em vez de criar uma conta nova.
      </Alert>
    );
  }

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
        label="CPF ou CNPJ"
        placeholder="Só números"
        leftIcon={<CreditCard className="size-4" />}
        hint="Necessário para gerar a cobrança via Pix na próxima etapa. Pode ser o CPF do responsável ou o CNPJ da barbearia."
        error={errors.cnpj?.message}
        {...register("cnpj")}
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
