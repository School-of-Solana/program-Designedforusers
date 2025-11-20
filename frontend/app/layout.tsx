import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/components/providers/client-providers";
import type { PropsWithChildren } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EventFlux · On-chain Event Pass + Yield Vault",
  description: "Mint tickets, compound treasury funds, and issue loyalty NFTs — all powered by Anchor + Solana.",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClientProviders>
          <div className="relative min-h-screen overflow-hidden bg-[#03030a]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(117,89,255,0.25),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(31,205,255,0.15),transparent_45%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\' viewBox=\'0 0 200 200\'%3E%3Crect width=\'1\' height=\'1\' fill=\'white\' fill-opacity=\'0.08\'/%3E%3C/svg%3E')" }} />
            <main className="relative z-10 px-4 py-10 sm:px-8 lg:px-16">{children}</main>
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
