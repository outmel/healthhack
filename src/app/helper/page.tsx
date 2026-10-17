import { requireRole } from "@/lib/auth";
import { getCarerStatus, getChecksThisMonth, getCircle, getLatestAnalysis, getRestDay, getSenior, getToday } from "@/lib/data";
import HelperApp from "./HelperApp";
import type { Lang } from "@/lib/i18n";

export default async function HelperPage() {
  const session = await requireRole("helper");
  const senior = await getSenior(session.household);
  const [ai, today, carer, checks, restDay, circle] = await Promise.all([
    getLatestAnalysis(senior.id),
    getToday(senior.id, session.uid),
    getCarerStatus(session.household),
    getChecksThisMonth(senior.id),
    getRestDay(session.household),
    getCircle(session.household),
  ]);
  return (
    <HelperApp
      name={session.name}
      seniorName={senior.name}
      initialLang={session.lang as Lang}
      initialDone={today}
      daysWithoutRest={carer?.needsNudge && !restDay ? carer.daysWithoutRest : null}
      tip={ai?.analysis.helper_message ? { text: ai.analysis.helper_message, en: ai.analysis.helper_message_en ?? "" } : null}
      checks={checks}
      restDay={restDay}
      circle={circle}
    />
  );
}
