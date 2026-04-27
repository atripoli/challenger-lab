-- Histórico de campañas por producto. Se alimenta manualmente o (a futuro)
-- vía importer xlsx. El orchestrator lo consulta para alimentar al Analyzer
-- y al Scorer con contexto de campañas previas, en lugar de pedirlo en cada
-- experimento como JSON pegado.

BEGIN;

CREATE TABLE IF NOT EXISTS product_history (
  id              SERIAL PRIMARY KEY,
  product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  campaign_name   VARCHAR(255),
  period_start    DATE,
  period_end      DATE,
  platform        VARCHAR(40),
    -- 'facebook'|'instagram'|'linkedin'|'tiktok'|'youtube'|'google'|otros
  impressions     INTEGER,
  clicks          INTEGER,
  ctr             NUMERIC(6,4),
  conversions     INTEGER,
  conversion_rate NUMERIC(6,4),
  cpc             NUMERIC(10,2),
  cpa             NUMERIC(10,2),
  budget_spent    NUMERIC(12,2),
  currency        VARCHAR(3) DEFAULT 'USD',
  source          VARCHAR(20) NOT NULL DEFAULT 'manual',
    -- 'manual' (cargado por usuario)
    -- 'experiment' (auto-generado al cerrar un experimento — futuro)
    -- 'xlsx' (importer)
  notes           TEXT,
  recorded_by     INTEGER REFERENCES users(id),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT product_history_ctr_range
    CHECK (ctr IS NULL OR (ctr >= 0 AND ctr <= 1)),
  CONSTRAINT product_history_cvr_range
    CHECK (conversion_rate IS NULL OR (conversion_rate >= 0 AND conversion_rate <= 1)),
  CONSTRAINT product_history_period_order
    CHECK (period_start IS NULL OR period_end IS NULL OR period_start <= period_end),
  CONSTRAINT product_history_source_check
    CHECK (source IN ('manual','experiment','xlsx'))
);

CREATE INDEX IF NOT EXISTS idx_product_history_product
  ON product_history(product_id);
CREATE INDEX IF NOT EXISTS idx_product_history_period
  ON product_history(product_id, period_start DESC);

COMMIT;
