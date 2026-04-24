-- Multi-modelo: cada skill elige familia (Opus/Sonnet/Haiku) y sus hiperparámetros.
-- Estrategia: Sonnet para análisis/creatividad; Haiku para optimización/scoring → ~46% ahorro.

BEGIN;

-- ---------- nuevas columnas ----------
ALTER TABLE skill_prompts
  ADD COLUMN IF NOT EXISTS model       VARCHAR(60) NOT NULL DEFAULT 'claude-sonnet-4-6',
  ADD COLUMN IF NOT EXISTS max_tokens  INTEGER     NOT NULL DEFAULT 4096,
  ADD COLUMN IF NOT EXISTS temperature NUMERIC(3,2) NOT NULL DEFAULT 0.70;

-- Validaciones (drop-then-add para idempotencia).
ALTER TABLE skill_prompts DROP CONSTRAINT IF EXISTS skill_prompts_model_check;
ALTER TABLE skill_prompts
  ADD CONSTRAINT skill_prompts_model_check
  CHECK (model IN ('claude-opus-4-6','claude-sonnet-4-6','claude-haiku-4-5'));

ALTER TABLE skill_prompts DROP CONSTRAINT IF EXISTS skill_prompts_max_tokens_check;
ALTER TABLE skill_prompts
  ADD CONSTRAINT skill_prompts_max_tokens_check
  CHECK (max_tokens BETWEEN 256 AND 16384);

ALTER TABLE skill_prompts DROP CONSTRAINT IF EXISTS skill_prompts_temperature_check;
ALTER TABLE skill_prompts
  ADD CONSTRAINT skill_prompts_temperature_check
  CHECK (temperature BETWEEN 0.00 AND 1.00);

-- ---------- asignación por skill ----------
-- 1. Analyzer  → Sonnet (razonamiento sobre imagen + histórico)
-- 2. Optimizer → Haiku  (transformación estructurada barata)
-- 3. Ogilvy    → Sonnet (redacción creativa de alto nivel)
-- 4. Scorer    → Haiku  (evaluación determinística con temp baja)
UPDATE skill_prompts
   SET model = 'claude-sonnet-4-6', max_tokens = 4096, temperature = 0.75
 WHERE skill_name = 'product_insights_analyzer';

UPDATE skill_prompts
   SET model = 'claude-haiku-4-5',  max_tokens = 2048, temperature = 0.60
 WHERE skill_name = 'behavioral_science_optimizer';

UPDATE skill_prompts
   SET model = 'claude-sonnet-4-6', max_tokens = 6144, temperature = 0.80
 WHERE skill_name = 'ogilvy_creative_execution';

UPDATE skill_prompts
   SET model = 'claude-haiku-4-5',  max_tokens = 2048, temperature = 0.30
 WHERE skill_name = 'performance_scorer';

-- ---------- persistir hiperparámetros en revisiones ----------
-- (para poder auditar "qué modelo/temp usó la v3 del analyzer")
ALTER TABLE skill_prompt_revisions
  ADD COLUMN IF NOT EXISTS model       VARCHAR(60),
  ADD COLUMN IF NOT EXISTS max_tokens  INTEGER,
  ADD COLUMN IF NOT EXISTS temperature NUMERIC(3,2);

-- Backfill de la revisión inicial con los valores actuales.
UPDATE skill_prompt_revisions r
   SET model       = s.model,
       max_tokens  = s.max_tokens,
       temperature = s.temperature
  FROM skill_prompts s
 WHERE r.skill_prompt_id = s.id
   AND r.model IS NULL;

COMMIT;
