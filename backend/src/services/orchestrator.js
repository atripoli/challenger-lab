const { pool } = require('../config/db');
const { runSkill } = require('./skillExecutor');

const JSON_REMINDER = 'Devolvé exclusivamente un objeto JSON válido, sin prosa adicional ni bloques markdown.';

/**
 * Paso 1: corre el Analyzer (skill 1) y deja el experimento en `awaiting_review`.
 * El usuario revisa/edita ángulos y selecciona N (1-5) para continuar.
 */
async function runAnalyzer(experimentId) {
  const ctx = await loadContext(experimentId);
  if (!ctx) throw new Error(`Experimento ${experimentId} no encontrado`);
  if (!ctx.champion_image_url) throw new Error('Falta imagen Champion para ejecutar el Analyzer');

  try {
    await setStatus(experimentId, 'analyzing');

    // Modo iteración Champion & Challenger: si hay parent, copiamos sus
    // ángulos (saltea skill 1 — los ángulos estratégicos no cambian entre
    // iteraciones del mismo brief).
    let angles;
    if (ctx.parent_experiment_id) {
      const inherited = await loadParentAngles(ctx.parent_experiment_id);
      if (!inherited.length) {
        throw new Error(`Experimento padre #${ctx.parent_experiment_id} no tiene ángulos para heredar`);
      }
      angles = inherited;
    } else {
      angles = await stepAnalyzeAngles(ctx);
    }

    await pool.query(
      `UPDATE experiments
          SET angles                 = $1::jsonb,
              optimized_angles       = NULL,
              executions             = NULL,
              scores                 = NULL,
              champion_score         = NULL,
              winner_id              = NULL,
              winner_payload         = NULL,
              uplift_vs_champion     = NULL,
              selected_angle_numbers = NULL,
              status                 = 'awaiting_review',
              error_message          = NULL,
              updated_at             = NOW()
        WHERE id = $2`,
      [JSON.stringify(angles), experimentId],
    );

    return { status: 'awaiting_review', angles, inherited: !!ctx.parent_experiment_id };
  } catch (err) {
    console.error(`[orchestrator/analyzer] experimento ${experimentId} falló:`, err);
    await pool.query(
      `UPDATE experiments SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [err.message?.slice(0, 2000) || 'Error desconocido', experimentId],
    );
    throw err;
  }
}

/**
 * Paso 2: corre Optimizer + Ogilvy + Scorer sobre los angle_numbers seleccionados.
 */
async function continueExperiment(experimentId, selectedAngleNumbers) {
  const ctx = await loadContext(experimentId);
  if (!ctx) throw new Error(`Experimento ${experimentId} no encontrado`);
  if (ctx.status !== 'awaiting_review') {
    throw new Error(`Experimento no está en awaiting_review (status=${ctx.status})`);
  }

  const allAngles = Array.isArray(ctx.angles) ? ctx.angles : [];
  const validNumbers = new Set(allAngles.map((a) => Number(a.angle_number)));
  const requested = (selectedAngleNumbers || []).map(Number);
  if (!requested.length) throw new Error('Hay que seleccionar al menos un ángulo');
  if (requested.length > 5) throw new Error('Máximo 5 ángulos seleccionados');
  if (requested.some((n) => !validNumbers.has(n))) {
    throw new Error('Selección incluye un angle_number inexistente');
  }

  const selected = allAngles.filter((a) => requested.includes(Number(a.angle_number)));

  await pool.query(
    `UPDATE experiments
        SET selected_angle_numbers = $1::jsonb,
            error_message          = NULL,
            updated_at             = NOW()
      WHERE id = $2`,
    [JSON.stringify(requested), experimentId],
  );

  try {
    // ---------- Skill 2 ----------
    await setStatus(experimentId, 'optimizing');
    const optimized = await stepOptimizeAngles(ctx, selected);
    await patchJsonb(experimentId, { optimized_angles: optimized });

    // ---------- Skill 3 ----------
    await setStatus(experimentId, 'executing');
    const executions = await stepCreateExecutions(ctx, optimized);
    await patchJsonb(experimentId, { executions });

    // ---------- Skill 4 ----------
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
    console.error(`[orchestrator/continue] experimento ${experimentId} falló:`, err);
    await pool.query(
      `UPDATE experiments SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [err.message?.slice(0, 2000) || 'Error desconocido', experimentId],
    );
    throw err;
  }
}

