const rateLimit = require('express-rate-limit');

const skip = () => process.env.NODE_ENV === 'test';
const handler = (req, res) => res.status(429).json({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' });

const make = (limit) => rateLimit({ windowMs: 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, skip, handler });

// general limit for every request; stricter limit for sign-in, registration, booking and checkout
// chat: the assistant calls a paid-per-use language model, so it gets its own, more generous bucket than strict
module.exports = { general: make(300), strict: make(20), chat: make(30) };
