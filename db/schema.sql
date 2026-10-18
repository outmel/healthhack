-- Teman schema. Six tables from the build plan; password_hash and meta are the only additions.
-- Run on every demo reset, so it only creates what's missing: accounts people signed up for
-- survive. The reset itself clears household 1 only (src/lib/demoSeed.ts).
-- Changing a table here won't alter an existing database; drop it by hand (or ALTER) first.

-- Household 1 is the demo (no code, so nobody can join it). Signed-up households get an
-- invite code the helper and GP use to join (POST /api/signup).
CREATE TABLE IF NOT EXISTS households (
  id         SERIAL PRIMARY KEY,
  code       TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO households (id, code) VALUES (1, NULL) ON CONFLICT DO NOTHING;
SELECT setval(pg_get_serial_sequence('households', 'id'), GREATEST((SELECT max(id) FROM households), 1));

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('helper', 'family', 'gp')),
  language      TEXT NOT NULL DEFAULT 'en',  -- id | tl | en
  household_id  INT  NOT NULL
);

CREATE TABLE IF NOT EXISTS seniors (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  age          INT  NOT NULL,
  household_id INT  NOT NULL,
  conditions   TEXT[] NOT NULL DEFAULT '{}',
  medications  TEXT[] NOT NULL DEFAULT '{}'
);

-- value: meal = % eaten (0-100), mobility = seconds for 5 chair-stands, voice = null
-- meta for mobility: { reps, method: "pose" | "tap", findings[], hand_reps[], rep_times[], landmarks }
--   landmarks = 13-joint track at 10 fps (src/lib/pose.ts); the video itself is never uploaded.
-- meta for voice: { lang, concerns[] } (concerns from translateNote)
CREATE TABLE IF NOT EXISTS observations (
  id              SERIAL PRIMARY KEY,
  senior_id       INT NOT NULL REFERENCES seniors(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('meal', 'mobility', 'voice')),
  value           REAL,
  meta            JSONB NOT NULL DEFAULT '{}',
  raw_media_url   TEXT,
  original_text   TEXT,
  translated_text TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS observations_senior_type_time ON observations (senior_id, type, created_at);

CREATE TABLE IF NOT EXISTS baselines (
  senior_id   INT  NOT NULL REFERENCES seniors(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  mean        REAL NOT NULL,
  sd          REAL NOT NULL,
  window_days INT  NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (senior_id, type)
);

CREATE TABLE IF NOT EXISTS alerts (
  id           SERIAL PRIMARY KEY,
  senior_id    INT NOT NULL REFERENCES seniors(id) ON DELETE CASCADE,
  signals      TEXT[] NOT NULL,
  severity     TEXT NOT NULL CHECK (severity IN ('info', 'watch', 'review')),
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  gp_review_at TIMESTAMPTZ  -- set when the family books a GP review (POST /api/alerts/[id]/review)
);

CREATE TABLE IF NOT EXISTS carer_checkins (
  id           SERIAL PRIMARY KEY,
  helper_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood         INT NOT NULL CHECK (mood BETWEEN 1 AND 5),
  rested_today BOOLEAN NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Written by the n8n "Teman – patient trend analysis" workflow (n8n/teman-analysis-workflow.json).
CREATE TABLE IF NOT EXISTS ai_analyses (
  id         SERIAL PRIMARY KEY,
  senior_id  INT  NOT NULL REFERENCES seniors(id) ON DELETE CASCADE,
  urgency    TEXT NOT NULL,
  result     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rest days the family gives the helper (POST /api/rest-day). Shown on the helper and GP views.
CREATE TABLE IF NOT EXISTS rest_days (
  id         SERIAL PRIMARY KEY,
  helper_id  INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  set_by     INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (helper_id, day)
);

-- Family -> helper messages (POST /api/messages), translated into the helper's language.
CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  from_user       INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user         INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_text   TEXT NOT NULL,
  translated_text TEXT,           -- null if translation failed; the original is shown instead
  lang            TEXT NOT NULL,  -- language of translated_text (the helper's language)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- When the demo story was last seeded (src/lib/demoSeed.ts), so it can refresh once a day.
CREATE TABLE IF NOT EXISTS demo_meta (
  seeded_on  DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