/**
 * Reemplaza el array de ángulos. Solo permitido en `awaiting_review`.
 * No corre ningún skill — sólo persiste edits humanos.
 */
async function patchAngles(experimentId, newAngles) {
  if (!Array.isArray(newAngles)) throw new Error('angles debe ser un array');
  const ctx = await loadContext(experimentId);
  if (!ctx) throw new Error('Experimento no encontrado');
  if (ctx.status !== 'awaiting_review') {
    throw new Error(`Solo se pueden editar ángulos en awaiting_review (status=${ctx.status})`);
  }
  const { rows } = await pool.query(
    `UPDATE experiments SET angles = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING angles`,
    [JSON.stringify(newAngles), experimentId],
  );
  return rows[0]?.angles ?? [];
}

// ============== pasos ==============

async function stepAnalyzeAngles(ctx) {
  const previousAngles = await loadPreviousAngles(ctx.product_id, ctx.id);

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
        '## previously_explored_angles',
        previousAngles.length > 0
          ? `Ya se generaron ${previousAngles.length} ángulos en experimentos anteriores de este producto. NO los recicles ni con paráfrasis. Buscá insights frescos.\n${JSON.stringify(previousAngles, null, 2)}`
          : '(sin ángulos previos — primer experimento sobre este producto)',
        '',
        JSON_REMINDER,
      ].join('\n'),
    },
  ];

  const { parsed } = await runSkill('product_insights_analyzer', userBlocks);

  if (!Array.isArray(parsed.angles) || parsed.angles.length !== 5) {
    throw new Error(`Analyzer devolvió ${parsed.angles?.length ?? 0} ángulos (se esperaban 5)`);
  }
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
  const channels = ctx.channels || [];
  if (channels.length === 0) {
    throw new Error('El experimento no tiene canales (channels) seleccionados');
  }

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
        '## channels (CANALES SELECCIONADOS — generar EXACTAMENTE uno por entrada)',
        JSON.stringify(channels),
        '',
        '## Product meta',
        `- target_audience: ${ctx.target_audience || '(sin target)'}`,
        `- key_benefit: ${ctx.key_benefit || '(sin key benefit)'}`,
        '',
        `IMPORTANTE: cada ejecución debe tener creatives.length === ${channels.length}, y cada creative.platform + creative.format debe matchear EXACTAMENTE con un canal del input. Mantené el mismo angle_number.`,
        JSON_REMINDER,
      ].join('\n'),
    },
  ];
  const { parsed } = await runSkill('ogilvy_creative_execution', userBlocks);
  if (!Array.isArray(parsed.executions)) {
    throw new Error('Ogilvy skill no devolvió `executions` como array');
  }

  // Validación: cada ejecución debe tener creatives matching los canales pedidos.
  const expectedKeys = new Set(channels.map((c) => `${c.platform}|${c.format}`));
  for (const ex of parsed.executions) {
    if (!Array.isArray(ex.creatives)) {
      throw new Error(`Ogilvy: ejecución #${ex.angle_number} sin array creatives`);
    }
    if (ex.creatives.length !== channels.length) {
      throw new Error(
        `Ogilvy: ejecución #${ex.angle_number} devolvió ${ex.creatives.length} creatives, se esperaban ${channels.length}`,
      );
    }
    const gotKeys = new Set(ex.creatives.map((c) => `${c.platform}|${c.format}`));
    for (const key of expectedKeys) {
      if (!gotKeys.has(key)) {
        throw new Error(`Ogilvy: ejecución #${ex.angle_number} no tiene creative para ${key}`);
      }
    }
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
  if (!parsed.champion_score) throw new Error('Scorer no devolvió `champion_score`');
  if (!parsed.winner) throw new Error('Scorer no devolvió `winner`');

  return {
    champion_score: parsed.champion_score,
    challenger_scores,
    winner: parsed.winner,
  };
}

// ============== db helpers ==============

