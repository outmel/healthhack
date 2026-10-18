// Builds n8n/teman-analysis-workflow.json. Edit the code here, then run:
//   node n8n/build-workflow.mjs
// Keeping the node code as plain JS (not escaped strings inside JSON) makes it reviewable.
import { writeFileSync } from "node:fs";

// Must match src/lib/baseline.ts so the AI sees the same numbers as the GP page.
const computeStats = String.raw`// Deterministic stats: the AI explains the numbers, it never computes them.
// Same rule as the app (src/lib/baseline.ts): 14-day baseline lagged 7 days, 3-day recent mean, flag at 1.5 SD.
const d = $input.first().json.data || {};
const seniorId = Number($('Webhook').first().json.body.senior_id);
const WINDOW = 14, RECENT = 3, LAG = 7, Z = 1.5;
const MIN_SD = { lower: 4, higher: 0.6 }; // meal %, chair-stand seconds

function analyse(series, worseIs) {
  const pts = (series || []).map(p => ({ date: p.date, v: Number(p.value) }));
  if (pts.length < RECENT + 5) return { enough_data: false, days: pts.length };
  const recent = pts.slice(-RECENT);
  const end = pts.length - LAG;
  const base = pts.slice(Math.max(0, end - WINDOW), end);
  if (base.length < 5) return { enough_data: false, days: pts.length };
  const mean = a => a.reduce((s, p) => s + p.v, 0) / a.length;
  const bMean = mean(base);
  const sd = Math.max(Math.sqrt(base.reduce((s, p) => s + (p.v - bMean) ** 2, 0) / Math.max(1, base.length - 1)), MIN_SD[worseIs]);
  const rMean = mean(recent);
  const z = (rMean - bMean) / sd;
  const worse = worseIs === 'lower' ? z < -Z : z > Z;
  // Onset: walk back from the latest day while each day is at least 1 SD in the worse direction.
  let onset = null;
  for (let i = pts.length - 1; i >= 0; i--) {
    const dz = (pts[i].v - bMean) / sd;
    if (!(worseIs === 'lower' ? dz < -1 : dz > 1)) break;
    onset = pts[i].date;
  }
  return {
    enough_data: true,
    baseline_mean: +bMean.toFixed(1),
    baseline_sd: +sd.toFixed(1),
    recent_3day_mean: +rMean.toFixed(1),
    change: +(rMean - bMean).toFixed(1),
    z_score: +z.toFixed(2),
    flagged: worse,
    drift_started: onset,
  };
}

const meal = analyse(d.meals, 'lower');
const mobility = analyse(d.mobility, 'higher');

// What the on-device pose model noticed on each chair-stand (e.g. "used_hands" on reps 3-5).
const standFindings = (d.stand_tests || [])
  .filter(t => Array.isArray(t.findings) && t.findings.length)
  .map(t => ({ date: t.date, seconds: Number(t.seconds), findings: t.findings, hand_reps: t.hand_reps || [] }));

// Red flags are matched in code too (English, Bahasa Indonesia, Tagalog), so urgency
// never depends only on the model noticing them.
const RED_FLAGS = {
  fall: /\b(fell|fall(en)?|jatuh|nahulog|natumba)\b/i,
  'chest pain': /chest pain|nyeri dada|sakit dada|sakit sa dibdib/i,
  breathlessness: /breathless|short(ness)? of breath|sesak( napas)?|hirap huminga/i,
  'sudden confusion': /confus|bingung|linglong|nalilito/i,
  'slurred speech': /slurred|pelo|bicara tidak jelas|utal/i,
  fainting: /faint|pingsan|nawalan ng malay|hinimatay/i,
  'hard to wake': /hard to wake|susah dibangunkan|mahirap gisingin/i,
};
const notes = (d.notes || []).slice(0, 20);
const redFlagHits = [];
for (const n of notes) {
  const text = (n.original || '') + ' ' + (n.translated || '');
  for (const [flag, re] of Object.entries(RED_FLAGS)) if (re.test(text)) redFlagHits.push({ flag, date: n.date });
}

const carer = d.carer || [];
let lastRest = null;
for (const c of carer) if (c.rested_today) lastRest = c.date;
const firstCheckin = carer.length ? carer[0].date : null;
const since = lastRest || firstCheckin;
// Singapore calendar days (today minus the rest day), the same rule as getCarerStatus in the app.
const sgToday = new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10);
const daysSinceRest = since ? Math.round((Date.parse(sgToday) - Date.parse(String(since).slice(0, 10))) / 864e5) : null;
const recentMoods = carer.slice(-7).map(c => c.mood).filter(m => m != null);

return [{ json: {
  senior_id: seniorId,
  senior: d.senior,
  signals: { meal_intake_pct: meal, sit_to_stand_seconds: mobility },
  combined_flag: !!(meal.flagged && mobility.flagged),
  medications: (d.senior && d.senior.medications) || [],
  stand_findings: standFindings,
  red_flag_hits: redFlagHits,
  notes,
  carer: {
    helper: carer.length ? carer[carer.length - 1].helper : null,
    language: carer.length ? carer[carer.length - 1].language : null,
    days_since_rest_day: daysSinceRest,
    rest_day_ever_recorded: !!lastRest,
    avg_mood_last_7_days: recentMoods.length ? +(recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length).toFixed(1) : null,
  },
} }];`;

