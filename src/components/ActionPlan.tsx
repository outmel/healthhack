// "What you can do this week": the advisor agent's care plan, one compartment per topic.
// AreaCard and topic() are shared with the GP panel.
// Each topic leads with a single "start here" step; the rest fold away so the page stays scannable.
import { Heart, Phone, Standing, Stethoscope, Users, Utensils } from "@/components/icons";
import type { Analysis } from "@/lib/data";

type Plan = NonNullable<Analysis["care_plan"]>;
type Area = NonNullable<Plan["focus_areas"]>[number];
type Resource = NonNullable<Plan["resources"]>[number];
type IconT = (p: { className?: string }) => React.ReactElement;

const Drop: IconT = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2.7s6 6.5 6 11.3a6 6 0 0 1-12 0C6 9.2 12 2.7 12 2.7Z" />
  </svg>
);

// Topic names come from the model, so match on keywords; anything else gets a neutral style.
const TOPICS: { match: RegExp; Icon: IconT; tone: string }[] = [
  { match: /eat|meal|food|appetite|nutrition/i, Icon: Utensils, tone: "bg-sun-soft text-sun" },
  { match: /drink|fluid|hydrat|water|dizz/i, Icon: Drop, tone: "bg-brand-soft text-brand-dark" },
  { match: /stand|balance|fall|walk|mobil/i, Icon: Standing, tone: "bg-brand-soft text-brand-dark" },
  { match: /helper|carer|caregiver|wellbeing|rest/i, Icon: Heart, tone: "bg-rose-soft text-rose" },
  { match: /gp|doctor|medic|visit/i, Icon: Stethoscope, tone: "bg-brand-soft text-brand-dark" },
];
export const topic = (area: string) => TOPICS.find((t) => t.match.test(area)) ?? { Icon: Users, tone: "bg-track text-ink" };
const slug = (s: string) => `plan-${s.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export default function ActionPlan({ plan, gpName, canBook }: { plan: Plan; gpName: string; canBook: boolean }) {
  const areas = (plan.focus_areas ?? []).filter((f) => f.family_actions?.length);
  const resources = plan.resources ?? [];

  return (
    <section className="flex flex-col gap-3" aria-labelledby="plan-title">
      <div className="px-1">
        <h2 id="plan-title" className="text-lg font-extrabold">What you can do this week</h2>
        <p className="text-[15px] text-muted">One step to start with in each area. Tap for more ideas.</p>
      </div>

      {areas.length > 1 && (
        <nav aria-label="Areas" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {areas.map((f) => {
            const { Icon, tone } = topic(f.area);
            return (
              <a key={f.area} href={`#${slug(f.area)}`} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${tone}`}>
                <Icon className="h-4 w-4" /> {f.area}
              </a>
            );
          })}
        </nav>
      )}

      {areas.map((f) => <AreaCard key={f.area} area={f} actions={f.family_actions ?? []} />)}

      {resources.length > 0 && (
        <div className="rounded-[22px] border border-line bg-paper p-4">
          <p className="eyebrow text-muted">Who can help</p>
          <ul className="mt-2 flex flex-col divide-y divide-track">
            {resources.map((r) => <ResourceRow key={r.id} r={r} gpName={gpName} canBook={canBook} />)}
          </ul>
        </div>
      )}
    </section>
  );
}

/** One topic: icon, title, why, a "start here" step and the rest folded away. */
export function AreaCard({ area, actions, startLabel = "Start here" }: { area: Area; actions: string[]; startLabel?: string }) {
  const { Icon, tone } = topic(area.area);
  const [first, ...more] = actions;
  return (
    <article id={slug(area.area)} className="scroll-mt-4 overflow-hidden rounded-[22px] border border-line bg-paper">
      <header className="flex items-center gap-3 px-4 pt-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="h-6 w-6" />
        </span>
        <span className="min-w-0">
          <span className="block text-[17px] font-extrabold leading-tight">{area.area}</span>
          {area.why && <span className="block text-sm leading-snug text-muted">{area.why}</span>}
        </span>
      </header>
      <div className="p-4 pt-3">
        {first && (
          <div className="rounded-2xl bg-cream p-3">
            <p className="eyebrow text-brand">{startLabel}</p>
            <p className="mt-0.5 text-[16px] font-semibold leading-snug text-ink">{first}</p>
          </div>
        )}
        {more.length > 0 && (
          <details className="group mt-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 font-bold text-brand">
              <span className="group-open:hidden">{more.length} more idea{more.length > 1 ? "s" : ""}</span>
              <span className="hidden group-open:inline">Fewer ideas</span>
              <span aria-hidden className="transition group-open:rotate-90">›</span>
            </summary>
            <ol className="flex flex-col gap-2">
              {more.map((x, i) => (
                <li key={x} className="flex gap-2.5 text-[15px] leading-snug text-body">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-track text-xs font-extrabold text-muted">{i + 2}</span>
                  {x}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </article>
  );
}

function ResourceRow({ r, gpName, canBook }: { r: Resource; gpName: string; canBook: boolean }) {
  // Booking goes to her own GP (with the summary), not the HealthHub homepage.
  if (r.id === "healthhub" && canBook) {
    return (
      <li className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Book with {gpName}</span>
          <span className="block text-sm text-muted">A ready-written message to the clinic, with the 1-page summary.</span>
        </span>
        <a href="#book-gp" className="shrink-0 rounded-xl border-2 border-brand px-3 py-1.5 text-sm font-extrabold text-brand">Book</a>
      </li>
    );
  }
  const phone = /^[\d ]+$/.test(r.contact);
  return (
    <li className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{r.name}</span>
        <span className="block text-sm text-muted">{r.why}</span>
      </span>
      <a
        href={phone ? `tel:${r.contact.replace(/ /g, "")}` : `https://${r.contact}`}
        {...(phone ? {} : { target: "_blank", rel: "noreferrer" })}
        className="flex shrink-0 items-center gap-1 rounded-xl border-2 border-brand px-3 py-1.5 text-sm font-extrabold text-brand"
      >
        {phone && <Phone className="h-3.5 w-3.5" />} {phone ? r.contact : "Open"}
      </a>
    </li>
  );
}
