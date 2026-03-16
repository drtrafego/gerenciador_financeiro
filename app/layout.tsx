import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "@/stack/server";

export const metadata: Metadata = {
  title: "DR.TRÁFEGO — Financeiro",
  description: "Gerenciador financeiro para agência de tráfego pago.",
};

export const viewport: Viewport = {
  maximumScale: 1,
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`dark ${inter.className}`}>
      <body className="min-h-[100dvh] bg-zinc-950 text-white antialiased">
        <StackProvider app={stackServerApp}>
          <StackTheme>{children}</StackTheme>
        </StackProvider>
      </body>
    </html>
  );
}