const parseAndCheck = String.raw`const stats = $('Compute baseline stats').first().json;
const raw = String($input.first().json.output || '').trim();
let analysis;
try {
  analysis = JSON.parse(raw.replace(/^\x60{3}(?:json)?\s*/i, '').replace(/\x60{3}\s*$/, ''));
} catch (e) {
  analysis = { urgency: 'review_soon', headline: 'AI analysis could not be parsed; review the raw trends.', parse_error: true, raw };
}
const LEVELS = ['routine', 'review_soon', 'urgent'];
if (!LEVELS.includes(analysis.urgency)) analysis.urgency = 'review_soon';
// Safety nets: the model can raise urgency but never lower it below what the code found.
if (stats.combined_flag && analysis.urgency === 'routine') analysis.urgency = 'review_soon';
if (stats.red_flag_hits.length) {
  analysis.urgency = 'urgent';
  const found = [...new Set(stats.red_flag_hits.map(h => h.flag + ' (' + h.date + ')'))];
  analysis.red_flags = [...new Set([...(analysis.red_flags || []), ...found])];
  if (!/995/.test(analysis.family_message || '')) {
    analysis.family_message = 'A note mentions ' + found.join(', ') + '. If this is happening now, call 995. ' + (analysis.family_message || '');
  }
}
return [{ json: {
  senior_id: stats.senior_id,
  generated_at: new Date().toISOString(),
  urgency: analysis.urgency,
  stats: stats.signals,
  carer: stats.carer,
  analysis,
} }];`;

const ANALYSER_SYSTEM = `You are Teman's care-trend analyst. You support a GP, a family and a domestic helper caring for a frail older adult in Singapore.

Rules:
- You flag trends and suggest who should look at what. You never diagnose, never name a likely cause as fact, and never suggest starting, stopping or changing medication.
- Use only the numbers provided. Do not recompute or invent figures.
- Treat helper notes as observations, not facts. Quote dates when you refer to them.
- Each note may carry "concerns" picked out at translation (e.g. "low fluid intake", "dizziness on standing"). Include them in symptom_tags, merged with what you find in the text.
- stand_findings are what the on-device pose model saw during the chair-stand test: "used_hands" means she pushed up with her hands (hand_reps = which of the 5 stands). Mention it in gp_summary when present; it is an observation, not a diagnosis.
- medications lists her current medicines. If she takes a blood-pressure medicine and the notes mention dizziness on standing or drinking little, a worth_reviewing item may ask whether a lying and standing blood pressure check and a medication review are due. Never suggest starting, stopping or changing a medicine.
- If any note mentions a fall, chest pain, breathlessness, sudden confusion, slurred speech, fainting or being hard to wake, set urgency to "urgent" and tell the family to call 995.
- Write the helper message in the helper's language (carer.language: id = Bahasa Indonesia, tl = Tagalog, en = English), in simple, warm words, with at most 3 practical steps.

Return ONLY a JSON object with exactly these keys:
{
  "urgency": "routine" | "review_soon" | "urgent",
  "headline": "one plain sentence for the GP, under 20 words",
  "gp_summary": "3-5 sentences for the GP: what changed, since when, by how much, and what the notes add",
  "symptom_tags": [{"tag": "Dizziness", "count": 3, "dates": ["2026-10-11"]}],
  "worth_reviewing": ["short items a GP may want to check, phrased as questions, no diagnoses"],
  "red_flags": ["any red-flag phrases found in notes, empty if none"],
  "family_message": "2-3 kind sentences for the family in English, with one clear next step",
  "helper_message": "one or two short sentences (under 25 words) in the helper's language: what to watch for today",
  "helper_message_en": "English translation of helper_message",
  "carer_wellbeing": "one sentence about the helper's own wellbeing, or empty string. Don't state the number of days without rest; the app shows that figure next to this sentence"
}`;

