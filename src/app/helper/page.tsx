import { requireRole } from "@/lib/auth";
import { getLatestAnalysis, getSenior } from "@/lib/data";
import HelperApp from "./HelperApp";
import type { Lang } from "@/lib/i18n";

export default async function HelperPage() {
  const session = await requireRole("helper");
  const senior = await getSenior(session.household);
  const ai = await getLatestAnalysis(senior.id);
  return (
    <HelperApp
      name={session.name}
      seniorName={senior.name}
      initialLang={session.lang as Lang}
      tip={ai?.analysis.helper_message ? { text: ai.analysis.helper_message, en: ai.analysis.helper_message_en ?? "" } : null}
    />
  );
}
