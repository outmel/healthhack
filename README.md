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
- **Chair-stand**: currently a tap-to-count timer (the hour-20 fallback). The MediaPipe pose module plugs into `StandTest` in `src/app/helper/HelperApp.tsx`; it only needs to POST `{type: "mobility", value: seconds, meta: {reps}}` to `/api/observations`.
- **Personal-baseline engine** (`src/lib/baseline.ts`): mean and SD of her own last 14 days of data, lagged by 7 days so a slow decline isn't absorbed into "normal". A signal is flagged when its 3-day average moves more than 1.5 SD the wrong way. Two signals flagged together raise a "review" alert for the family.
- **Voice notes**: browser speech recognition (id-ID, fil-PH) or typed text, translated to English by DeepSeek; flagged concerns are stored with the note.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, SESSION_SECRET, DEEPSEEK_API_KEY
npm run seed                 # drops and recreates all tables with the Mdm Tan story
npm run dev
```

`npm run seed` resets everything. Run it before judging. It prints the baseline and z-score for each signal and exits non-zero if the combined alert doesn't fire.

## Seed story

Mdm Tan, 82, mild hypertension. Days 1–20 are stable (eats 75–90%, chair-stand 14–16 s). From day 21 intake drifts to 50–60% and the chair-stand to 19–21 s, and Siti's notes mention *pusing* (dizzy). Siti has had no rest day since day 8. Today's lunch and today's chair-stand are left out so the live demo adds them.

## Deploy

Railway project `teman`: services `web` (this app) and `Postgres`. `web` has `DATABASE_URL=${{Postgres.DATABASE_URL}}` and a generated `SESSION_SECRET`; `DEEPSEEK_API_KEY` must be set by hand. Deploy with `railway up -s web`.

## AI trend analysis (n8n)

The GP page's **Analyse with AI** button calls `/api/analyse`, which calls an n8n workflow (`n8n/teman-analysis-workflow.json`) on Railway's private network:

Webhook → Get patient data (SQL) → Compute baseline stats (code, same rule as `src/lib/baseline.ts`) → DeepSeek analysis → Parse and check → Save to `ai_analyses` → Respond.

The model only explains the numbers; it never computes them. Two safety nets live in code: a combined meal + mobility flag can't be downgraded to "routine", and red-flag words in notes (fall, chest pain, breathlessness, confusion, slurred speech, fainting, hard to wake, in English, Bahasa Indonesia and Tagalog) force "urgent" with 995 advice. The latest saved result shows instantly on the GP, family and helper views, so judging never waits on a live call.

To change the workflow, edit `n8n/build-workflow.mjs` and run `node n8n/build-workflow.mjs`.

### One-time n8n setup

1. Open the n8n service's URL and create the owner account.
2. Import `n8n/teman-analysis-workflow.json` (Workflows → Import from file).
3. Create three credentials and select them in the nodes that show a warning:
   - **Teman Postgres** (Postgres): host `postgres.railway.internal`, port `5432`, database `railway`, user `postgres`, password = `PGPASSWORD` from the Railway Postgres service. SSL off.
   - **DeepSeek API key** (Header Auth): name `Authorization`, value `Bearer <your DeepSeek key>`.
   - **Teman webhook secret** (Header Auth): name `x-teman-secret`, value = `N8N_WEBHOOK_SECRET` from the Railway `web` service.
4. Activate the workflow (production webhooks only run when it's active).
