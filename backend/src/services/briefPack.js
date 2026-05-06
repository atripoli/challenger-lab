const archiver = require('archiver');
const { pool } = require('../config/db');

/**
 * Busca dentro de experiments.executions el creative que coincida con
 * (angle_number, platform, format) del brief. Devuelve null si no matchea.
 */
function findCreative(executions, { angleNumber, platform, format }) {
  if (!Array.isArray(executions)) return null;
  const platLow = (platform || '').toLowerCase();
  const fmtLow = (format || '').toLowerCase();
  const angle = executions.find((a) => Number(a?.angle_number) === Number(angleNumber));
  if (!angle || !Array.isArray(angle.creatives)) {
    // fallback: si no encontramos por angle_number, buscamos por (platform, format)
    // en cualquier angle (cubre datos con angle_number desincronizado).
    for (const a of executions) {
      const c = (a?.creatives || []).find(
        (cr) =>
          (cr?.platform || '').toLowerCase() === platLow &&
          (cr?.format || '').toLowerCase() === fmtLow,
      );
      if (c) return { creative: c, angle: a };
    }
    return null;
  }
  const creative = angle.creatives.find(
    (c) =>
      (c?.platform || '').toLowerCase() === platLow &&
      (c?.format || '').toLowerCase() === fmtLow,
  );
  return creative ? { creative, angle } : { creative: null, angle };
}

/**
 * Compone el copy.txt listo para entregar a un media buyer / Ads Manager.
 * Formato plano, secciones tituladas, fácil de copiar-pegar campo por campo.
 */
function buildCopyTxt({ experiment, brief, creative, angle }) {
  const c = creative || {};
  const overlay = c.overlay_text || {};
  const lines = [];

  lines.push(`# ${experiment?.name || 'Experimento'} — ${brief.platform} / ${brief.format}`);
  lines.push(`# angle ${brief.angle_number}${angle?.big_idea ? ' · ' + angle.big_idea : ''}`);
  lines.push(`# Generado: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('========== POST COPY (texto del posteo) ==========');
  lines.push(c.post_copy || '(sin post copy)');
  lines.push('');
  lines.push('========== HEADLINE (titular) ==========');
  lines.push(c.headline || '(sin headline)');
  lines.push('');
  lines.push('========== DESCRIPTION (descripción del link) ==========');
  lines.push(c.description || '(sin description)');
  lines.push('');
  lines.push('========== CTA ==========');
  lines.push(`Botón:   ${c.cta_button || '(sin texto de botón)'}`);
  if (c.system_cta_type) lines.push(`Tipo:    ${c.system_cta_type}`);
  lines.push('');
  lines.push('========== OVERLAY TEXT (renderizado en la imagen) ==========');
  lines.push(`Primario:   ${overlay.primary || '(—)'}`);
  lines.push(`Secundario: ${overlay.secondary || '(—)'}`);
  lines.push('');
  if (Array.isArray(angle?.hashtags) && angle.hashtags.length) {
    lines.push('========== HASHTAGS ==========');
    lines.push(angle.hashtags.join(' '));
    lines.push('');
  }
  lines.push('========== METADATA ==========');
  lines.push(`Plataforma:    ${brief.platform}`);
  lines.push(`Formato:       ${brief.format}`);
  lines.push(`Aspect ratio:  ${c.aspect_ratio || brief.brief?.aspect_ratio || '(—)'}`);
  if (brief.image_model) lines.push(`Modelo imagen: ${brief.image_model}`);
  if (brief.image_generated_at) {
    lines.push(`Imagen gen:    ${new Date(brief.image_generated_at).toISOString()}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Stream del pack ZIP (image.png + copy.txt) directo al response del cliente.
 * No persiste nada — se compone on-the-fly desde la imagen de Cloudinary y
 * el creative actual (refleja últimas ediciones del copy).
 */
async function streamPack(briefId, res) {
  const { rows } = await pool.query(
    `SELECT b.*, e.name AS experiment_name, e.executions
       FROM creative_image_briefs b
       JOIN experiments e ON e.id = b.experiment_id
      WHERE b.id = $1 AND e.deleted_at IS NULL`,
    [briefId],
  );
  const brief = rows[0];
  if (!brief) {
    res.status(404).json({ error: 'Brief no encontrado' });
    return;
  }
  if (!brief.image_url) {
    res.status(400).json({ error: 'Este brief todavía no tiene imagen generada' });
    return;
  }

  const match = findCreative(brief.executions, {
    angleNumber: brief.angle_number,
    platform: brief.platform,
    format: brief.format,
  });
  const creative = match?.creative || null;
  const angle = match?.angle || null;

  // Bajar la imagen de Cloudinary
  const imgRes = await fetch(brief.image_url);
  if (!imgRes.ok) {
    res.status(502).json({ error: `No se pudo bajar la imagen: HTTP ${imgRes.status}` });
    return;
  }
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

  const copyTxt = buildCopyTxt({
    experiment: { name: brief.experiment_name },
    brief,
    creative,
    angle,
  });

  // Filename: brief-{id}-{platform}-{format}.zip
  const safeName = `brief-${brief.id}-${brief.platform}-${brief.format}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);

  const zip = archiver('zip', { zlib: { level: 6 } });
  zip.on('error', (err) => {
    console.error('[briefPack] zip error', err);
    try { res.status(500).end(); } catch (_) {}
  });
  zip.pipe(res);
  zip.append(imgBuffer, { name: 'imagen.png' });
  zip.append(copyTxt, { name: 'copy.txt' });
  await zip.finalize();
}

module.exports = { streamPack, findCreative, buildCopyTxt };
