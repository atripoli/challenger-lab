-- Reemplaza la lógica `platforms[] × formats[] → cross-product` con una lista
-- explícita de canales `[{platform, format}, ...]` por experimento.
-- Soluciona dos problemas:
-- 1. El modelo expandía cross-products que el usuario no pidió (p.ej. agregaba
--    stories cuando solo había seleccionado feed).
-- 2. Aspect ratios variantes (1:1 + 1.91:1 + 4:5) se multiplicaban como
--    creatives separados, inflando el output.
-- Backfill: para experimentos legacy, derivar el cross-product de las arrays
-- existentes así no se rompe nada.

BEGIN;

ALTER TABLE experiments
  ADD COLUMN IF NOT EXISTS channels JSONB;

ALTER TABLE experiments DROP CONSTRAINT IF EXISTS experiments_channels_is_array;
ALTER TABLE experiments
  ADD CONSTRAINT experiments_channels_is_array
  CHECK (channels IS NULL OR jsonb_typeof(channels) = 'array');

-- Backfill: cross-product de (platforms × formats) en formato {platform, format}.
UPDATE experiments e
   SET channels = (
     SELECT jsonb_agg(jsonb_build_object('platform', p.value, 'format', f.value))
       FROM jsonb_array_elements_text(e.platforms) p,
            jsonb_array_elements_text(e.formats)   f
   )
 WHERE e.platforms IS NOT NULL
   AND e.formats   IS NOT NULL
   AND e.channels  IS NULL
   AND jsonb_array_length(e.platforms) > 0
   AND jsonb_array_length(e.formats)   > 0;

COMMIT;
