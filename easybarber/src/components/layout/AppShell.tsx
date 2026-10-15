"use client";

import * as React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { MoreSheet } from "@/components/layout/MoreSheet";
import { SupportWhatsAppButton } from "@/components/layout/SupportWhatsAppButton";
import {
  SubscriptionStatusModal,
  type SubscriptionAlert,
} from "@/components/layout/SubscriptionStatusModal";

export interface AppShellIdentity {
  userName: string;
  companyName: string | null;
  roleLabel: string;
  isPlatformAdmin: boolean;
}

export function AppShell({
  children,
  identity,
  subscriptionAlert = null,
}: {
  children: React.ReactNode;
  identity: AppShellIdentity;
  subscriptionAlert?: SubscriptionAlert | null;
}) {
  const [moreOpen, setMoreOpen] = React.useState(false);

  return (
    <div className="flex min-h-dvh min-w-0 bg-brand-surface">
      <Sidebar
        userName={identity.userName}
        companyName={identity.companyName}
        roleLabel={identity.roleLabel}
        isPlatformAdmin={identity.isPlatformAdmin}
      />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <TopBar userName={identity.userName} />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-8">
          <div className="mx-auto w-full min-w-0 max-w-6xl">{children}</div>
        </main>
      </div>
      <MobileBottomNav onOpenMore={() => setMoreOpen(true)} />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        userName={identity.userName}
        roleLabel={identity.roleLabel}
        isPlatformAdmin={identity.isPlatformAdmin}
      />
      <SupportWhatsAppButton />
      <SubscriptionStatusModal alert={subscriptionAlert} />
    </div>
  );
}
