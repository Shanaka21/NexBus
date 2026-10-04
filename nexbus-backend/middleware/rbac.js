const audit = require('../services/audit.service');
const { AppError } = require('../utils/errors');

module.exports = (...allowed) => async (req, res, next) => {
  if (req.user && allowed.includes(req.user.role)) return next();
  await audit.log({
    userId: req.user?.uid, action: 'ACCESS_DENIED', entity: req.originalUrl, severity: 'security',
    details: { role: req.user?.role, method: req.method }
  });
  throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do this');
};
