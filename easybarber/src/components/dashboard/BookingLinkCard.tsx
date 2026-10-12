"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function BookingLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context); the
      // link is still fully selectable/copyable by hand below.
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
            <Link2 className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-graphite">
              Link de agendamento para seus clientes
            </p>
            <p className="truncate text-xs text-brand-graphite/50">{url}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            onClick={copy}
          >
            {copied ? "Copiado!" : "Copiar link"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<ExternalLink className="size-4" />}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
