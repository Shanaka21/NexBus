const { pool } = require('../config/db');

// Audit logging must never break the request that triggered it.
async function log({ userId = null, action, entity = null, entityId = null, details = null, severity = 'info' }) {
  try {
    await pool.query(
      'INSERT INTO system_logs (user_id, action, entity, entity_id, details, severity, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [userId, action, entity, entityId, details != null ? JSON.stringify(details) : null, severity, Date.now()]
    );
  } catch (err) {
    console.error('audit log failed:', err.message);
  }
}

module.exports = { log };
