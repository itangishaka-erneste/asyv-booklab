// db.js: connects to PostgreSQL. The tables come from database.sql (run it once in Postgres).
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const query = (text, params) => pool.query(text, params).then(r => r.rows);
const one = (text, params) => query(text, params).then(rows => rows[0]);
const tx = async fn => { // run several queries as one all-or-nothing step
  const c = await pool.connect();
  try { await c.query('BEGIN'); const out = await fn((t, p) => c.query(t, p).then(r => r.rows)); await c.query('COMMIT'); return out; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
};

module.exports = { pool, query, one, tx };