// Dates are bucketed in Singapore time to match the app's charts.
const QUERY = `SELECT json_build_object(
  'senior', (SELECT row_to_json(s) FROM seniors s WHERE s.id = $1),
  'meals', (
    SELECT json_agg(json_build_object('date', d, 'value', v) ORDER BY d)
    FROM (SELECT (created_at AT TIME ZONE 'Asia/Singapore')::date AS d, avg(value::numeric) AS v
          FROM observations
          WHERE senior_id = $1 AND type = 'meal' AND value IS NOT NULL AND created_at > now() - interval '35 days'
          GROUP BY 1) m),
  'mobility', (
    SELECT json_agg(json_build_object('date', d, 'value', v) ORDER BY d)
    FROM (SELECT (created_at AT TIME ZONE 'Asia/Singapore')::date AS d, avg(value::numeric) AS v
          FROM observations
          WHERE senior_id = $1 AND type = 'mobility' AND value IS NOT NULL AND created_at > now() - interval '35 days'
          GROUP BY 1) t),
  'stand_tests', (
    SELECT json_agg(json_build_object('date', (created_at AT TIME ZONE 'Asia/Singapore')::date, 'seconds', value,
                                      'method', meta->>'method', 'findings', meta->'findings', 'hand_reps', meta->'hand_reps') ORDER BY created_at)
    FROM observations
    WHERE senior_id = $1 AND type = 'mobility' AND value IS NOT NULL AND created_at > now() - interval '35 days'),
  'notes', (
    SELECT json_agg(json_build_object('date', (created_at AT TIME ZONE 'Asia/Singapore')::date, 'original', original_text, 'translated', translated_text,
                                      'concerns', COALESCE(meta->'concerns', '[]'::jsonb)) ORDER BY created_at DESC)
    FROM observations
    WHERE senior_id = $1 AND type = 'voice' AND created_at > now() - interval '35 days'),
  'carer', (
    SELECT json_agg(json_build_object('date', (c.created_at AT TIME ZONE 'Asia/Singapore')::date, 'helper', u.name, 'language', u.language, 'mood', c.mood, 'rested_today', c.rested_today, 'note', c.note) ORDER BY c.created_at)
    FROM carer_checkins c JOIN users u ON u.id = c.helper_id
    WHERE u.household_id = (SELECT household_id FROM seniors WHERE id = $1)
      AND c.created_at > now() - interval '35 days')
) AS data;`;

