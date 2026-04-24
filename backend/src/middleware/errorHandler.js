module.exports = function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json({
    error: err.publicMessage || err.message || 'Internal server error',
    ...(isProd ? {} : { stack: err.stack }),
  });
};
