import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

// Rounded, highly legible face: friendly for helpers and families reading on a phone.
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Teman",
  description: "The helper sees it first. Teman makes sure everyone else sees it too.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fbf7f1" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-cream text-ink">{children}</body>
    </html>
  );
}