// Vetted Singapore contacts. The advisor agent can only pick from these by id; the
// "Add care plan" node drops anything else and fills in contact details from here,
// so a phone number never comes from the model. Check the numbers before going live.
const RESOURCES = [
  { id: "emergency", name: "SCDF emergency ambulance", contact: "995", topics: ["emergency", "fall", "chest pain", "breathless", "faint", "stroke", "confusion", "unresponsive"], what: "Life-threatening emergencies, any time." },
  { id: "non_emergency_ambulance", name: "Non-emergency ambulance", contact: "1777", topics: ["transport", "non-urgent", "hospital"], what: "Transport to hospital when it is not an emergency." },
  { id: "aic", name: "Agency for Integrated Care (AIC) hotline", contact: "1800 650 6060", topics: ["caregiver", "respite", "home care", "day care", "nursing", "subsidy", "meals", "rehab", "mobility", "falls", "nutrition"], what: "Home care, day care, respite and caregiver support schemes." },
  { id: "healthhub", name: "HealthHub", contact: "healthhub.sg", topics: ["gp", "polyclinic", "appointment", "records", "booking", "health information"], what: "Book polyclinic appointments and read trusted health information." },
  { id: "dementia_sg", name: "Dementia Singapore helpline", contact: "6377 0700", topics: ["memory", "confusion", "dementia", "behaviour"], what: "Advice when memory or behaviour changes." },
  { id: "cde", name: "Centre for Domestic Employees (CDE) helpline", contact: "1800 2255 233", topics: ["helper", "domestic worker", "rest day", "carer", "wellbeing"], what: "Support for domestic helpers, including rest-day and wellbeing concerns." },
  { id: "sos", name: "Samaritans of Singapore (SOS)", contact: "1767", topics: ["distress", "mood", "stress", "burnout", "carer", "emotional"], what: "24-hour emotional support for anyone, including carers." },
];

const resourceTool = String.raw`// Returns vetted Singapore resources matching the topic. The agent must cite only these ids.
const RESOURCES = ${JSON.stringify(RESOURCES)};
const q = String(query || '').toLowerCase();
const hits = RESOURCES.filter(r => r.topics.some(t => q.includes(t)) || q.includes(r.id));
return JSON.stringify((hits.length ? hits : RESOURCES).map(({ topics, ...r }) => r));`;

const ADVISOR_SYSTEM = `You are Teman's healthcare advisor, with the practical knowledge of a community geriatric nurse in Singapore. A trend analyst has already reviewed an older adult's eating, mobility, helper notes and carer wellbeing. Your job is to turn that into a short, safe care plan for the family, the domestic helper and the GP.

Rules:
- Never diagnose, never name a likely cause as fact, and never suggest starting, stopping or changing any medication or dose. "Ask the GP whether a medication review is due" is fine.
- Do not change the urgency you are given. If it is "urgent", the first family action is to call 995 if it is happening now, then see a doctor today.
- Base every point on the numbers and notes provided. Use only the analyst's figures; do not recompute them.
- Practical home actions only, suited to an HDB flat and a live-in helper: e.g. smaller, more frequent meals; favourite and soft foods; regular drinks; sitting up for meals; standing up slowly and sitting back down if dizzy; clear walkways, night lights, non-slip mats, someone nearby on walks; writing down when symptoms happen; protecting the helper's rest day.
- GP checks are phrased as questions, e.g. "Is a lying and standing blood pressure check worthwhile given the dizziness?", "Would a nutrition screen such as MNA-SF help?", "Is a falls risk review due?".
- Use the patient's medications list (senior.medications) and the camera's stand_findings. If she takes a blood-pressure medicine and notes mention dizziness or low fluid intake, include a GP check on standing blood pressure and on whether a medication review is due. If she pushed up with her hands, a falls-risk review question fits. Never name a medicine change.
- Call the sg_care_resources tool to find support services. Only list resources whose id the tool returned; never write phone numbers yourself.
- The helper text goes in the helper's language (carer.language: id = Bahasa Indonesia, tl = Tagalog, en = English), in simple, warm words. Exactly 3 steps, each one short instruction of at most 10 words, starting with a verb. No greeting, no thanks, no explanation: it is shown as 3 numbered cards on a phone.

Return ONLY a JSON object with exactly these keys:
{
  "focus_areas": [{"area": "Eating", "why": "one sentence tied to the numbers", "family_actions": ["at most 3"], "helper_actions": ["at most 3, in English"]}],
  "gp_checks": ["at most 4 questions for the GP"],
  "escalation": {"see_gp": "now" | "within_3_days" | "next_routine_visit", "call_995_if": ["specific warning signs to watch for"]},
  "helper_care_tips": "1. step\n2. step\n3. step (in the helper's language, at most 10 words each)",
  "helper_care_tips_en": "English translation of helper_care_tips",
  "resources": [{"id": "aic", "why": "one sentence on why it helps this family"}]
}`;

