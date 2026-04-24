const { pool } = require('../config/db');
const { runSkill } = require('./skillExecutor');

const JSON_REMINDER = 'Devolvé exclusivamente un objeto JSON válido, sin prosa adicional ni bloques markdown.';

/**
 * Orquesta los 4 skills en secuencia sobre un experimento, consumiendo las
 * librerías de la DB (nudges, templates, scoring_criteria) y los campos
 * estructurados del producto.
 */
async function runExperiment(experimentId) {
  const ctx = await loadContext(experimentId);
  if (!ctx) throw new Error(`Experimento ${experimentId} no encontrado`);
  if (!ctx.champion_image_url) throw new Error('Falta imagen Champion para ejecutar los skills');

  try {
    // ---------- Paso 1 · Product Insights Analyzer ----------
    await setStatus(experimentId, 'analyzing');
    const angles = await stepAnalyzeAngles(ctx);
    await patchJsonb(experimentId, { angles });

    // ---------- Paso 2 · Behavioral Science Optimizer ----------
    await setStatus(experimentId, 'optimizing');
    const optimized = await stepOptimizeAngles(ctx, angles);
    await patchJsonb(experimentId, { optimized_angles: optimized });

    // ---------- Paso 3 · Ogilvy Creative Execution ----------
    await setStatus(experimentId, 'executing');
    const executions = await stepCreateExecutions(ctx, optimized);
    await patchJsonb(experimentId, { executions });

    // ---------- Paso 4 · Performance Scorer ----------
    await setStatus(experimentId, 'scoring');
    const { champion_score, challenger_scores, winner } = await stepScoreExecutions(ctx, executions);

    const uplift = winner?.uplift_vs_champion ?? null;
    const winnerId = winner?.angle_number != null ? `angle_${winner.angle_number}` : null;

    await pool.query(
      `UPDATE experiments
          SET scores              = $1::jsonb,
              champion_score      = $2::jsonb,
              winner_payload      = $3::jsonb,
              winner_id           = $4,
              uplift_vs_champion  = $5,
              status              = 'completed',
              completed_at        = NOW(),
              updated_at          = NOW(),
              error_message       = NULL
        WHERE id = $6`,
      [
        JSON.stringify(challenger_scores),
        JSON.stringify(champion_score),
        JSON.stringify(winner),
        winnerId,
        uplift,
        experimentId,
      ],
    );

    return { status: 'completed', winner_id: winnerId, uplift_vs_champion: uplift };
  } catch (err) {
    console.error(`[orchestrator] experimento ${experimentId} falló:`, err);
    await pool.query(
      `UPDATE experiments SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [err.message?.slice(0, 2000) || 'Error desconocido', experimentId],
    );
    throw err;
  }
}

// ---------------- pasos ----------------

async function stepAnalyzeAngles(ctx) {
  const userBlocks = [
    { type: 'image', source: { type: 'url', url: ctx.champion_image_url } },
    {
      type: 'text',
      text: [
        '## Brief del producto',
        `- brief_text: ${ctx.brief_text || '(sin brief)'}`,
        `- target_audience: ${ctx.target_audience || '(sin target)'}`,
        `- key_benefit: ${ctx.key_benefit || '(sin key benefit)'}`,
        `- context: ${ctx.context || '(sin contexto)'}`,
        '',
        '## Plataformas y formatos objetivo',
        `- platforms: ${JSON.stringify(ctx.platforms || [])}`,
        `- formats:   ${JSON.stringify(ctx.formats   || [])}`,
        '',
        '## Histórico de performance',
        ctx.historical_data ? JSON.stringify(ctx.historical_data, null, 2) : '(sin histórico cargado)',
        '',
        JSON_REMINDER,
      ].join('\n'),
    },
  ];

  const { parsed } = await runSkill('product_insights_analyzer', userBlocks);

  if (!Array.isArray(parsed.angles) || parsed.angles.length !== 5) {
    throw new Error(`Analyzer devolvió ${parsed.angles?.length ?? 0} ángulos (se esperaban 5)`);
  }
  // Garantizar angle_number secuencial si el modelo lo omite.
  parsed.angles = parsed.angles.map((a, i) => ({ angle_number: a.angle_number ?? i + 1, ...a }));
  return parsed.angles;
}

async function stepOptimizeAngles(ctx, angles) {
  const nudges = await loadNudgesLibrary();
  const userBlocks = [
    {
      type: 'text',
      text: [
        '## Ángulos estratégicos a optimizar',
        JSON.stringify({ angles }, null, 2),
        '',
        '## Target audience y context',
        `- target_audience: ${ctx.target_audience || '(sin target)'}`,
        `- context: ${ctx.context || '(sin contexto)'}`,
        '',
        '## nudges_library (usar exclusivamente estos nudge_id)',
        JSON.stringify(nudges),
        '',
        JSON_REMINDER,
      ].join('\n'),
    },
  ];
  const { parsed } = await runSkill('behavioral_science_optimizer', userBlocks);
  if (!Array.isArray(parsed.optimized_angles)) {
    throw new Error('Optimizer no devolvió `optimized_angles` como array');
  }
  return parsed.optimized_angles;
}

async function stepCreateExecutions(ctx, optimizedAngles) {
  const templates = await loadTemplatesLibrary();
  const userBlocks = [
    {
      type: 'text',
      text: [
        '## Ángulos optimizados (input)',
        JSON.stringify({ optimized_angles: optimizedAngles }, null, 2),
        '',
        '## templates_library',
        JSON.stringify(templates),
        '',
        '## Product meta',
        `- platforms: ${JSON.stringify(ctx.platforms || [])}`,
        `- formats:   ${JSON.stringify(ctx.formats   || [])}`,
        `- target_audience: ${ctx.target_audience || '(sin target)'}`,
        `- key_benefit: ${ctx.key_benefit || '(sin key benefit)'}`,
        '',
        'Mantené el mismo `angle_number` en cada ejecución.',
        JSON_REMINDER,
      ].join('\n'),
    },
  ];
  const { parsed } = await runSkill('ogilvy_creative_execution', userBlocks);
  if (!Array.isArray(parsed.executions)) {
    throw new Error('Ogilvy skill no devolvió `executions` como array');
  }
  return parsed.executions;
}

async function stepScoreExecutions(ctx, executions) {
  const criteria = await loadScoringCriteria();
  const userBlocks = [
    { type: 'image', source: { type: 'url', url: ctx.champion_image_url } },
    {
      type: 'text',
      text: [
        '## Ejecuciones challenger a evaluar',
        JSON.stringify({ executions }, null, 2),
        '',
        '## scoring_criteria (pesos ya suman 1.00)',
        JSON.stringify(criteria),
        '',
        '## Plataformas a predecir',
        JSON.stringify(ctx.platforms || []),
        '',
        '## Target audience',
        ctx.target_audience || '(sin target)',
        '',
        '## Histórico de performance',
        ctx.historical_data ? JSON.stringify(ctx.historical_data, null, 2) : '(sin histórico)',
        '',
        JSON_REMINDER,
      ].join('\n'),
    },
  ];
  const { parsed } = await runSkill('performance_scorer', userBlocks);

  const challenger_scores = parsed.challenger_scores ?? parsed.scores;
  if (!Array.isArray(challenger_scores)) {
    throw new Error('Scorer no devolvió `challenger_scores` como array');
  }
  if (!parsed.champion_score) {
    throw new Error('Scorer no devolvió `champion_score`');
  }
  if (!parsed.winner) {
    throw new Error('Scorer no devolvió `winner`');
  }

  return {
    champion_score: parsed.champion_score,
    challenger_scores,
    winner: parsed.winner,
  };
}

// ---------------- db helpers ----------------

async function loadContext(id) {
  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.status, e.champion_image_url, e.historical_data,
            e.brief_snapshot AS legacy_brief,
            p.brief_text, p.target_audience, p.key_benefit, p.context, p.platforms, p.formats
       FROM experiments e
       JOIN products p ON p.id = e.product_id
      WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [id],
  );
  if (!rows.length) return null;
  const r = rows[0];
  // Compatibilidad: si brief_text está vacío pero existe legacy_brief, usamos ése.
  if (!r.brief_text && r.legacy_brief) r.brief_text = r.legacy_brief;
  return r;
}

async function setStatus(id, status) {
  await pool.query(
    `UPDATE experiments SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, id],
  );
}

async function patchJsonb(id, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const setClauses = keys.map((k, i) => `${k} = $${i + 1}::jsonb`).join(', ');
  const values = keys.map((k) => JSON.stringify(patch[k]));
  values.push(id);
  await pool.query(
    `UPDATE experiments SET ${setClauses}, updated_at = NOW() WHERE id = $${values.length}`,
    values,
  );
}

async function loadNudgesLibrary() {
  const { rows } = await pool.query(
    `SELECT nudge_id, nudge_name, category, subcategory, description,
            best_for, avoid_when, combines_well_with, intensity, ethical_consideration
       FROM behavioral_nudges
      WHERE is_active
      ORDER BY category, nudge_id`,
  );
  return rows;
}

async function loadTemplatesLibrary() {
  const { rows } = await pool.query(
    `SELECT template_key, template_name, structure, best_for
       FROM creative_templates WHERE is_active ORDER BY id`,
  );
  return rows;
}

async function loadScoringCriteria() {
  const { rows } = await pool.query(
    `SELECT criterion_key, criterion_name, weight, description, evaluation_guide
       FROM scoring_criteria WHERE is_active ORDER BY sort_order`,
  );
  return rows;
}

module.exports = { runExperiment };
