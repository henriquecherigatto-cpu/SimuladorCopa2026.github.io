"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  connectWhatsAppAccount,
  disconnectWhatsAppAccount,
  getWhatsAppConnectionStatus,
  sendWhatsAppTestMessage,
  type WhatsAppConnectionStatus,
} from "@/lib/actions/whatsapp-connection";

declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; version: string; xfbml?: boolean }) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } | null }) => void,
        options: {
          config_id: string;
          response_type: string;
          override_default_response_type: boolean;
          extras?: Record<string, unknown>;
        },
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

let fbSdkPromise: Promise<void> | null = null;

function loadFacebookSdk(appId: string, version: string): Promise<void> {
  if (window.FB) return Promise.resolve();
  if (fbSdkPromise) return fbSdkPromise;

  fbSdkPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, version, xfbml: false });
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Falha ao carregar o SDK do Facebook."));
    document.body.appendChild(script);
  });
  return fbSdkPromise;
}

function safeHostname(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}

interface EmbeddedSignupResult {
  code: string;
  wabaId: string;
  phoneNumberId: string;
}

/**
 * Meta's Embedded Signup: an FB.login popup (scoped to a pre-created
 * Embedded Signup config_id) grants an authorization `code`, while a
 * SEPARATE postMessage event from the same flow reports which WABA and
 * phone number the owner actually selected or registered inside it.
 * Both are required, can arrive in either order, and this resolves
 * only once it has both. This is the one piece of the whole migration
 * whose exact message shape depends on Meta's own current Embedded
 * Signup contract — verify it against a real Meta App + Embedded
 * Signup configuration during setup (see docs/whatsapp-integration.md).
 */
function runEmbeddedSignup(configId: string): Promise<EmbeddedSignupResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let code: string | null = null;
    let signup: { wabaId: string; phoneNumberId: string } | null = null;

    function cleanup() {
      window.removeEventListener("message", onMessage);
      clearTimeout(timeoutId);
    }

    function finish() {
      if (settled || !code || !signup) return;
      settled = true;
      cleanup();
      resolve({ code, wabaId: signup.wabaId, phoneNumberId: signup.phoneNumberId });
    }

    function fail(message: string) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    }

    const timeoutId = setTimeout(() => {
      fail("Tempo esgotado aguardando a conclusão da configuração no WhatsApp. Tente novamente.");
    }, 120_000);

    function onMessage(event: MessageEvent) {
      if (!safeHostname(event.origin).endsWith("facebook.com")) return;
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (
        typeof data === "object" &&
        data !== null &&
        (data as { type?: string }).type === "WA_EMBEDDED_SIGNUP" &&
        (data as { event?: string }).event === "FINISH"
      ) {
        const payload = (data as { data?: { waba_id?: string; phone_number_id?: string } }).data;
        if (payload?.waba_id && payload?.phone_number_id) {
          signup = { wabaId: payload.waba_id, phoneNumberId: payload.phone_number_id };
          finish();
        }
      }
    }

    window.addEventListener("message", onMessage);

    window.FB!.login(
      (response) => {
        if (!response.authResponse?.code) {
          fail("Autorização cancelada.");
          return;
        }
        code = response.authResponse.code;
        finish();
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { feature: "whatsapp_embedded_signup", sessionInfoVersion: "3" },
      },
    );
  });
}

const STATUS_BADGE: Record<
  WhatsAppConnectionStatus["status"],
  { label: string; variant: "neutral" | "success" | "warning" | "danger" }
> = {
  disconnected: { label: "Desconectado", variant: "neutral" },
  connecting: { label: "Conectando", variant: "warning" },
  connected: { label: "Conectado", variant: "success" },
  error: { label: "Erro na conexão", variant: "danger" },
};