const addCarePlan = String.raw`// Merge the advisor's care plan into the checked analysis, with the same kind of safety nets.
const base = $('Parse and check').first().json;
const raw = String($input.first().json.output || '').trim();
let plan;
try {
  plan = JSON.parse(raw.replace(/^\x60{3}(?:json)?\s*/i, '').replace(/\x60{3}\s*$/, ''));
} catch (e) {
  plan = { parse_error: true, raw };
}
const RESOURCES = ${JSON.stringify(RESOURCES.map(({ id, name, contact, what }) => ({ id, name, contact, what })))};
const byId = new Map(RESOURCES.map(r => [r.id, r]));
// Only vetted resources survive, and their contact details come from the list, not the model.
plan.resources = (Array.isArray(plan.resources) ? plan.resources : [])
  .filter(r => r && byId.has(r.id))
  .map(r => ({ ...byId.get(r.id), why: String(r.why || byId.get(r.id).what) }));
// Escalation can never be softer than the checked urgency.
const SEE = ['next_routine_visit', 'within_3_days', 'now'];
const floor = { routine: 0, review_soon: 1, urgent: 2 }[base.urgency] ?? 1;
plan.escalation = plan.escalation && typeof plan.escalation === 'object' ? plan.escalation : {};
plan.escalation.see_gp = SEE[Math.max(floor, SEE.indexOf(plan.escalation.see_gp))];
if (!Array.isArray(plan.escalation.call_995_if)) plan.escalation.call_995_if = [];
if (base.urgency === 'urgent' && !plan.resources.some(r => r.id === 'emergency')) {
  plan.resources.unshift({ ...byId.get('emergency'), why: 'A note mentions a red-flag sign. If it is happening now, call 995.' });
}
for (const k of ['focus_areas', 'gp_checks']) if (!Array.isArray(plan[k])) plan[k] = [];
return [{ json: { ...base, care_plan: plan } }];`;

const pg = { postgres: { id: "REPLACE_ME", name: "Teman Postgres" } };
const deepseek = { deepSeekApi: { id: "REPLACE_ME", name: "DeepSeek account" } };
const node = (id, name, type, typeVersion, [x, y], parameters, credentials, extra) => ({
  parameters, id, name, type, typeVersion, position: [x, y], ...(credentials && { credentials }), ...extra,
});
const chatModel = (id, name, x, options) =>
  node(id, name, "@n8n/n8n-nodes-langchain.lmChatDeepSeek", 1, [x, 520],
    { model: "deepseek-flash", options: { maxTokens: 8000, timeout: 90000, maxRetries: 2, ...options } }, deepseek);
const agent = (id, name, x, text, systemMessage) =>
  node(id, name, "@n8n/n8n-nodes-langchain.agent", 2.2, [x, 300],
    { promptType: "define", text, options: { systemMessage, maxIterations: 6 } },
    null, { retryOnFail: true, maxTries: 2 });

