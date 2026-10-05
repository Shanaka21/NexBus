// Netlify entry point: wraps the Express app so every request is served by one serverless function.
// netlify.toml rewrites all paths to this function; basePath removes the function prefix again.
const serverless = require('serverless-http');
const app = require('../../app');

module.exports.handler = serverless(app, { basePath: '/.netlify/functions/api' });
