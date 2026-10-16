import { requireRole } from "@/lib/auth";
import { getSenior } from "@/lib/data";
import HelperApp from "./HelperApp";
import type { Lang } from "@/lib/i18n";

export default async function HelperPage() {
  const session = await requireRole("helper");
  const senior = await getSenior(session.household);
  return <HelperApp name={session.name} seniorName={senior.name} initialLang={session.lang as Lang} />;
}
