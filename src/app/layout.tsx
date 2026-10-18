import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import DemoBar from "@/components/DemoBar";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { DEMO_HOUSEHOLD } from "@/lib/demo";

// Open, highly legible face that reads well at large sizes on a phone.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Teman",
  description: "The helper sees it first. Teman makes sure everyone else sees it too.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fbf6ec" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  const demo = session?.household === DEMO_HOUSEHOLD;
  // Signed-up households see their invite code instead of the demo controls.
  const code = session && !demo
    ? (await query<{ code: string | null }>(`SELECT code FROM households WHERE id = $1`, [session.household]).catch(() => []))[0]?.code ?? null
    : null;
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-cream text-ink">
        {session && <DemoBar role={session.role} name={session.name} demo={demo} code={code} />}
        {children}
      </body>
    </html>
  );
}
