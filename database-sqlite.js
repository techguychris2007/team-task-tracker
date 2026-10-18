const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");
const fs = require("node:fs");

const databasePath = path.resolve(
  process.env.DATABASE_PATH ||
  path.join(__dirname, "tasks.db")
);

fs.mkdirSync(path.dirname(databasePath), {
  recursive: true
});

const db = new DatabaseSync(databasePath);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    assignee TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo'
      CHECK (status IN ('todo', 'in_progress', 'done')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const insertTask = db.prepare(`
  INSERT INTO tasks (title, description, assignee, status)
  VALUES (?, ?, ?, ?)
`);

const listTasks = db.prepare(`
  SELECT *
  FROM tasks
  ORDER BY id DESC
`);

const findTask = db.prepare(`
  SELECT *
  FROM tasks
  WHERE id = ?
`);

module.exports = {
  db,
  insertTask,
  listTasks,
  findTask
};