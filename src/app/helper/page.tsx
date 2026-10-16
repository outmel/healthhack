import { requireRole } from "@/lib/auth";
import { getLatestAnalysis, getSenior, getToday } from "@/lib/data";
import HelperApp from "./HelperApp";
import type { Lang } from "@/lib/i18n";

export default async function HelperPage() {
  const session = await requireRole("helper");
  const senior = await getSenior(session.household);
  const [ai, today] = await Promise.all([getLatestAnalysis(senior.id), getToday(senior.id, session.uid)]);
  return (
    <HelperApp
      name={session.name}
      seniorName={senior.name}
      initialLang={session.lang as Lang}
      initialDone={today}
      tip={ai?.analysis.helper_message ? { text: ai.analysis.helper_message, en: ai.analysis.helper_message_en ?? "" } : null}
    />
  );
}
