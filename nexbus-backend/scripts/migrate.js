// Applies every .sql file in migrations/ (in filename order) that hasn't run yet.
// Tracked in schema_migrations so re-running this script is a no-op once the schema is current.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const DIR = path.join(__dirname, '..', 'migrations');

async function migrate() {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at bigint NOT NULL)');
  const { rows } = await pool.query('SELECT id FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.id));

  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
    console.log(`Applying ${file}...`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)', [file, Date.now()]);
      await client.query('COMMIT');
      console.log(`  ✓ ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  console.log('Migrations up to date.');
}

migrate()
  .then(() => pool.end())
  .catch((err) => { console.error(err); process.exit(1); });
