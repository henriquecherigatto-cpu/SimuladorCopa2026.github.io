"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, MapPin, Phone } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  companyName: z.string().min(2, "Informe o nome da barbearia"),
  phone: z.string().min(8, "Informe um telefone válido"),
  address: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function CreateCompanyForm() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    setServerError(null);
    const supabase = createClient();

    const { error } = await supabase.rpc("create_company_with_owner", {
      p_name: values.companyName,
      p_phone: values.phone,
      p_address: values.address || undefined,
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

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
      <Button type="submit" fullWidth loading={isSubmitting} className="mt-2">
        Continuar
      </Button>
    </form>
  );
}
