const { AppError } = require('../utils/errors');

// validate(schema, 'body' | 'query' | 'params'); the cleaned value is placed on req.valid[source]
module.exports = (schema, source = 'body') => (req, res, next) => {
  const { value, error } = schema.validate(req[source], { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    throw new AppError(400, 'VALIDATION_ERROR', error.details.map(d => d.message).join('; '),
      error.details.map(d => ({ field: d.path.join('.'), message: d.message })));
  }
  req.valid = req.valid || {};
  req.valid[source] = value;
  next();
};