async function loadContext(id) {
  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.status, e.champion_image_url, e.historical_data,
            e.brief_snapshot AS legacy_brief, e.angles, e.selected_angle_numbers,
            e.product_id, e.channels, e.parent_experiment_id,
            e.platforms AS exp_platforms, e.formats AS exp_formats,
            p.brief_text, p.target_audience, p.key_benefit, p.context,
            p.platforms AS product_platforms, p.formats AS product_formats
       FROM experiments e
       JOIN products p ON p.id = e.product_id
      WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [id],
  );
  if (!rows.length) return null;
  const r = rows[0];
  if (!r.brief_text && r.legacy_brief) r.brief_text = r.legacy_brief;

  // channels es la fuente de verdad. Si está vacío, derivamos cross-product
  // de platforms × formats (legacy backfill).
  if (!Array.isArray(r.channels) || r.channels.length === 0) {
    const platforms = (Array.isArray(r.exp_platforms) && r.exp_platforms.length > 0)
      ? r.exp_platforms : (r.product_platforms || []);
    const formats = (Array.isArray(r.exp_formats) && r.exp_formats.length > 0)
      ? r.exp_formats : (r.product_formats || []);
    r.channels = [];
    for (const p of platforms) for (const f of formats) r.channels.push({ platform: p, format: f });
  }
  // platforms/formats expuestos para retro-compat con prompts viejos (no usado en v7).
  r.platforms = Array.from(new Set((r.channels || []).map((c) => c.platform)));
  r.formats   = Array.from(new Set((r.channels || []).map((c) => c.format)));

  // Carga el histórico de campañas previas del producto.
  // Combina con el legacy `historical_data` del experimento (para experimentos
  // viejos creados antes de la tabla product_history).
  const { rows: histRows } = await pool.query(
    `SELECT campaign_name, period_start, period_end, platform,
            impressions, clicks, ctr, conversions, conversion_rate,
            cpc, cpa, budget_spent, currency, notes
       FROM product_history
      WHERE product_id = $1
      ORDER BY COALESCE(period_start, recorded_at::date) DESC
      LIMIT 50`,
    [r.product_id],
  );
  const productHist = histRows.length ? histRows : null;
  const legacyHist = r.historical_data;

  if (productHist && legacyHist) {
    r.historical_data = { product_history: productHist, experiment_legacy: legacyHist };
  } else if (productHist) {
    r.historical_data = { product_history: productHist };
  }
  // Si solo hay legacy, queda como estaba.

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

/**
 * Carga los ángulos generados en experimentos previos del MISMO producto,
 * excluyendo el experimento actual y los que fallaron. Devuelve un array
 * compacto con sólo los campos relevantes para evitar repetición.
 */
/**
 * Trae los ángulos del experimento padre, normalizando los `angle_number`
 * para que sean secuenciales 1..5 (idempotente si ya lo eran).
 */
async function loadParentAngles(parentExperimentId) {
  const { rows } = await pool.query(
    `SELECT angles FROM experiments WHERE id = $1 AND deleted_at IS NULL`,
    [parentExperimentId],
  );
  const angles = rows[0]?.angles;
  if (!Array.isArray(angles)) return [];
  return angles.map((a, i) => ({ ...a, angle_number: a.angle_number ?? i + 1 }));
}

async function loadPreviousAngles(productId, currentExperimentId, limit = 30) {
  const { rows } = await pool.query(
    `SELECT angle->>'angle_name' AS angle_name,
            angle->>'category'   AS category,
            angle->>'insight'    AS insight,
            angle->>'benefit'    AS benefit
       FROM experiments e,
            jsonb_array_elements(e.angles) angle
      WHERE e.product_id = $1
        AND e.id != $2
        AND e.deleted_at IS NULL
        AND e.angles IS NOT NULL
        AND e.status != 'failed'
      ORDER BY e.created_at DESC
      LIMIT $3`,
    [productId, currentExperimentId, limit],
  );
  // Deduplicar por nombre normalizado (case-insensitive, sin espacios extra)
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = (r.angle_name || '').toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push({
        angle_name: r.angle_name,
        category:   r.category,
        insight:    r.insight,
        benefit:    r.benefit,
      });
    }
  }
  return out;
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

module.exports = {
  runAnalyzer,
  continueExperiment,
  patchAngles,
  // alias para retro-compat: el endpoint /run ahora corre solo el analyzer
  runExperiment: runAnalyzer,
};
