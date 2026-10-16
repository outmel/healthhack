-- Teman schema. Six tables from the build plan; password_hash and meta are the only additions.
DROP TABLE IF EXISTS ai_analyses, carer_checkins, alerts, baselines, observations, seniors, users CASCADE;

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('helper', 'family', 'gp')),
  language      TEXT NOT NULL DEFAULT 'en',  -- id | tl | en
  household_id  INT  NOT NULL
);

CREATE TABLE seniors (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  age          INT  NOT NULL,
  household_id INT  NOT NULL,
  conditions   TEXT[] NOT NULL DEFAULT '{}'
);

-- value: meal = % eaten (0-100), mobility = seconds for 5 chair-stands, voice = null
CREATE TABLE observations (
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
CREATE INDEX observations_senior_type_time ON observations (senior_id, type, created_at);

CREATE TABLE baselines (
  senior_id   INT  NOT NULL REFERENCES seniors(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  mean        REAL NOT NULL,
  sd          REAL NOT NULL,
  window_days INT  NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (senior_id, type)
);

CREATE TABLE alerts (
  id           SERIAL PRIMARY KEY,
  senior_id    INT NOT NULL REFERENCES seniors(id) ON DELETE CASCADE,
  signals      TEXT[] NOT NULL,
  severity     TEXT NOT NULL CHECK (severity IN ('info', 'watch', 'review')),
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE carer_checkins (
  id           SERIAL PRIMARY KEY,
  helper_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood         INT NOT NULL CHECK (mood BETWEEN 1 AND 5),
  rested_today BOOLEAN NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Written by the n8n "Teman – patient trend analysis" workflow (n8n/teman-analysis-workflow.json).
CREATE TABLE ai_analyses (
  id         SERIAL PRIMARY KEY,
  senior_id  INT  NOT NULL REFERENCES seniors(id) ON DELETE CASCADE,
  urgency    TEXT NOT NULL,
  result     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
