const { pool } = require('../config/db');

const cache = new Map();
const TTL_MS = 60_000;

async function getSkillPrompt(skillName) {
  const cached = cache.get(skillName);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.data;

  const { rows } = await pool.query(
    `SELECT skill_name, display_name, system_prompt, model, max_tokens, temperature, version
     FROM skill_prompts WHERE skill_name = $1`,
    [skillName],
  );
  if (!rows.length) throw new Error(`Skill prompt "${skillName}" no existe en DB`);

  cache.set(skillName, { fetchedAt: Date.now(), data: rows[0] });
  return rows[0];
}

function invalidate(skillName) {
  if (skillName) cache.delete(skillName);
  else cache.clear();
}

module.exports = { getSkillPrompt, invalidate };