export function WhatsAppConnectionModal({
  open,
  onClose,
  initialStatus,
  onStatusChange,
}: {
  open: boolean;
  onClose: () => void;
  initialStatus: WhatsAppConnectionStatus;
  onStatusChange: (status: WhatsAppConnectionStatus) => void;
}) {
  const [status, setStatus] = React.useState<WhatsAppConnectionStatus>(initialStatus);
  const [connecting, setConnecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [testOpen, setTestOpen] = React.useState(false);

  const applyStatus = React.useCallback(
    (next: WhatsAppConnectionStatus) => {
      setStatus(next);
      onStatusChange(next);
    },
    [onStatusChange],
  );

  const loadStatus = React.useCallback(async () => {
    const result = await getWhatsAppConnectionStatus();
    if (result.ok) {
      applyStatus(result.data);
    } else {
      setError(result.error);
    }
  }, [applyStatus]);

  // Re-synced from the server on every open (not just seeded from the
  // page load) — the connection can change from another tab/session,
  // and a webhook-driven error status shouldn't require a full
  // page reload to show up here.
  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
      void loadStatus();
    }
  }, [open, loadStatus]);

  const handleConnect = async () => {
    setError(null);
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const configId = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;
    const graphVersion = process.env.NEXT_PUBLIC_META_GRAPH_API_VERSION || "v21.0";
    if (!appId || !configId) {
      setError(
        "A conexão com o WhatsApp ainda não foi configurada nesta instância. Fale com o suporte.",
      );
      return;
    }
    setConnecting(true);
    try {
      await loadFacebookSdk(appId, graphVersion);
      const { code, wabaId, phoneNumberId } = await runEmbeddedSignup(configId);
      const result = await connectWhatsAppAccount({ code, wabaId, phoneNumberId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar o WhatsApp.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    const result = await disconnectWhatsAppAccount();
    setDisconnecting(false);
    setConfirmDisconnect(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await loadStatus();
  };

  const badge = STATUS_BADGE[status.status];

  return (
    <Modal open={open} onClose={onClose} title="Integração com WhatsApp">
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex flex-col gap-3 rounded-xl bg-brand-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-brand-graphite">Status</span>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          {status.displayPhoneNumber && (
            <p className="text-sm text-brand-graphite/70">
              Número conectado: <span className="font-medium">{status.displayPhoneNumber}</span>
            </p>
          )}
          {status.status === "error" && status.lastError && (
            <p className="text-sm text-brand-error">{status.lastError}</p>
          )}
        </div>

        <p className="text-sm text-brand-graphite/60">
          Conecte a conta oficial do WhatsApp Business da sua barbearia para enviar
          confirmações automáticas de agendamento (recurso do plano Profissional). A
          autorização é feita diretamente pelo Meta — nunca pedimos para você colar um
          token de acesso aqui.
        </p>

        <div className="flex flex-col gap-2">
          {status.status === "connected" ? (
            <>
              <Button variant="secondary" fullWidth onClick={() => setTestOpen(true)}>
                Enviar mensagem de teste
              </Button>
              <Button variant="danger" fullWidth onClick={() => setConfirmDisconnect(true)}>
                Desconectar WhatsApp
              </Button>
            </>
          ) : (
            <Button fullWidth loading={connecting} onClick={handleConnect}>
              Conectar conta do WhatsApp
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        title="Desconectar o WhatsApp?"
        description="A barbearia deixará de enviar confirmações automáticas de agendamento por WhatsApp até que uma conta seja conectada novamente."
        confirmLabel="Desconectar"
        busy={disconnecting}
        onConfirm={handleDisconnect}
        onClose={() => setConfirmDisconnect(false)}
      />

      <TestMessageDialog
        open={testOpen}
        onClose={() => setTestOpen(false)}
        onSent={() => void loadStatus()}
      />
    </Modal>
  );
}

function TestMessageDialog({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [phone, setPhone] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhone("");
      setConfirmOpen(false);
      setSending(false);
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    const result = await sendWhatsAppTestMessage(phone);
    setSending(false);
    setConfirmOpen(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    onSent();
  };

  return (
    <Modal open={open} onClose={onClose} title="Enviar mensagem de teste">
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}
        {success ? (
          <>
            <Alert variant="success">
              Mensagem de teste enviada. Confira o WhatsApp informado.
            </Alert>
            <Button fullWidth onClick={onClose}>
              Fechar
            </Button>
          </>
        ) : (
          <>
            <Input
              label="Número de WhatsApp para o teste"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(19) 99999-9999"
              hint="Enviaremos uma mensagem de exemplo de confirmação de agendamento para este número."
            />
            <Button fullWidth disabled={!phone.trim()} onClick={() => setConfirmOpen(true)}>
              Enviar teste
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Enviar mensagem de teste?"
        description={`Isso envia uma mensagem real de WhatsApp para ${phone}.`}
        confirmLabel="Enviar"
        busy={sending}
        onConfirm={handleSend}
        onClose={() => setConfirmOpen(false)}
      />
    </Modal>
  );
}
