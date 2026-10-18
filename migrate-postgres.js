const { Client } = require("pg");
const fs = require("node:fs");
const path = require("node:path");
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running a cloud migration.");
(async () => {
 const client = new Client({connectionString:process.env.DATABASE_URL});
 await client.connect();
 try {
  await client.query("BEGIN");
  await client.query(fs.readFileSync(path.join(__dirname,"schema-postgres.sql"),"utf8"));
  await client.query("COMMIT");
  console.log("Cloud schema is ready. No local records were transferred.");
 } catch(error) { await client.query("ROLLBACK"); throw error; }
 finally { await client.end(); }
})().catch(() => { console.error("Cloud migration failed. Check database access and configuration."); process.exitCode=1; });
