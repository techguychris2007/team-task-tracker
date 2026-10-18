// Cloud queries use a private schema; credentials stay on the server.
const { Pool } = require("pg");
module.exports = function createStore(schema, tables) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 10000, idleTimeoutMillis: 20000 });
  function sql(source) {
    let index = 0;
    let query = source.replace(/\?/g, () => `$${++index}`);
    for (const table of tables) query = query.replace(new RegExp(`\\b${table}\\b`, "g"), `"${schema}"."${table}"`);
    // PostgreSQL folds unquoted aliases; retain the browser's existing API names.
    query = query.replace(/AS (amountCents|payerId|createdAt)\b/g, 'AS "$1"');
    return query;
  }
  function statement(source, client = pool) {
    const query = sql(source);
    return {
      async all(...values) { return (await client.query(query, values)).rows; },
      async get(...values) { return (await client.query(query, values)).rows[0]; },
      async run(...values) {
        const result = await client.query(/^\s*INSERT\b/i.test(query) ? query + " RETURNING *" : query, values);
        return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
      }
    };
  }
  return {
    prepare: source => statement(source),
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
        const result = await work({ prepare: source => statement(source, client) });
        await client.query("COMMIT");
        return result;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end()
  };
};
