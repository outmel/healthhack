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
const daysSinceRest = since ? Math.floor((Date.now() - new Date(since).getTime()) / 864e5) : null;
const recentMoods = carer.slice(-7).map(c => c.mood).filter(m => m != null);

return [{ json: {
  senior_id: seniorId,
  senior: d.senior,
  signals: { meal_intake_pct: meal, sit_to_stand_seconds: mobility },
  combined_flag: !!(meal.flagged && mobility.flagged),
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
const raw = ($input.first().json.choices?.[0]?.message?.content || '').trim();
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

const SYSTEM = `You are Teman's care-trend analyst. You support a GP, a family and a domestic helper caring for a frail older adult in Singapore.

Rules:
- You flag trends and suggest who should look at what. You never diagnose, never name a likely cause as fact, and never suggest starting, stopping or changing medication.
- Use only the numbers provided. Do not recompute or invent figures.
- Treat helper notes as observations, not facts. Quote dates when you refer to them.
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
  "helper_message": "message in the helper's language",
  "helper_message_en": "English translation of helper_message",
  "carer_wellbeing": "one sentence about the helper's own wellbeing, or empty string"
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
  'notes', (
    SELECT json_agg(json_build_object('date', (created_at AT TIME ZONE 'Asia/Singapore')::date, 'original', original_text, 'translated', translated_text) ORDER BY created_at DESC)
    FROM observations
    WHERE senior_id = $1 AND type = 'voice' AND created_at > now() - interval '35 days'),
  'carer', (
    SELECT json_agg(json_build_object('date', (c.created_at AT TIME ZONE 'Asia/Singapore')::date, 'helper', u.name, 'language', u.language, 'mood', c.mood, 'rested_today', c.rested_today, 'note', c.note) ORDER BY c.created_at)
    FROM carer_checkins c JOIN users u ON u.id = c.helper_id
    WHERE u.household_id = (SELECT household_id FROM seniors WHERE id = $1)
      AND c.created_at > now() - interval '35 days')
) AS data;`;

const pg = { postgres: { id: "REPLACE_ME", name: "Teman Postgres" } };
const node = (id, name, type, typeVersion, x, parameters, credentials) => ({
  parameters, id, name, type, typeVersion, position: [x, 300], ...(credentials && { credentials }),
});

const workflow = {
  name: "Teman – patient trend analysis",
  nodes: [
    node("05598343-c3a9-402a-876a-e063b65c1f87", "Webhook", "n8n-nodes-base.webhook", 2, 0,
      { httpMethod: "POST", path: "teman-analyse", authentication: "headerAuth", responseMode: "responseNode", options: {} },
      { httpHeaderAuth: { id: "REPLACE_ME", name: "Teman webhook secret" } }),
    node("cb6ea61f-7b4d-4b4f-be0d-91a97a247b36", "Get patient data", "n8n-nodes-base.postgres", 2.5, 240,
      { operation: "executeQuery", query: QUERY, options: { queryReplacement: "={{ $json.body.senior_id }}" } }, pg),
    node("dc5fcf4f-e542-4e0a-a631-198cce4fd8b2", "Compute baseline stats", "n8n-nodes-base.code", 2, 480, { jsCode: computeStats }),
    node("1577a0d5-e632-469e-83f7-801410161bae", "DeepSeek analysis", "n8n-nodes-base.httpRequest", 4.2, 720,
      {
        method: "POST",
        url: "https://api.deepseek.com/chat/completions",
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ JSON.stringify({ model: 'deepseek-flash', reasoning_effort: 'low', max_tokens: 8000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: " +
          JSON.stringify(SYSTEM) +
          " }, { role: 'user', content: 'Patient data and computed trend statistics:\\n' + JSON.stringify($json, null, 2) }] }) }}",
        options: { timeout: 90000 },
      },
      { httpHeaderAuth: { id: "REPLACE_ME", name: "DeepSeek API key" } }),
    node("d672fc01-6de8-4d14-b6c9-045f21e2a9cc", "Parse and check", "n8n-nodes-base.code", 2, 960, { jsCode: parseAndCheck }),
    node("660bb2f1-c507-44f5-b09b-0ce196330eda", "Save analysis", "n8n-nodes-base.postgres", 2.5, 1200,
      {
        operation: "executeQuery",
        query: "INSERT INTO ai_analyses (senior_id, urgency, result)\nVALUES ($1, $2, $3::jsonb)\nRETURNING id, created_at;",
        options: { queryReplacement: "={{ [$json.senior_id, $json.urgency, JSON.stringify($json)] }}" },
      }, pg),
    node("c9a2bec7-d886-4ec3-aff4-ec4283cc24d6", "Respond", "n8n-nodes-base.respondToWebhook", 1.1, 1440,
      { respondWith: "json", responseBody: "={{ JSON.stringify($('Parse and check').first().json) }}", options: {} }),
  ],
  connections: {},
  settings: { executionOrder: "v1" },
  pinData: {},
};

const order = workflow.nodes.map((n) => n.name);
for (let i = 0; i < order.length - 1; i++) {
  workflow.connections[order[i]] = { main: [[{ node: order[i + 1], type: "main", index: 0 }]] };
}

writeFileSync(new URL("./teman-analysis-workflow.json", import.meta.url), JSON.stringify(workflow, null, 2) + "\n");
console.log("wrote n8n/teman-analysis-workflow.json");
