-- Tracking post-campaña: performance real de cada challenger ejecutado.
-- Se alimenta manualmente o vía importer desde Meta/Google Ads Reporting.

BEGIN;

CREATE TABLE IF NOT EXISTS experiment_results (
  id                        SERIAL PRIMARY KEY,
  experiment_id             INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  challenger_id             VARCHAR(60) NOT NULL,
    -- matchea el id de challenger dentro del experiment (p.ej. "angle_3")
  platform                  VARCHAR(40) NOT NULL,
    -- 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'google' | otros
  impressions               INTEGER,
  clicks                    INTEGER,
  ctr                       NUMERIC(6,4),
  conversions               INTEGER,
  conversion_rate           NUMERIC(6,4),
  cpc                       NUMERIC(10,2),
  cpa                       NUMERIC(10,2),
  predicted_score           NUMERIC(5,2),
  actual_performance_score  NUMERIC(5,2),
    -- calculado post-hoc, comparable al predicted_score para calibrar
  campaign_duration_days    INTEGER,
  budget_spent              NUMERIC(12,2),
  currency                  VARCHAR(3) DEFAULT 'USD',
  notes                     TEXT,
  recorded_by               INTEGER REFERENCES users(id),
  recorded_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT experiment_results_ctr_range
    CHECK (ctr IS NULL OR (ctr >= 0 AND ctr <= 1)),
  CONSTRAINT experiment_results_cvr_range
    CHECK (conversion_rate IS NULL OR (conversion_rate >= 0 AND conversion_rate <= 1))
);

CREATE INDEX IF NOT EXISTS idx_exp_results_experiment ON experiment_results(experiment_id);
CREATE INDEX IF NOT EXISTS idx_exp_results_challenger ON experiment_results(experiment_id, challenger_id);
CREATE INDEX IF NOT EXISTS idx_exp_results_platform   ON experiment_results(platform);

COMMIT;
