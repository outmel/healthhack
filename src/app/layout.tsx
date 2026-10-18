import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import DemoBar from "@/components/DemoBar";
import { getSession } from "@/lib/auth";

// Open, highly legible face that reads well at large sizes on a phone.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Teman",
  description: "The helper sees it first. Teman makes sure everyone else sees it too.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fbf6ec" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-cream text-ink">
        {session && <DemoBar role={session.role} name={session.name} />}
        {children}
      </body>
    </html>
  );
}
