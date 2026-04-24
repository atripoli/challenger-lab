const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta token de autenticación' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (_err) {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
