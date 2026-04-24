-- Templates Ogilvy usados por el Creative Execution (skill 3).

BEGIN;

CREATE TABLE IF NOT EXISTS creative_templates (
  id             SERIAL PRIMARY KEY,
  template_key   VARCHAR(60) UNIQUE NOT NULL,
  template_name  VARCHAR(120) NOT NULL,
  structure      JSONB NOT NULL,
  best_for       TEXT,
  examples       JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO creative_templates (template_key, template_name, structure, best_for, examples) VALUES
(
  'PAS',
  'Problem-Agitate-Solution',
  '{
     "sections": [
       {"name": "problem",  "description": "Nombrar el problema tal como lo vive la audiencia."},
       {"name": "agitate",  "description": "Amplificar el costo emocional/práctico de no resolverlo."},
       {"name": "solution", "description": "Presentar el producto como el camino claro y creíble."}
     ],
     "headline_pattern": "Problema o tensión específica en una frase.",
     "body_pattern": "Párrafo 1 = problema · Párrafo 2 = consecuencia · Párrafo 3 = propuesta.",
     "cta_pattern": "Acción única y concreta."
   }'::jsonb,
  'Productos que resuelven un pain point claro y urgente.',
  '["Estás perdiendo 10 horas a la semana en tareas repetitivas. Multiplicalo por 50 semanas — un mes entero al año. Nuestra plataforma lo automatiza en 48h."]'::jsonb
),
(
  'BAB',
  'Before-After-Bridge',
  '{
     "sections": [
       {"name": "before",   "description": "Situación actual dolorosa de la audiencia."},
       {"name": "after",    "description": "Visualizar el estado deseado en concreto."},
       {"name": "bridge",   "description": "Cómo el producto conecta antes y después."}
     ],
     "headline_pattern": "Contraste directo: de X a Y.",
     "body_pattern": "Descripción del Before · pintura del After · product bridge específico.",
     "cta_pattern": "Empieza el cambio hoy."
   }'::jsonb,
  'Historias de transformación personal o de equipo.',
  '["Antes: reportes manuales los viernes hasta las 22h. Después: dashboard vivo que el board revisa solo. El puente: 3 semanas de onboarding con tu data."]'::jsonb
),
(
  'FAB',
  'Feature-Advantage-Benefit',
  '{
     "sections": [
       {"name": "feature",    "description": "Característica objetiva del producto."},
       {"name": "advantage",  "description": "Qué hace esa feature mejor que alternativas."},
       {"name": "benefit",    "description": "Qué gana el usuario en su día a día/objetivo."}
     ],
     "headline_pattern": "Beneficio final en primer plano.",
     "body_pattern": "Feature técnica · ventaja funcional · beneficio humano.",
     "cta_pattern": "Probalo sin costo."
   }'::jsonb,
  'Productos técnicos donde hace falta conectar feature con valor tangible.',
  '["Indexación en tiempo real (feature). Datos consultables al segundo vs. batch diario (advantage). Tomá decisiones con info fresca, no de ayer (benefit)."]'::jsonb
),
(
  'SOCIAL_PROOF_FIRST',
  'Social Proof First',
  '{
     "sections": [
       {"name": "proof",     "description": "Evidencia social contundente abre la pieza."},
       {"name": "relevance", "description": "Por qué esa prueba aplica al target específico."},
       {"name": "invitation","description": "Invitación a sumarse al grupo que ya obtuvo el beneficio."}
     ],
     "headline_pattern": "Cifra/testimonio en la entrada.",
     "body_pattern": "Prueba social · traducción a beneficio del lector · invitación.",
     "cta_pattern": "Sumate a los que ya lo hicieron."
   }'::jsonb,
  'Productos con base instalada sólida y testimonios defendibles.',
  '["2.400 equipos ya redujeron su churn 30%. Si tu SaaS factura entre $1M y $20M, el playbook es el mismo. Pedí la demo de 20 minutos."]'::jsonb
)
ON CONFLICT (template_key) DO NOTHING;

COMMIT;
