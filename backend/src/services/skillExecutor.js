const { jsonrepair } = require('jsonrepair');
const { anthropic } = require('../config/anthropic');
const { getSkillPrompt } = require('./skillPromptLoader');

/**
 * Ejecuta un skill: carga system prompt + modelo + hiperparámetros desde DB,
 * llama a Claude con prompt caching y devuelve el JSON parseado.
 *
 * Los overrides (model/max_tokens/temperature en opts) solo deben usarse en
 * testing. El flujo normal respeta la configuración editable de la DB.
 *
 * @returns {Promise<{parsed, raw, usage, model, version}>}
 */
async function runSkill(skillName, userContent, opts = {}) {
  const conf = await getSkillPrompt(skillName);

  const model       = opts.model       ?? conf.model;
  const max_tokens  = opts.max_tokens  ?? conf.max_tokens;
  const temperature = opts.temperature ?? Number(conf.temperature);
  const extraSystem = opts.extraSystem;

  const systemBlocks = [
    { type: 'text', text: conf.system_prompt, cache_control: { type: 'ephemeral' } },
  ];
  // Bloques estáticos grandes (librerías) cacheados con prefix caching de
  // Anthropic. Como van DESPUÉS del system prompt (que también es estático),
  // todo el prefijo queda cacheado y la 2da corrida en adelante paga 10% del
  // costo de tokens cacheados y se procesa mucho más rápido.
  if (Array.isArray(opts.cachedSystemBlocks)) {
    for (const block of opts.cachedSystemBlocks) {
      if (block && String(block).trim()) {
        systemBlocks.push({ type: 'text', text: String(block), cache_control: { type: 'ephemeral' } });
      }
    }
  }
  if (extraSystem) systemBlocks.push({ type: 'text', text: extraSystem });

  const userContentBlocks = Array.isArray(userContent)
    ? userContent
    : [{ type: 'text', text: String(userContent) }];

  const response = await anthropic.messages.create({
    model,
    max_tokens,
    temperature,
    system: systemBlocks,
    messages: [{ role: 'user', content: userContentBlocks }],
  });

  const raw = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return {
    parsed: extractJson(raw),
    raw,
    usage: response.usage,
    model,
    version: conf.version,
  };
}

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced
    ? fenced[1]
    : (() => {
        const a = text.indexOf('{');
        const b = text.lastIndexOf('}');
        if (a === -1 || b === -1 || b <= a) return null;
        return text.slice(a, b + 1);
      })();

  if (!candidate) throw new Error('Respuesta del skill no contiene JSON parseable');

  try {
    return JSON.parse(candidate);
  } catch (strictErr) {
    try {
      const repaired = jsonrepair(candidate);
      return JSON.parse(repaired);
    } catch (_repairErr) {
      throw new Error(`JSON inválido en respuesta del skill: ${strictErr.message}`);
    }
  }
}

module.exports = { runSkill };
