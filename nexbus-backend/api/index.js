// Vercel entry point: the whole Express app is served by this one serverless function.
// vercel.json rewrites every path to it, and Express still sees the original URL (/auth/login, /api/trips, ...).
module.exports = require('../app');
