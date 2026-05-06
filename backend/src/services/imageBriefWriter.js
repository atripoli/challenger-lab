const { pool } = require('../config/db');
const { runSkill } = require('./skillExecutor');

/**
 * Pricing identical to orchestrator's PRICING — duplicated here on purpose
 * para no crear coupling con orchestrator.js.
 */
const PRICING = {
  'claude-opus-4-6':   { input: 15, output: 75, cache_write: 18.75, cache_read: 1.50 },
  'claude-sonnet-4-6': { input: 3,  output: 15, cache_write: 3.75,  cache_read: 0.30 },
  'claude-haiku-4-5':  { input: 1,  output: 5,  cache_write: 1.25,  cache_read: 0.10 },
};

function calcCostUsd(usage, model) {
  if (!usage) return 0;
  const p = PRICING[model] || PRICING['claude-sonnet-4-6'];
  const M = 1_000_000;
  return (
    (usage.input_tokens || 0)                  * p.input       / M +
    (usage.output_tokens || 0)                 * p.output      / M +
    (usage.cache_creation_input_tokens || 0)   * p.cache_write / M +
    (usage.cache_read_input_tokens || 0)       * p.cache_read  / M
  );
}

/**
 * Genera (o regenera) un brief de imagen para un creative específico.
 * Persiste en creative_image_briefs y registra costo en experiments.usage.
 */
async function generateBrief({ experimentId, angleNumber, platform, format }) {
  // 1. Cargar el experimento + el creative específico
  const { rows } = await pool.query(
    `SELECT e.id, e.executions, e.angles, e.product_id,
            p.target_audience, p.key_benefit
       FROM experiments e
       JOIN products p ON p.id = e.product_id
      WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [experimentId],
  );
  const exp = rows[0];
  if (!exp) throw new Error('Experimento no encontrado');

  const executions = Array.isArray(exp.executions) ? exp.executions : [];
  const execution = executions.find((ex) => ex.angle_number === angleNumber);
  if (!execution) throw new Error(`Ejecución para angle_number ${angleNumber} no encontrada`);

  const creatives = Array.isArray(execution.creatives) ? execution.creatives : [];
  const creative = creatives.find((c) =>
    String(c.platform).toLowerCase() === String(platform).toLowerCase() &&
    String(c.format).toLowerCase()   === String(format).toLowerCase()
  );
  if (!creative) {
    throw new Error(`Creative ${platform}/${format} no encontrado en ejecución #${angleNumber}`);
  }

  const angle = (Array.isArray(exp.angles) ? exp.angles : []).find(
    (a) => a.angle_number === angleNumber,
  );

  // 2. Armar user message
  const userBlocks = [
    {
      type: 'text',
      text: [
        '## creative (input del Ogilvy)',
        JSON.stringify(creative, null, 2),
        '',
        '## big_idea del ángulo',
        execution.big_idea || '(sin big_idea)',
        '',
        '## tone',
        execution.tone || '(sin tone)',
        '',
        '## product_context',
        `- target_audience: ${exp.target_audience || '(sin target)'}`,
        `- key_benefit: ${exp.key_benefit || '(sin key benefit)'}`,
        '',
        'Devolvé exclusivamente un objeto JSON válido con la forma {"image_brief": {...}}.',
      ].join('\n'),
    },
  ];

  // 3. Ejecutar skill
  const { parsed, usage, model, version } = await runSkill('image_brief_writer', userBlocks);
  if (!parsed.image_brief) {
    throw new Error('image_brief_writer no devolvió `image_brief` en el output');
  }
  const cost = calcCostUsd(usage, model);

  // 4. Persistir el brief (UPSERT por unique constraint)
  const { rows: briefRows } = await pool.query(
    `INSERT INTO creative_image_briefs
       (experiment_id, angle_number, platform, format, brief,
        is_edited, generated_by_model, prompt_version, cost_usd)
     VALUES ($1,$2,$3,$4,$5::jsonb, FALSE, $6, $7, $8)
     ON CONFLICT (experiment_id, angle_number, platform, format) DO UPDATE
       SET brief              = EXCLUDED.brief,
           is_edited          = FALSE,
           generated_by_model = EXCLUDED.generated_by_model,
           prompt_version     = EXCLUDED.prompt_version,
           cost_usd           = EXCLUDED.cost_usd,
           generated_at       = NOW(),
           updated_at         = NOW()
     RETURNING *`,
    [
      experimentId,
      angleNumber,
      platform,
      format,
      JSON.stringify(parsed.image_brief),
      model,
      version,
      Number(cost.toFixed(6)),
    ],
  );

  // 5. Registrar uso en experiments.usage para el panel de costo
  if (usage) {
    const entry = {
      skill_name: 'image_brief_writer',
      model,
      input_tokens:                usage.input_tokens                || 0,
      output_tokens:               usage.output_tokens               || 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
      cache_read_input_tokens:     usage.cache_read_input_tokens     || 0,
      cost_usd:                    Number(cost.toFixed(6)),
      ts:                          new Date().toISOString(),
      meta:                        { angle_number: angleNumber, platform, format },
    };
    await pool.query(
      `UPDATE experiments
          SET usage = jsonb_set(
            COALESCE(usage, '{"skills":[]}'::jsonb),
            '{skills}',
            COALESCE(usage->'skills', '[]'::jsonb) || $1::jsonb,
            TRUE
          )
        WHERE id = $2`,
      [JSON.stringify([entry]), experimentId],
    );
  }

  return briefRows[0];
}

async function listBriefs(experimentId) {
  const { rows } = await pool.query(
    `SELECT * FROM creative_image_briefs
      WHERE experiment_id = $1
      ORDER BY angle_number, platform, format`,
    [experimentId],
  );
  return rows;
}

async function updateBrief(briefId, newBrief) {
  const { rows } = await pool.query(
    `UPDATE creative_image_briefs
        SET brief      = $1::jsonb,
            is_edited  = TRUE,
            updated_at = NOW()
      WHERE id = $2
      RETURNING *`,
    [JSON.stringify(newBrief), briefId],
  );
  if (!rows.length) throw new Error('Brief no encontrado');
  return rows[0];
}

module.exports = { generateBrief, listBriefs, updateBrief };
