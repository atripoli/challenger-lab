const express = require('express');
const multer = require('multer');

const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadChampionBuffer } = require('../services/uploads');

const router = express.Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) {
      return cb(new Error('Solo se aceptan PNG, JPG o WEBP'));
    }
    cb(null, true);
  },
});

router.post(
  '/champion',
  requireRole('admin', 'analyst'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Falta archivo `image`' });
    const result = await uploadChampionBuffer(req.file.buffer, { filename: req.file.originalname });
    res.status(201).json(result);
  }),
);

module.exports = router;
