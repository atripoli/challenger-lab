const express = require('express');
const { z } = require('zod');

const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateBrief, listBriefs, updateBrief } = require('../services/imageBriefWriter');
const { generateImageForBrief, COST_PER_IMAGE_USD } = require('../services/imageGenerator');
const { streamPack } = require('../services/briefPack');

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

// GET /api/experiments/:experimentId/briefs — listar briefs ya generados.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const briefs = await listBriefs(Number(req.params.experimentId));
    res.json({ briefs });
  }),
);

const generateSchema = z.object({
  angle_number: z.number().int().positive(),
  platform:     z.string().min(1).max(40),
  format:       z.string().min(1).max(40),
});

// POST /api/experiments/:experimentId/briefs — genera (o regenera) un brief.
router.post(
  '/',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const data = generateSchema.parse(req.body);
    try {
      const brief = await generateBrief({
        experimentId: Number(req.params.experimentId),
        angleNumber:  data.angle_number,
        platform:     data.platform,
        format:       data.format,
      });
      res.status(201).json({ brief });
    } catch (err) {
      const status = /no encontrado/i.test(err.message) ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  }),
);

const updateSchema = z.object({
  brief: z.record(z.any()),
});

// PUT /api/experiments/:experimentId/briefs/:briefId — guardar edición humana.
router.put(
  '/:briefId',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    try {
      const brief = await updateBrief(Number(req.params.briefId), data.brief);
      res.json({ brief });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }),
);

// POST /api/experiments/:experimentId/briefs/:briefId/image — genera (o
// regenera) la imagen del brief con Nano Banana. Costo fijo aprox $0.04.
router.post(
  '/:briefId/image',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    try {
      const brief = await generateImageForBrief(Number(req.params.briefId));
      res.status(201).json({ brief, cost_usd: COST_PER_IMAGE_USD });
    } catch (err) {
      const status = /no encontrado/i.test(err.message) ? 404
        : /GEMINI_API_KEY/.test(err.message)         ? 503
        : 500;
      res.status(status).json({ error: err.message });
    }
  }),
);

// GET /api/experiments/:experimentId/briefs/:briefId/pack — descarga ZIP con
// la imagen generada + copy.txt (post copy, headline, description, CTA,
// overlay, hashtags) listo para entregar al media buyer.
router.get(
  '/:briefId/pack',
  asyncHandler(async (req, res) => {
    try {
      await streamPack(Number(req.params.briefId), res);
    } catch (err) {
      // Si ya empezamos a stremear, no podemos cambiar el status. Cerramos y log.
      if (res.headersSent) {
        console.error('[briefs/pack] error mid-stream', err);
        try { res.end(); } catch (_) {}
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  }),
);

module.exports = router;
