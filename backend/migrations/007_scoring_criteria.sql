-- Criterios de scoring ponderados usados por Performance Scorer (skill 4).
-- Los pesos deben sumar 1.00. Se validan vía función helper abajo.

BEGIN;

CREATE TABLE IF NOT EXISTS scoring_criteria (
  id                 SERIAL PRIMARY KEY,
  criterion_key      VARCHAR(60) UNIQUE NOT NULL,
  criterion_name     VARCHAR(120) NOT NULL,
  weight             NUMERIC(3,2) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  description        TEXT NOT NULL,
  evaluation_guide   JSONB NOT NULL,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO scoring_criteria
  (criterion_key, criterion_name, weight, description, evaluation_guide, sort_order)
VALUES
(
  'novelty',
  'Novedad',
  0.30,
  'Cuán distintivo es vs. lo visto en la red social y en la categoría.',
  '{"10":"Nunca visto — ruptura real de convención","7":"Fresco con variación fuerte","5":"Conocido con twist propio","3":"Formato predecible","0":"Cliché / ya explotado"}'::jsonb,
  1
),
(
  'appeal',
  'Atractivo',
  0.40,
  'Fuerza de atención y conexión emocional con el público objetivo.',
  '{"10":"Pain point directo + emoción fuerte + beneficio claro","7":"Conecta con pain point pero emoción tibia","5":"Relevante genérico","3":"Conecta solo si el viewer hace esfuerzo","0":"No conecta"}'::jsonb,
  2
),
(
  'conversion',
  'Potencial de leads',
  0.30,
  'Probabilidad de que la pieza genere acción medible.',
  '{"10":"CTA claro + bajo friction + urgencia/valor explícito","7":"CTA correcto, una fricción menor","5":"CTA ok pero sin urgencia","3":"CTA confuso o escondido","0":"No se entiende qué hacer"}'::jsonb,
  3
)
ON CONFLICT (criterion_key) DO NOTHING;

-- Validador: los pesos de criterios activos deben sumar 1.00 ± 0.01.
CREATE OR REPLACE FUNCTION check_scoring_weights_sum()
RETURNS TRIGGER AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(weight),0) INTO total FROM scoring_criteria WHERE is_active;
  IF ABS(total - 1.00) > 0.01 THEN
    RAISE EXCEPTION 'Suma de pesos en scoring_criteria activos = %, debe ser 1.00', total;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scoring_weights_sum ON scoring_criteria;
CREATE CONSTRAINT TRIGGER trg_scoring_weights_sum
  AFTER INSERT OR UPDATE OR DELETE ON scoring_criteria
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_scoring_weights_sum();

COMMIT;
