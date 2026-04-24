const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Modelos permitidos — coincide con el CHECK constraint de skill_prompts.model.
const ALLOWED_MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'];

module.exports = { anthropic: client, ALLOWED_MODELS };
