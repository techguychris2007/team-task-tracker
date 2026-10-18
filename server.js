const express = require("express");
const path = require("node:path");
const {
  db,
  insertTask,
  listTasks,
  findTask
} = require("./database");

const app = express();
const PORT = Number(process.env.PORT || 3002);
const crypto = require("node:crypto");
const teamToken = process.env.TEAM_TOKEN;
if (!teamToken || teamToken.length < 32) throw new Error("Set TEAM_TOKEN to a random key of at least 32 characters.");
app.disable("x-powered-by");

app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", async function (req, res) {
  res.json({
    message: "Team Task Tracker server is running!"
  });
});

// Protect every task read and write, not just the page controls.
app.use("/api/tasks", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  const supplied = (req.get("Authorization") || "").replace(/^Bearer /, "");
  const hash = value => crypto.createHash("sha256").update(value).digest();
  if (!crypto.timingSafeEqual(hash(supplied), hash(teamToken))) {
    return res.status(401).json({ message: "A valid team key is required." });
  }
  next();
});

// Return saved tasks.
app.get("/api/tasks", async function (req, res) {
  res.set("Cache-Control", "no-store");

  res.json({
    tasks: await listTasks.all()
  });
});

// Validate and save a new task.
app.post("/api/tasks", async function (req, res) {
  const { title, description, assignee, status } = req.body ?? {};

  const fields = [title, description, assignee, status];

  if (fields.some(value => typeof value !== "string")) {
    return res.status(400).json({
      message: "All task fields must contain text."
    });
  }

  const task = {
    title: title.trim(),
    description: description.trim(),
    assignee: assignee.trim(),
    status: status.trim()
  };

  if (!task.title || !task.assignee) {
    return res.status(400).json({
      message: "Please enter a task title and an assignee."
    });
  }

  if (
    task.title.length > 100 ||
    task.assignee.length > 100 ||
    task.description.length > 2000
  ) {
    return res.status(400).json({
      message: "Title and assignee allow 100 characters; description allows 2,000."
    });
  }

  if (!["todo", "in_progress", "done"].includes(task.status)) {
    return res.status(400).json({
      message: "Please choose a valid status."
    });
  }

  const result = await insertTask.run(
    task.title,
    task.description,
    task.assignee,
    task.status
  );

  const savedTask = await findTask.get(Number(result.lastInsertRowid));

  res.status(201).json({
    message: "Task saved.",
    task: savedTask
  });
});

app.patch("/api/tasks/:id/status", async function (req, res) {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: "Invalid task ID." });
  }
  if (!["todo", "in_progress", "done"].includes(status)) {
    return res.status(400).json({ message: "Please choose a valid status." });
  }
  const result = await db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, id);
  if (result.changes === 0) {
    return res.status(404).json({ message: "Task not found." });
  }
  res.json({ message: "Task status updated.", task: await findTask.get(id) });
});

// Edit an existing task without creating a new row.
app.patch("/api/tasks/:id", async function (req, res) {
  const id = Number(req.params.id);
  const { title, description, assignee, status } = req.body ?? {};
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: "Invalid task ID." });
  }
  if ([title, description, assignee, status].some(value => typeof value !== "string")) {
    return res.status(400).json({ message: "All task fields must contain text." });
  }
  const task = {
    title: title.trim(), description: description.trim(),
    assignee: assignee.trim(), status: status.trim()
  };
  if (!task.title || !task.assignee) {
    return res.status(400).json({ message: "Please enter a task title and an assignee." });
  }
  if (task.title.length > 100 || task.assignee.length > 100 || task.description.length > 2000) {
    return res.status(400).json({ message: "Title and assignee allow 100 characters; description allows 2,000." });
  }
  if (!["todo", "in_progress", "done"].includes(task.status)) {
    return res.status(400).json({ message: "Please choose a valid status." });
  }
  const result = await db.prepare(`
    UPDATE tasks SET title = ?, description = ?, assignee = ?, status = ? WHERE id = ?
  `).run(task.title, task.description, task.assignee, task.status, id);
  if (result.changes === 0) return res.status(404).json({ message: "Task not found." });
  res.json({ message: "Task updated.", task: await findTask.get(id) });
});

// Return readable JSON errors to the browser.
app.use(function (error, req, res, next) {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "The request must contain valid JSON."
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      message: "The request is too large."
    });
  }

  console.error(error);

  res.status(500).json({
    message: "Something went wrong. Please try again."
  });
});

if (require.main === module) app.listen(PORT, function () {
  console.log(`Open http://localhost:${PORT}`);
});
module.exports = app;
module.exports.app = app;
module.exports.db = db;
