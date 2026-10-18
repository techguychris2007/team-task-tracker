if (process.env.DATABASE_URL) {
  module.exports = require("./database-postgres");
} else {
  if (process.env.VERCEL) throw new Error("DATABASE_URL is required on Vercel for durable storage.");
  module.exports = require("./database-sqlite");
}
