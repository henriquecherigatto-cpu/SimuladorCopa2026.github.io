import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Headline-only accent face for the marketing page (src/app/page.tsx) —
// everything else in the product keeps using Geist, so the signed-up
// in-app experience the marketing page leads into still feels like the
// same brand rather than switching voice entirely.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "Easy Barber — Sua barbearia organizada de forma simples",
  description:
    "Plataforma de agendamento e gestão de barbearias por assinatura mensal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-brand-surface text-brand-graphite">
        {children}
      </body>
    </html>
  );
}
