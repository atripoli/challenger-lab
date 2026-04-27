-- Regla de registro lingüístico para los 4 skills:
-- TUTEO por default (tú/tu/te), no voseo. Override automático cuando
-- target_audience o context mencionan Argentina/Uruguay/Paraguay.

BEGIN;

-- Skill 1 — Analyzer
UPDATE skill_prompts
   SET system_prompt = $RULE$═══════════════════════════════════════════════════════
REGISTRO LINGÜÍSTICO (CRÍTICO PARA TODO EL OUTPUT)
═══════════════════════════════════════════════════════

POR DEFAULT: usa TUTEO (tú / tu / te) en español neutro LATAM.

✅ CORRECTO: "Conoce el programa", "Aprende mandarín", "Entrena tu equipo", "Descubre el método", "Hablas con confianza", "Tienes acceso", "Ahorras tiempo".

❌ INCORRECTO (voseo rioplatense): "Conocé el programa", "Aprendé mandarín", "Entrená tu equipo", "Descubrí el método", "Hablás con confianza", "Tenés acceso", "Ahorrás tiempo".

OVERRIDE A VOSEO: si target_audience o context del producto menciona EXPLÍCITAMENTE Argentina, Uruguay o Paraguay como mercado primario, ahí sí usa voseo (vos, hablás, tenés). En cualquier otro caso (Perú, Chile, Colombia, México, LATAM genérico, sin región especificada) → TUTEO.

ÁMBITO: aplica al CONTENIDO QUE EMITES (post_copy, headlines, descriptions, body copy, CTAs, overlay text, big_idea, optimized_messaging, recomendaciones, insights). El registro de este system prompt en sí mismo no afecta tu output.

═══════════════════════════════════════════════════════

$RULE$ || system_prompt,
       version    = version + 1,
       updated_at = NOW()
 WHERE skill_name = 'product_insights_analyzer';

-- Skill 2 — Optimizer
UPDATE skill_prompts
   SET system_prompt = $RULE$═══════════════════════════════════════════════════════
REGISTRO LINGÜÍSTICO (CRÍTICO PARA TODO EL OUTPUT)
═══════════════════════════════════════════════════════

POR DEFAULT: usa TUTEO (tú / tu / te) en español neutro LATAM.

✅ CORRECTO: "Conoce el programa", "Aprende mandarín", "Entrena tu equipo", "Descubre el método", "Hablas con confianza", "Tienes acceso", "Ahorras tiempo".

❌ INCORRECTO (voseo rioplatense): "Conocé el programa", "Aprendé mandarín", "Entrená tu equipo", "Descubrí el método", "Hablás con confianza", "Tenés acceso", "Ahorrás tiempo".

OVERRIDE A VOSEO: si target_audience o context del producto menciona EXPLÍCITAMENTE Argentina, Uruguay o Paraguay como mercado primario, ahí sí usa voseo. Default → TUTEO.

ÁMBITO: aplica al CONTENIDO QUE EMITES (optimized_messaging, application, expected_impact, etc.). El registro de este system prompt en sí mismo no afecta tu output.

═══════════════════════════════════════════════════════

$RULE$ || system_prompt,
       version    = version + 1,
       updated_at = NOW()
 WHERE skill_name = 'behavioral_science_optimizer';

-- Skill 3 — Ogilvy
UPDATE skill_prompts
   SET system_prompt = $RULE$═══════════════════════════════════════════════════════
REGISTRO LINGÜÍSTICO (CRÍTICO PARA TODO EL OUTPUT)
═══════════════════════════════════════════════════════

POR DEFAULT: usa TUTEO (tú / tu / te) en español neutro LATAM.

✅ CORRECTO: "Conoce el programa", "Aprende mandarín", "Entrena tu equipo", "Descubre el método", "Hablas con confianza", "Tienes acceso", "Ahorras tiempo".

❌ INCORRECTO (voseo rioplatense): "Conocé el programa", "Aprendé mandarín", "Entrená tu equipo", "Descubrí el método", "Hablás con confianza", "Tenés acceso", "Ahorrás tiempo".

OVERRIDE A VOSEO: si target_audience o context del producto menciona EXPLÍCITAMENTE Argentina, Uruguay o Paraguay como mercado primario, ahí sí usa voseo. Default → TUTEO.

ÁMBITO: aplica a TODO el CONTENIDO QUE EMITES (post_copy, headlines, descriptions, body copy, CTAs, overlay text, big_idea, hashtags). El registro de este system prompt en sí mismo no afecta tu output.

═══════════════════════════════════════════════════════

$RULE$ || system_prompt,
       version    = version + 1,
       updated_at = NOW()
 WHERE skill_name = 'ogilvy_creative_execution';

-- Skill 4 — Scorer
UPDATE skill_prompts
   SET system_prompt = $RULE$═══════════════════════════════════════════════════════
REGISTRO LINGÜÍSTICO (CRÍTICO PARA TODO EL OUTPUT)
═══════════════════════════════════════════════════════

POR DEFAULT: usa TUTEO (tú / tu / te) en español neutro LATAM.

✅ CORRECTO: "Conoce el programa", "Aprende mandarín", "Lanza Angle 2", "Testea contra Champion".

❌ INCORRECTO (voseo rioplatense): "Conocé el programa", "Aprendé mandarín", "Lanzá Angle 2", "Testeá contra Champion".

OVERRIDE A VOSEO: si target_audience o context del producto menciona EXPLÍCITAMENTE Argentina, Uruguay o Paraguay como mercado primario, ahí sí usa voseo. Default → TUTEO.

ÁMBITO: aplica al CONTENIDO QUE EMITES (rationale, recommendation, strengths, risks). El registro de este system prompt en sí mismo no afecta tu output.

═══════════════════════════════════════════════════════

$RULE$ || system_prompt,
       version    = version + 1,
       updated_at = NOW()
 WHERE skill_name = 'performance_scorer';

-- Persistir revisiones nuevas para los 4 skills.
INSERT INTO skill_prompt_revisions (skill_prompt_id, version, system_prompt, model, max_tokens, temperature)
SELECT id, version, system_prompt, model, max_tokens, temperature
  FROM skill_prompts
 WHERE skill_name IN (
   'product_insights_analyzer',
   'behavioral_science_optimizer',
   'ogilvy_creative_execution',
   'performance_scorer'
 )
ON CONFLICT DO NOTHING;

COMMIT;
