const { pool } = require('../config/db');
const { cloudinary } = require('../config/cloudinary');

// Nombre canónico del modelo "Nano Banana" según ListModels API.
// Otras opciones disponibles: 'gemini-3-pro-image-preview' (Nano Banana Pro)
// y 'gemini-3.1-flash-image-preview' (Nano Banana 2).
const GEMINI_MODEL = 'gemini-2.5-flash-image';
// Pricing: Nano Banana / Gemini 2.5 Flash Image cobra ~$30/1M tokens output.
// Una imagen 1290×1290 standard tokeniza en ~1290 tokens output → ~$0.039.
// Aproximamos plano por imagen para tracking (Gemini puede variar levemente
// según resolución/aspecto, pero la diferencia es despreciable).
const COST_PER_IMAGE_USD = 0.039;

/**
 * Llama directamente a la REST API de Gemini sin SDK para evitar dependencias.
 * Devuelve los bytes de la imagen + el modelo usado.
 */
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada en el backend');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 500)}`);
  }
  const data = await res.json();

  // Buscar la parte que tenga inlineData con MIME image/*
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error('Gemini no devolvió ningún candidate');
  const imagePart = (candidate.content?.parts || []).find(
    (p) => p.inlineData?.mimeType?.startsWith('image/'),
  );
  if (!imagePart) {
    const textPart = (candidate.content?.parts || []).find((p) => p.text)?.text;
    throw new Error(
      `Gemini no devolvió imagen. ${textPart ? 'Texto recibido: ' + textPart.slice(0, 300) : ''}`,
    );
  }

  return {
    bytes: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType,
    model: GEMINI_MODEL,
  };
}

/**
 * Sube los bytes de la imagen a Cloudinary, carpeta /generated/.
 */
async function uploadToCloudinary(buffer, { briefId, platform, format }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'challenger-lab/generated',
        resource_type: 'image',
        public_id: `brief-${briefId}-${platform}-${format}-${Date.now()}`,
        overwrite: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, public_id: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

/**
 * Genera (o regenera) la imagen para un brief específico.
 * Usa el final_nano_banana_prompt del brief, llama a Gemini, sube a Cloudinary,
 * persiste la URL y el costo, y registra la métrica en experiments.usage.
 */
async function generateImageForBrief(briefId) {
  const { rows } = await pool.query(
    `SELECT b.*, e.id AS experiment_id_check
       FROM creative_image_briefs b
       JOIN experiments e ON e.id = b.experiment_id
      WHERE b.id = $1 AND e.deleted_at IS NULL`,
    [briefId],
  );
  const brief = rows[0];
  if (!brief) throw new Error('Brief no encontrado');

  const prompt = brief.brief?.image_brief?.final_nano_banana_prompt;
  if (!prompt) throw new Error('Brief sin final_nano_banana_prompt');

  // Borrar imagen anterior de Cloudinary si existe (para no acumular huérfanas)
  if (brief.image_public_id) {
    try {
      await cloudinary.uploader.destroy(brief.image_public_id);
    } catch (e) {
      console.warn('[imageGenerator] no se pudo destruir imagen anterior', e.message);
    }
  }

  // Llamar a Gemini
  const { bytes, model } = await callGemini(prompt);

  // Subir a Cloudinary
  const uploaded = await uploadToCloudinary(bytes, {
    briefId,
    platform: brief.platform,
    format: brief.format,
  });

  // Persistir
  const { rows: updated } = await pool.query(
    `UPDATE creative_image_briefs
        SET image_url          = $1,
            image_public_id    = $2,
            image_model        = $3,
            image_prompt_used  = $4,
            image_cost_usd     = $5,
            image_generated_at = NOW(),
            updated_at         = NOW()
      WHERE id = $6
      RETURNING *`,
    [uploaded.url, uploaded.public_id, model, prompt, COST_PER_IMAGE_USD, briefId],
  );

  // Registrar uso en experiments.usage para que aparezca en el panel de costo
  const usageEntry = {
    skill_name: 'image_generation',
    model,
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    cost_usd: COST_PER_IMAGE_USD,
    ts: new Date().toISOString(),
    meta: {
      brief_id: briefId,
      angle_number: brief.angle_number,
      platform: brief.platform,
      format: brief.format,
    },
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
    [JSON.stringify([usageEntry]), brief.experiment_id],
  );

  return updated[0];
}

module.exports = { generateImageForBrief, COST_PER_IMAGE_USD };
