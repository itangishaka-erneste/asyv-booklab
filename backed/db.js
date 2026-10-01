require("dotenv").config();

const { Pool, types } = require("pg");

types.setTypeParser(1082, value => value);
types.setTypeParser(20, value => parseInt(value, 10));
types.setTypeParser(1700, value => parseFloat(value));

const required = [
  "DB_USER",
  "DB_HOST",
  "DB_NAME",
  "DB_PASSWORD"
];

const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.warn(
    "Missing in backend/.env: " + missing.join(", ")
  );
}

const useSSL = process.env.DB_SSL === "true";

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
  ssl: useSSL
    ? {
        rejectUnauthorized: false
      }
    : false
});

pool.on("connect", () => {
  console.log("PostgreSQL connected");
});

pool.on("error", error => {
  console.error("PostgreSQL pool error:", error.message);
});

const query = (text, params) => {
  return pool.query(text, params).then(result => result.rows);
};

const one = (text, params) => {
  return query(text, params).then(rows => rows[0]);
};

const tx = async fn => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await fn((text, params) => {
      return client.query(text, params).then(result => result.rows);
    });

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  one,
  tx
};
