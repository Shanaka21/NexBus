const { db, FieldValue } = require('../config/firebase');

// Audit logging must never break the request that triggered it.
async function log({ userId = null, action, entity = null, entityId = null, details = null, severity = 'info' }) {
  try {
    await db.collection('system_logs').add({
      user_id: userId,
      action,
      entity,
      entity_id: entityId,
      details,
      severity,
      created_at: Date.now(),
      created_ts: FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error('audit log failed:', err.message);
  }
}

module.exports = { log };
