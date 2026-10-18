# Teman

Teman turns a domestic helper's phone into an early-warning system for a frail senior's decline. ("Teman" means friend in Malay and Indonesian.)

**The helper sees it first. Teman makes sure everyone else sees it too.**

Teman flags trends; it doesn't diagnose. Emergencies always go to 995. All demo data in this repo is synthetic.

- [Demo logins](#demo-logins)
- [Setting it up](#setting-it-up): local app, database, environment variables
- [AI trend analysis (n8n)](#ai-trend-analysis-n8n): running and connecting the workflow
- [Deploying to Railway](#deploying-to-railway)
- [Troubleshooting](#troubleshooting)
- [How it works](#how-it-works)

## Demo logins

Password for all three: `teman2026`

| Email | Role | Lands on |
| --- | --- | --- |
| siti@teman.demo | Helper | `/helper` (Bahasa Indonesia, toggle to Tagalog/English) |
| rachel@teman.demo | Family | `/family` |
| drlim@teman.demo | GP | `/gp` |

The login page also has one-tap buttons for each and a 2-minute guided demo.

### Your own accounts

**Create an account** on the login page (`/signup`) has two paths:

- **Start a household**: you (family, helper or GP) enter your details and the person you care for (name, age, optional conditions and medications). You get a 6-character **invite code**, shown in the bar at the top of every page.
- **Join with a code**: the helper, other family members or the GP enter that code to join the same household. A household can have one helper.

Signed-up households are separate from the demo: they never see Mdm Tan's data, and **Reset demo** and the daily refresh never touch them. A new household starts empty, so the views say "Still learning her usual" until the helper has logged about a week of meals and chair-stands.

---

## Setting it up

### 1. What you need

| | Needed for | Notes |
| --- | --- | --- |
| **Node.js 20.9+** | the app | `node -v` to check |
| **PostgreSQL 14+** | everything | local (Docker is easiest) or hosted (Railway) |
| **DeepSeek API key** | plate photos, translating notes and messages | [platform.deepseek.com](https://platform.deepseek.com). The app runs without it, but those features fail (messages are then delivered in English). |
| **n8n** (optional) | the GP's **Analyse with AI** button and care plans | see [AI trend analysis](#ai-trend-analysis-n8n). Without it the demo shows a ready-made summary. |

### 2. Get a database

Pick one:

**Local, with Docker**

```bash
docker run --name teman-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

**Railway**: in your Railway project, add a **Postgres** service. For local development use its `DATABASE_PUBLIC_URL` (Variables tab); the deployed app uses the private `DATABASE_URL` (see [Deploying](#deploying-to-railway)).

You don't create tables by hand: the seed (step 4) applies `db/schema.sql`.

### 3. Environment variables

```bash
cp .env.example .env.local
```

| Variable | Required | What to put |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string from step 2 |
| `SESSION_SECRET` | yes | any long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Signs login cookies and the GP summary links. |
| `DEEPSEEK_API_KEY` | for AI features | your DeepSeek key |
| `DEEPSEEK_MODEL` | no | defaults to `deepseek-flash` |
| `N8N_WEBHOOK_URL` | for **Analyse with AI** | locally `http://localhost:5678/webhook/teman-analyse`; on Railway see below |
| `N8N_WEBHOOK_SECRET` | with n8n | any random string; must match the n8n "Teman webhook secret" credential |
| `DEMO_PASSWORD` | no | password for the three demo users (default `teman2026`) |
| `DEMO_AUTO_RESET` | no | `off` stops the first sign-in of each day re-seeding the demo story |

### 4. Install, seed, run

```bash
npm install        # also copies the MediaPipe pose model into public/mediapipe/
npm run seed       # creates the tables and loads the Mdm Tan demo story
npm run dev        # http://localhost:3000
```

`npm run seed` prints each signal's baseline and z-score and exits non-zero if the combined alert doesn't fire. It's safe to re-run: it only resets the demo household (see [Demo data](#demo-data-and-resets)).

Check it works: open http://localhost:3000, tap **Start guided demo**, and walk through Siti → Rachel → Dr Lim.

### 5. Tests

```bash
npm test          # baseline engine, lead time, rep detection
npm run lint
npm run build     # production build; catches type errors too
```

---

## AI trend analysis (n8n)

The GP page's **Analyse with AI** button calls `/api/analyse`, which calls an n8n workflow (`n8n/teman-analysis-workflow.json`). n8n reads the patient's data from Postgres, runs two AI agents and saves the result to `ai_analyses`. The app always shows the latest saved result, so a slow or broken n8n never blocks the views.

```
Webhook → Get patient data (SQL) → Compute baseline stats → Trend analyser agent → Parse and check
        → Healthcare advisor agent → Add care plan → Save to ai_analyses → Respond
```

### Step 1: run n8n

Use a recent n8n (1.80 or later; the workflow uses the **DeepSeek Chat Model** node).

**Locally** (pick one):

```bash
npx n8n
# or
docker run -it --rm -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

Open http://localhost:5678 and create the owner account.

**On Railway**: add an n8n service to the same project (Railway's n8n template, or the `n8nio/n8n` image listening on port 5678). Open its public URL and create the owner account.

### Step 2: import the workflow

Workflows → **Import from file** → `n8n/teman-analysis-workflow.json`.

### Step 3: create three credentials

Open each node with a warning icon and create or select:

| Credential | Type | Values |
| --- | --- | --- |
| **Teman Postgres** | Postgres | The same database as the app. On Railway: host `postgres.railway.internal`, port `5432`, database `railway`, user `postgres`, password = `PGPASSWORD` from the Postgres service, SSL off. Locally: the host/port/user/password from your `DATABASE_URL` (if n8n runs in Docker and Postgres on your machine, the host is `host.docker.internal`). |
| **DeepSeek account** | DeepSeek | your DeepSeek API key (both chat model nodes use it) |
| **Teman webhook secret** | Header Auth | name `x-teman-secret`, value = your `N8N_WEBHOOK_SECRET` |

### Step 4: activate and connect

1. Toggle the workflow **Active** (top right). Production webhooks only exist while it's active; until then the webhook returns 404.
2. Set `N8N_WEBHOOK_URL` in the app:
   - Local: `http://localhost:5678/webhook/teman-analyse`
   - Railway (private network, never exposed publicly): `http://${{n8n.RAILWAY_PRIVATE_DOMAIN}}:5678/webhook/teman-analyse`. Replace `n8n` with your n8n service's name if it differs.
3. Restart the app, sign in as Dr Lim, press **Analyse with AI**. A run takes 20–60 s.

### Changing the workflow

Edit `n8n/build-workflow.mjs` (prompts, safety rules, the vetted resources list), then:

```bash
node n8n/build-workflow.mjs   # regenerates n8n/teman-analysis-workflow.json
```

Re-import the JSON in n8n and re-select the three credentials (the file ships with placeholder credential ids).

### What the agents do

- **Trend analyser agent** explains the computed trends: GP headline and summary, symptom tags, questions worth reviewing, and messages for the family and helper.
- **Healthcare advisor agent** turns the checked analysis into a care plan: focus areas with family and helper actions, clinical checks for the GP (phrased as questions), when to see the GP, warning signs for 995, and support services. Its one tool, `sg_care_resources`, is a vetted list of Singapore contacts (995, 1777, AIC, HealthHub, Dementia Singapore, CDE, SOS). Check the numbers in `RESOURCES` in `n8n/build-workflow.mjs` before going live.

The models only explain the numbers; they never compute them. The safety nets live in code: a combined meal + mobility flag can't be downgraded to "routine", and red-flag words in notes (fall, chest pain, breathlessness, confusion, slurred speech, fainting, hard to wake, in English, Bahasa Indonesia and Tagalog) force "urgent" with 995 advice. "See GP" can't be softer than the urgency, and resources are kept only if their id is on the vetted list, with contact details filled in from that list (never from the model).

---

## Deploying to Railway

Railway project `teman` has three services: `web` (this app), `Postgres`, and `n8n`.

1. **Postgres**: add the service; nothing to configure.
2. **web**: deploy this folder (`railway up -s web`, or connect the GitHub repo). Set its variables:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `SESSION_SECRET` | a long random string |
   | `DEEPSEEK_API_KEY` | your key |
   | `N8N_WEBHOOK_URL` | `http://${{n8n.RAILWAY_PRIVATE_DOMAIN}}:5678/webhook/teman-analyse` |
   | `N8N_WEBHOOK_SECRET` | random string, same as the n8n credential |

   Railway runs `npm run build` and `npm start`. Generate a public domain under Settings → Networking.
3. **n8n**: follow [AI trend analysis](#ai-trend-analysis-n8n), using the Railway values.
4. **Seed once**: either run `npm run seed` locally with `DATABASE_URL` set to the Postgres `DATABASE_PUBLIC_URL`, or just sign in: the first sign-in of the day creates the tables and the demo story automatically.

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "Wrong email or password" for the demo users | the database hasn't been seeded: run `npm run seed` (or check `DATABASE_URL`) |
| `relation "users" does not exist` | same: seed first |
| **Analyse with AI** says "isn't set up yet" | `N8N_WEBHOOK_URL` is empty in the app's environment |
| **Analyse with AI** says "isn't available right now" | workflow not **Active** (404), wrong `N8N_WEBHOOK_SECRET` (403), or n8n can't reach Postgres. Check the n8n **Executions** tab. |
| Messages arrive in English, not the helper's language | `DEEPSEEK_API_KEY` missing or invalid (the message is still delivered) |
| Plate photo fails | `DEEPSEEK_API_KEY` missing or invalid |
| Chair-stand camera doesn't start | the browser needs camera permission and HTTPS (or `localhost`). "Count by tapping instead" always works. |
| Signed-up account disappeared | it was created on a build from before sign-up existed, whose reset dropped every table. Current builds only reset the demo household. |
| Changed a table in `db/schema.sql` but nothing happened | the schema only creates missing tables. Drop or `ALTER` the table by hand. |

---

## How it works

- **Helper view**: three big buttons (meal photo, chair-stand test, voice note) plus a two-tap wellbeing check-in. No chat.
- **Plate estimate**: before and after photos go to DeepSeek vision (`src/lib/ai.ts`), which returns % eaten plus a confidence level. Shown to users in 25% buckets.
- **Chair-stand (on-device pose)**: `src/app/helper/PoseStandTest.tsx` runs MediaPipe `pose_landmarker_lite` in the browser (GPU, CPU fallback; served from `public/mediapipe/`, jsDelivr as backup). Rep detection is a pure function in `src/lib/pose.ts`: hip-above-knee height in thigh lengths, 5-frame moving average, SEATED→STANDING above 60% of the range and back below 30%, timed from the first rise to the 5th full stand. A wrist staying near its knee during 2+ rises gives the finding `used_hands`. More than 30% of frames without a clear view → "film from the side" and tap-to-count. **Video never leaves the phone**: only seconds, findings and a 13-joint, 10 fps landmark track (~30 KB) are saved in `observations.meta`. "Use sample" plays a stored track through the same detector for laptops without a camera; "Count by tapping instead" is always one link away.
- **Then vs now** (`src/components/StandReplay.tsx`): a typical day from her baseline window as a grey ghost skeleton, the latest test in green, on one clock. Shown on the helper result screen, under "Standing up" on the family view and beside the chart for the GP.
- **Plate leftovers**: DeepSeek vision also returns boxes around uneaten food on the after photo; drawn in amber only when confidence isn't low. Photos are never stored. The family view shows a week of plates filled to each day's intake.
- **How early Teman noticed** (`firstFlag`, `driftStart`, `leadTime` in `src/lib/baseline.ts`): replays the engine day by day to find when the change began, when it was flagged and when the family was alerted. `src/components/CareTimeline.tsx` draws 28 days of plates, stands and notes with the flag day marked.
- **Closing the loop**: "Book a visit with Dr Lim" sends the clinic a ready-written message naming Dr Lim, with a read-only 1-page summary link (`/summary/[token]`, signed, expires in 7 days), and records the review date (`POST /api/alerts/[id]/review`). "Give Siti Sunday off" writes `rest_days` (`POST /api/rest-day`); Siti sees it on her home screen and Dr Lim on the patient card.
- **Messages** (`POST /api/messages`): Rachel can message Siti; Dr Lim can message Siti or Rachel from **Contact the household** on the GP page (with suggested messages and a list of what was sent). Anything to the helper is translated into her language by DeepSeek (original one tap away); if translation fails the English is delivered. Siti's home screen shows the latest message from each sender; Rachel's page shows messages from the GP at the top.
- **Personal-baseline engine** (`src/lib/baseline.ts`): mean and SD of her own last 14 days of data, lagged by 7 days so a slow decline isn't absorbed into "normal". A signal is flagged when its 3-day average moves more than 1.5 SD the wrong way. Two signals flagged together raise a "review" alert for the family.
- **Voice notes**: browser speech recognition (id-ID, fil-PH) or typed text, translated to English by DeepSeek; flagged concerns are stored with the note.
- **Accounts**: signed cookie sessions (`src/lib/session.ts`), scrypt password hashes (`src/lib/password.ts`). Each user belongs to one household (`households` table, with an invite code); every query is scoped to the signed-in user's household.

Chair-stand readings under 6 s or over 120 s aren't physically plausible; the API refuses them (Siti is asked to count again) and the baseline engine ignores any already stored.

### Demo data and resets

The Mdm Tan story lives in `src/lib/demoSeed.ts` and only ever touches the demo household (household 1). Three things reset it:

- `npm run seed` by hand.
- **Reset demo** on the login page or in the demo bar (`POST /api/demo/reset`). Everyone shares the demo household, so one visitor's test reading changes what the next sees; this puts it back.
- **Daily refresh**: the story is dated relative to the seed day, so the first sign-in of each Singapore day re-seeds it (`ensureFreshDemo`, tracked in `demo_meta`). Set `DEMO_AUTO_RESET=off` to disable.

The seed also saves one ready-made summary to `ai_analyses` (marked `source: "prepared"`), so the GP panel, Rachel's family message and Siti's "Tip for today" all show even if n8n is down. A live re-analysis replaces it; a failed one keeps it and says "Couldn't refresh, showing last summary."

### Demo bar and guided demo

Signed-in demo users get a slim bar: "Viewing as Siti · Switch to Rachel / Dr Lim", plus Reset demo. "Start guided demo" on the login page signs in as Siti and walks through three steps in that bar: Siti logs lunch and the stand test, Rachel sees the alert (and can message Siti), Dr Lim sees the trend charts and summary and can message Siti or Rachel. Signed-up households get a plain bar with their invite code instead.

### Seed story

Mdm Tan, 82, mild hypertension. Days 1–20 are stable (eats 75–90%, chair-stand 14–16 s). From day 21 intake drifts to 50–60% and the chair-stand to 19–21 s, and Siti's notes mention *pusing* (dizzy). Siti has had no rest day since day 8. The drift ramps in over three days, so the change begins on day 21 and Teman flags it a day later, days before Siti's note about holding the table (day 27). From day 22 the chair-stand tracks show her pushing up with her hands on reps 3–5. Mdm Tan takes amlodipine; Siti's notes carry concern tags (dizziness, low fluid intake). Today's lunch and today's chair-stand are left out so the live demo adds them.

### Stand fixtures

```bash
npm run fixtures  # regenerate scripts/fixtures/stand-*.json
```

The stand fixtures are **synthetic** (`scripts/fixtures/simulate-stand.ts`) until real clips are recorded. To swap in a real one: open `/helper?debug`, run the stand test on the clip, press "Download track", and save it as `scripts/fixtures/stand-normal.json` or `stand-slow.json`. Check the detector by hand on real clips (normal, slow, with hands): correct rep count and within ±1 s of a stopwatch.

The GP chart's falls-risk line is ≥15 s from Buatois et al., J Am Geriatr Soc 2008 (PMID 18808608). Check the full text before quoting sensitivity or specificity.