const workflow = {
  name: "Teman – patient trend analysis",
  nodes: [
    node("05598343-c3a9-402a-876a-e063b65c1f87", "Webhook", "n8n-nodes-base.webhook", 2, [0, 300],
      { httpMethod: "POST", path: "teman-analyse", authentication: "headerAuth", responseMode: "responseNode", options: {} },
      { httpHeaderAuth: { id: "REPLACE_ME", name: "Teman webhook secret" } }),
    node("cb6ea61f-7b4d-4b4f-be0d-91a97a247b36", "Get patient data", "n8n-nodes-base.postgres", 2.5, [240, 300],
      { operation: "executeQuery", query: QUERY, options: { queryReplacement: "={{ $json.body.senior_id }}" } }, pg),
    node("dc5fcf4f-e542-4e0a-a631-198cce4fd8b2", "Compute baseline stats", "n8n-nodes-base.code", 2, [480, 300], { jsCode: computeStats }),

    // Agent 1: explains the computed trends for the GP, family and helper.
    agent("1577a0d5-e632-469e-83f7-801410161bae", "Trend analyser agent", 720,
      "={{ 'Patient data and computed trend statistics:\\n' + JSON.stringify($json, null, 2) }}", ANALYSER_SYSTEM),
    chatModel("4b1e1c0a-6f2d-4c8e-9a51-2d7c3e8f0a11", "DeepSeek (analyser)", 640, { responseFormat: "json_object" }),

    node("d672fc01-6de8-4d14-b6c9-045f21e2a9cc", "Parse and check", "n8n-nodes-base.code", 2, [1040, 300], { jsCode: parseAndCheck }),

    // Agent 2: turns the checked analysis into a care plan, with a vetted resources tool.
    agent("7f3a9d52-1b6e-4c0f-8e27-5a9b1c4d6e30", "Healthcare advisor agent", 1280,
      "={{ 'Checked trend analysis (urgency is final):\\n' + JSON.stringify($json, null, 2) + '\\n\\nPatient data and statistics:\\n' + JSON.stringify($('Compute baseline stats').first().json, null, 2) }}",
      ADVISOR_SYSTEM),
    chatModel("a2c8e4f1-3d5b-4a7e-b9c0-6e1f2a3b4c5d", "DeepSeek (advisor)", 1200, { temperature: 0.3 }),
    node("e5d7f9a1-2b4c-4d6e-8f0a-1b3c5d7e9f20", "SG care resources", "@n8n/n8n-nodes-langchain.toolCode", 1.1, [1400, 520], {
      name: "sg_care_resources",
      description: "Look up vetted Singapore health and caregiver support services. Input: a topic such as 'falls', 'nutrition', 'caregiver respite', 'helper rest day', 'confusion' or 'emergency'. Returns a JSON list of {id, name, contact, what}. Only cite ids returned here.",
      jsCode: resourceTool,
    }),

    node("b8f0a2c4-6d8e-4f1a-9b3c-5d7e9f1a3b50", "Add care plan", "n8n-nodes-base.code", 2, [1600, 300], { jsCode: addCarePlan }),
    node("660bb2f1-c507-44f5-b09b-0ce196330eda", "Save analysis", "n8n-nodes-base.postgres", 2.5, [1840, 300],
      {
        operation: "executeQuery",
        query: "INSERT INTO ai_analyses (senior_id, urgency, result)\nVALUES ($1, $2, $3::jsonb)\nRETURNING id, created_at;",
        options: { queryReplacement: "={{ [$json.senior_id, $json.urgency, JSON.stringify($json)] }}" },
      }, pg),
    node("c9a2bec7-d886-4ec3-aff4-ec4283cc24d6", "Respond", "n8n-nodes-base.respondToWebhook", 1.1, [2080, 300],
      { respondWith: "json", responseBody: "={{ JSON.stringify($('Add care plan').first().json) }}", options: {} }),
  ],
  connections: {},
  settings: { executionOrder: "v1" },
  pinData: {},
};

const link = (from, to, type = "main") => {
  workflow.connections[from] ??= {};
  workflow.connections[from][type] = [[{ node: to, type, index: 0 }]];
};
const chain = ["Webhook", "Get patient data", "Compute baseline stats", "Trend analyser agent", "Parse and check",
  "Healthcare advisor agent", "Add care plan", "Save analysis", "Respond"];
for (let i = 0; i < chain.length - 1; i++) link(chain[i], chain[i + 1]);
link("DeepSeek (analyser)", "Trend analyser agent", "ai_languageModel");
link("DeepSeek (advisor)", "Healthcare advisor agent", "ai_languageModel");
link("SG care resources", "Healthcare advisor agent", "ai_tool");

writeFileSync(new URL("./teman-analysis-workflow.json", import.meta.url), JSON.stringify(workflow, null, 2) + "\n");
console.log("wrote n8n/teman-analysis-workflow.json");

