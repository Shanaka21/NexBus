const dns = require('dns');
const net = require('net');
require('dotenv').config();
const { Pool } = require('pg');

// This machine advertises a non-functional IPv6 route. Node's "Happy Eyeballs" autoSelectFamily races
// IPv4/IPv6 sockets concurrently, which hangs entirely when the IPv6 attempts dangle; disabling it and
// forcing IPv4 first makes pg connect directly over IPv4 instead of timing out.
dns.setDefaultResultOrder('ipv4first');
if (net.setDefaultAutoSelectFamily) net.setDefaultAutoSelectFamily(false);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it to your .env file (Neon Postgres connection string).');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Runs fn with a single client inside BEGIN/COMMIT (ROLLBACK on error). Mirrors the shape of the old
// db.runTransaction(async (tx) => ...) calls so service code changes stay mechanical: fn receives a
// client with the same .query(text, params) interface the pool itself exposes.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
