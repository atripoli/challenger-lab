-- Challenger Lab · schema inicial
-- Convenciones: snake_case · timestamps en UTC · soft-delete via deleted_at

BEGIN;

-- ---------- roles ----------
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
  ('admin',     'Gestiona usuarios, prompts de skills y configuración global'),
  ('analyst',   'Crea y ejecuta experimentos Champion & Challenger'),
  ('viewer',    'Solo lectura de experimentos y resultados')
ON CONFLICT (name) DO NOTHING;

-- ---------- users ----------
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  role_id         INTEGER NOT NULL REFERENCES roles(id),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

-- ---------- clients ----------
CREATE TABLE IF NOT EXISTS clients (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  industry    VARCHAR(100),
  notes       TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(LOWER(name)) WHERE deleted_at IS NULL;

-- ---------- products ----------
CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  category     VARCHAR(100),
  description  TEXT,
  brief        TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_products_client ON products(client_id) WHERE deleted_at IS NULL;

-- ---------- experiments ----------
-- Un experimento = un aviso Champion + sus challengers generados por los 4 skills.
CREATE TABLE IF NOT EXISTS experiments (
  id                  SERIAL PRIMARY KEY,
  product_id          INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name                VARCHAR(255) NOT NULL,
  status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    -- draft | analyzing | optimizing | executing | scoring | completed | failed
  champion_image_url  TEXT,
  champion_public_id  VARCHAR(255),
  brief_snapshot      TEXT,
  historical_data     JSONB,
  angles              JSONB,
  optimized_angles    JSONB,
  executions          JSONB,
  scores              JSONB,
  winner_id           VARCHAR(100),
  error_message       TEXT,
  created_by          INTEGER REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ,
  CHECK (status IN ('draft','analyzing','optimizing','executing','scoring','completed','failed'))
);

CREATE INDEX IF NOT EXISTS idx_experiments_product ON experiments(product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_experiments_status  ON experiments(status)     WHERE deleted_at IS NULL;

-- ---------- skill_prompts ----------
-- System prompts editables por admins para cada uno de los 4 skills.
CREATE TABLE IF NOT EXISTS skill_prompts (
  id             SERIAL PRIMARY KEY,
  skill_name     VARCHAR(100) UNIQUE NOT NULL,
  display_name   VARCHAR(150) NOT NULL,
  description    TEXT,
  system_prompt  TEXT NOT NULL,
  user_editable  BOOLEAN NOT NULL DEFAULT TRUE,
  version        INTEGER NOT NULL DEFAULT 1,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by     INTEGER REFERENCES users(id)
);

-- Histórico de versiones (para rollback / auditoría).
CREATE TABLE IF NOT EXISTS skill_prompt_revisions (
  id              SERIAL PRIMARY KEY,
  skill_prompt_id INTEGER NOT NULL REFERENCES skill_prompts(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  system_prompt   TEXT NOT NULL,
  updated_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (skill_prompt_id, version)
);

-- ---------- trigger helpers ----------
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['users','clients','products','experiments']) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
       CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION touch_updated_at();',
      t
    );
  END LOOP;
END $$;

COMMIT;
