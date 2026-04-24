-- Estructura de brief obligatoria en products.
-- Rename `brief` → `brief_text` (misma semántica) y agrega los 5 campos nuevos.

BEGIN;

-- 1. brief → brief_text (si aún no se migró)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'products' AND column_name = 'brief')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'products' AND column_name = 'brief_text')
  THEN
    EXECUTE 'ALTER TABLE products RENAME COLUMN brief TO brief_text';
  END IF;
END $$;

-- Si por algún motivo no existía brief ni brief_text, creamos brief_text.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brief_text       TEXT,
  ADD COLUMN IF NOT EXISTS target_audience  TEXT,
  ADD COLUMN IF NOT EXISTS key_benefit      TEXT,
  ADD COLUMN IF NOT EXISTS context          TEXT,
  ADD COLUMN IF NOT EXISTS platforms        JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS formats          JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill suave para filas existentes (no NOT NULL todavía, para no romper data previa).
UPDATE products
   SET brief_text      = COALESCE(brief_text, '(brief pendiente de completar)'),
       target_audience = COALESCE(target_audience, '(audiencia pendiente)')
 WHERE brief_text IS NULL OR target_audience IS NULL;

-- Una vez backfilleado, los marcamos como obligatorios para rows nuevas.
ALTER TABLE products
  ALTER COLUMN brief_text      SET NOT NULL,
  ALTER COLUMN target_audience SET NOT NULL;

-- Validación de shape en platforms/formats (array JSON de strings).
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_platforms_is_array;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_formats_is_array;
ALTER TABLE products
  ADD CONSTRAINT products_platforms_is_array CHECK (jsonb_typeof(platforms) = 'array'),
  ADD CONSTRAINT products_formats_is_array   CHECK (jsonb_typeof(formats)   = 'array');

COMMIT;
