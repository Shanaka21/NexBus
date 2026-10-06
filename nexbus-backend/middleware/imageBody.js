const express = require('express');

// Image uploads travel as base64 JSON (about 4/3 of the file size), so they need a larger limit than other routes.
// app.js skips its 50 kb parser for these paths; this one runs after sign-in and the upload rate limit.
module.exports = express.json({ limit: '8mb' });
