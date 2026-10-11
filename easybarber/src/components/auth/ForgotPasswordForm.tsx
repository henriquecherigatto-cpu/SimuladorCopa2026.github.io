"use client";

import * as React from "react";
import { Mail } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setLoading(false);
    setSent(true);
  };

  if (sent) {
    return (
      <Alert variant="success" title="Solicitação registrada">
        Em um ambiente real, enviaríamos instruções para {email}. Este é o
        modo de demonstração — nenhum e-mail é enviado de fato.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Input
        label="E-mail cadastrado"
        type="email"
        placeholder="voce@suabarbearia.com.br"
        leftIcon={<Mail className="size-4" />}
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" fullWidth loading={loading}>
        Enviar instruções
      </Button>
    </form>
  );
}
