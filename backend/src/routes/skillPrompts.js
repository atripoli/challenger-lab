const express = require('express');
const { z } = require('zod');

const { pool } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { invalidate: invalidatePromptCache } = require('../services/skillPromptLoader');
const { ALLOWED_MODELS } = require('../config/anthropic');

const router = express.Router();
router.use(requireAuth);

const updateSchema = z.object({
  system_prompt: z.string().min(20),
  display_name:  z.string().max(150).optional(),
  description:   z.string().optional().nullable(),
  model:         z.enum(ALLOWED_MODELS).optional(),
  max_tokens:    z.number().int().min(256).max(16384).optional(),
  temperature:   z.number().min(0).max(1).optional(),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT id, skill_name, display_name, description, system_prompt,
              model, max_tokens, temperature,
              user_editable, version, updated_at, updated_by
       FROM skill_prompts
       ORDER BY id ASC`,
    );
    res.json({ skill_prompts: rows });
  }),
);

router.get(
  '/:skillName',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM skill_prompts WHERE skill_name = $1`,
      [req.params.skillName],
    );
    if (!rows.length) return res.status(404).json({ error: 'Skill no encontrado' });
    res.json({ skill_prompt: rows[0] });
  }),
);

router.get(
  '/:skillName/revisions',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT r.version, r.system_prompt, r.model, r.max_tokens, r.temperature,
              r.created_at, u.full_name AS updated_by_name
       FROM skill_prompt_revisions r
       JOIN skill_prompts s ON s.id = r.skill_prompt_id
       LEFT JOIN users u ON u.id = r.updated_by
       WHERE s.skill_name = $1
       ORDER BY r.version DESC`,
      [req.params.skillName],
    );
    res.json({ revisions: rows });
  }),
);

// PUT /api/skill-prompts/:skillName  — solo admin, crea nueva versión
router.put(
  '/:skillName',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: current } = await client.query(
        `SELECT id, version, user_editable, model, max_tokens, temperature
         FROM skill_prompts WHERE skill_name = $1 FOR UPDATE`,
        [req.params.skillName],
      );
      if (!current.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Skill no encontrado' });
      }
      const existing = current[0];
      if (!existing.user_editable) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Este skill no es editable' });
      }

      const newVersion  = existing.version + 1;
      const nextModel   = data.model       ?? existing.model;
      const nextTokens  = data.max_tokens  ?? existing.max_tokens;
      const nextTemp    = data.temperature ?? Number(existing.temperature);

      const { rows } = await client.query(
        `UPDATE skill_prompts
           SET system_prompt = $1,
               display_name  = COALESCE($2, display_name),
               description   = COALESCE($3, description),
               model         = $4,
               max_tokens    = $5,
               temperature   = $6,
               version       = $7,
               updated_at    = NOW(),
               updated_by    = $8
         WHERE id = $9
         RETURNING *`,
        [
          data.system_prompt,
          data.display_name ?? null,
          data.description ?? null,
          nextModel,
          nextTokens,
          nextTemp,
          newVersion,
          req.user.sub,
          existing.id,
        ],
      );

      await client.query(
        `INSERT INTO skill_prompt_revisions
           (skill_prompt_id, version, system_prompt, model, max_tokens, temperature, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [existing.id, newVersion, data.system_prompt, nextModel, nextTokens, nextTemp, req.user.sub],
      );

      await client.query('COMMIT');
      invalidatePromptCache(req.params.skillName);
      res.json({ skill_prompt: rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

module.exports = router;
