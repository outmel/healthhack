// Read-only GP summary for the family's share sheet. No login: the signed token is the key,
// and it expires after 7 days. Same report as the doctor view, without the AI button or replay.
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Shell from "@/components/Shell";
import { getSeniorById } from "@/lib/data";
import { fmtDay } from "@/lib/format";
import { readSummaryToken } from "@/lib/summaryToken";
import PatientReport from "@/app/gp/PatientReport";

export const metadata: Metadata = { title: "Teman · GP summary", robots: { index: false, follow: false } };

export default async function SummaryPage({ params }: { params: Promise<{ token: string }> }) {
  const link = readSummaryToken((await params).token);
  if (!link) notFound();
  const senior = await getSeniorById(link.seniorId);
  if (!senior) notFound();
  const expires = fmtDay(new Date(link.expires).toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" }));

  return (
    <Shell
      wide
      badge={<span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-dark">GP summary · read-only</span>}
      right={<span className="text-sm text-muted">Shared by the family · link expires {expires}</span>}
    >
      <PatientReport senior={senior} household={senior.household_id} readOnly />
    </Shell>
  );
}

