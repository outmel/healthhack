# Teman

Teman turns a domestic helper's phone into an early-warning system for a frail senior's decline. ("Teman" means companion in Malay and Indonesian.)

**The helper sees it first. Teman makes sure everyone else sees it too.**

Teman flags trends; it doesn't diagnose. Emergencies always go to 995. All data in this repo is synthetic.

## Demo logins

Password for all three: `teman2026`

| Email | Role | Lands on |
| --- | --- | --- |
| siti@teman.demo | Helper | `/helper` (Bahasa Indonesia, toggle to Tagalog/English) |
| rachel@teman.demo | Family | `/family` |
| drlim@teman.demo | GP | `/gp` |

## How it works

- **Helper view**: three big buttons (meal photo, chair-stand test, voice note) plus a two-tap wellbeing check-in. No chat.
- **Plate estimate**: before and after photos go to DeepSeek vision (`src/lib/ai.ts`), which returns % eaten plus a confidence level. Shown to users in 25% buckets.
- **Chair-stand (on-device pose)**: `src/app/helper/PoseStandTest.tsx` runs MediaPipe `pose_landmarker_lite` in the browser (GPU, CPU fallback; served from `public/mediapipe/`, jsDelivr as backup). Rep detection is a pure function in `src/lib/pose.ts`: hip-above-knee height in thigh lengths, 5-frame moving average, SEATED→STANDING above 60% of the range and back below 30%, timed from the first rise to the 5th full stand. A wrist staying near its knee during 2+ rises gives the finding `used_hands`. More than 30% of frames without a clear view → "film from the side" and tap-to-count. **Video never leaves the phone**: only seconds, findings and a 13-joint, 10 fps landmark track (~30 KB) are saved in `observations.meta`. "Use sample" plays a stored track through the same detector for laptops without a camera; "Count by tapping instead" is always one link away.
- **Then vs now** (`src/components/StandReplay.tsx`): a typical day from her baseline window as a grey ghost skeleton, the latest test in green, on one clock. Shown on the helper result screen, under "Standing up" on the family view and beside the chart for the GP.
- **Plate leftovers**: DeepSeek vision also returns boxes around uneaten food on the after photo; drawn in amber only when confidence isn't low. Photos are never stored. The family view shows a week of plates filled to each day's intake.
- **How early Teman noticed** (`firstFlag`, `driftStart`, `leadTime` in `src/lib/baseline.ts`): replays the engine day by day to find when the change began, when it was flagged and when the family was alerted. `src/components/CareTimeline.tsx` draws 28 days of plates, stands and notes with the flag day marked.
- **Closing the loop**: "Book a GP visit" shares a read-only 1-page summary (`/summary/[token]`, signed, expires in 7 days) and records the review date (`POST /api/alerts/[id]/review`). "Give Siti Sunday off" writes `rest_days` (`POST /api/rest-day`); Siti sees it on her home screen and Dr Lim on the patient card.
- **Personal-baseline engine** (`src/lib/baseline.ts`): mean and SD of her own last 14 days of data, lagged by 7 days so a slow decline isn't absorbed into "normal". A signal is flagged when its 3-day average moves more than 1.5 SD the wrong way. Two signals flagged together raise a "review" alert for the family.
- **Voice notes**: browser speech recognition (id-ID, fil-PH) or typed text, translated to English by DeepSeek; flagged concerns are stored with the note.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, SESSION_SECRET, DEEPSEEK_API_KEY
npm run seed                 # drops and recreates all tables with the Mdm Tan story
npm run dev
```

`npm run seed` resets everything (and applies the schema: `medications`, `alerts.gp_review_at`, `rest_days`). Run it before judging. It prints the baseline and z-score for each signal and exits non-zero if the combined alert doesn't fire.

## Tests and fixtures

```bash
npm test          # node --test: baseline engine, lead time, rep detection
npm run fixtures  # regenerate scripts/fixtures/stand-*.json
```

The stand fixtures are **synthetic** (`scripts/fixtures/simulate-stand.ts`) until real clips are recorded. To swap in a real one: open `/helper?debug`, run the stand test on the clip, press "Download track", and save it as `scripts/fixtures/stand-normal.json` or `stand-slow.json`. Before the hour-8 go/no-go, also check the detector by hand on 6 real clips (2 people × normal, slow, with hands): correct rep count and within ±1 s of a stopwatch.

The GP chart's falls-risk line is ≥15 s from Buatois et al., J Am Geriatr Soc 2008 (PMID 18808608). Check the full text before quoting sensitivity or specificity.

## Seed story

Mdm Tan, 82, mild hypertension. Days 1–20 are stable (eats 75–90%, chair-stand 14–16 s). From day 21 intake drifts to 50–60% and the chair-stand to 19–21 s, and Siti's notes mention *pusing* (dizzy). Siti has had no rest day since day 8. The drift ramps in over three days, so the change begins on day 21 and Teman flags it a day later, days before Siti's note about holding the table (day 27). From day 22 the chair-stand tracks show her pushing up with her hands on reps 3–5. Mdm Tan takes amlodipine; Siti's notes carry concern tags (dizziness, low fluid intake). Today's lunch and today's chair-stand are left out so the live demo adds them.

## Deploy

Railway project `teman`: services `web` (this app) and `Postgres`. `web` has `DATABASE_URL=${{Postgres.DATABASE_URL}}` and a generated `SESSION_SECRET`; `DEEPSEEK_API_KEY` must be set by hand. Deploy with `railway up -s web`.

## AI trend analysis (n8n)

The GP page's **Analyse with AI** button calls `/api/analyse`, which calls an n8n workflow (`n8n/teman-analysis-workflow.json`) on Railway's private network:

Webhook → Get patient data (SQL) → Compute baseline stats (code, same rule as `src/lib/baseline.ts`) → **Trend analyser agent** → Parse and check → **Healthcare advisor agent** → Add care plan → Save to `ai_analyses` → Respond.

Two n8n AI Agent nodes, each with its own DeepSeek chat model:

- **Trend analyser agent** explains the computed trends: GP headline and summary, symptom tags, questions worth reviewing, and messages for the family and helper.
- **Healthcare advisor agent** turns the checked analysis into a care plan: focus areas with family and helper actions, clinical checks for the GP (phrased as questions), when to see the GP, warning signs for 995, and support services. It has one tool, `sg_care_resources`, a vetted list of Singapore contacts (995, 1777, AIC, HealthHub, Dementia Singapore, CDE, SOS). Check the numbers in `RESOURCES` in `n8n/build-workflow.mjs` before going live.

The care plan appears on the GP panel and as "What you can do this week" on the family page.

The models only explain the numbers; they never compute them. The safety nets live in code: a combined meal + mobility flag can't be downgraded to "routine", and red-flag words in notes (fall, chest pain, breathlessness, confusion, slurred speech, fainting, hard to wake, in English, Bahasa Indonesia and Tagalog) force "urgent" with 995 advice. In the care plan, "see GP" can't be softer than the urgency, and resources are kept only if their id is on the vetted list, with contact details filled in from that list (never from the model). The latest saved result shows instantly on the GP, family and helper views, so judging never waits on a live call.

To change the workflow, edit `n8n/build-workflow.mjs` and run `node n8n/build-workflow.mjs`.

### One-time n8n setup

1. Open the n8n service's URL and create the owner account.
2. Import `n8n/teman-analysis-workflow.json` (Workflows → Import from file).
3. Create three credentials and select them in the nodes that show a warning:
   - **Teman Postgres** (Postgres): host `postgres.railway.internal`, port `5432`, database `railway`, user `postgres`, password = `PGPASSWORD` from the Railway Postgres service. SSL off.
   - **DeepSeek account** (DeepSeek credential type): your DeepSeek API key. Both chat model nodes use it.
   - **Teman webhook secret** (Header Auth): name `x-teman-secret`, value = `N8N_WEBHOOK_SECRET` from the Railway `web` service.
4. Activate the workflow (production webhooks only run when it's active).
