const { AppError } = require('../utils/errors');

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (err instanceof AppError) {
    // `error` stays human readable for older clients; `code` is the machine-readable value
    return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body', code: 'VALIDATION_ERROR' });
  }
  console.error(err.stack || err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
};
