import Shell from "@/components/Shell";
import LogoutButton from "@/components/LogoutButton";
import { requireRole } from "@/lib/auth";
import { getSenior } from "@/lib/data";
import PatientReport from "./PatientReport";

export default async function GpPage() {
  const session = await requireRole("gp");
  const senior = await getSenior(session.household);

  return (
    <Shell
      wide
      badge={<span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-dark">Doctor view</span>}
      right={
        <span className="flex items-center gap-4 text-[15px] text-muted">
          <span className="hidden sm:inline">Signed in as {session.name}</span>
          <LogoutButton />
        </span>
      }
    >
      <PatientReport senior={senior} household={session.household} />
    </Shell>
  );
}
