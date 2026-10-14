const express = require("express");
const path = require("node:path");
const {
  db,
  insertTask,
  listTasks,
  findTask
} = require("./database");

const app = express();
const PORT = 3002;

app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", function (req, res) {
  res.json({
    message: "Team Task Tracker server is running!"
  });
});

// Return saved tasks.
app.get("/api/tasks", function (req, res) {
  res.set("Cache-Control", "no-store");

  res.json({
    tasks: listTasks.all()
  });
});

// Validate and save a new task.
app.post("/api/tasks", function (req, res) {
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

  const result = insertTask.run(
    task.title,
    task.description,
    task.assignee,
    task.status
  );

  const savedTask = findTask.get(Number(result.lastInsertRowid));

  res.status(201).json({
    message: "Task saved.",
    task: savedTask
  });
});

app.patch("/api/tasks/:id/status", function (req, res) {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: "Invalid task ID." });
  }
  if (!["todo", "in_progress", "done"].includes(status)) {
    return res.status(400).json({ message: "Please choose a valid status." });
  }
  const result = db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, id);
  if (result.changes === 0) {
    return res.status(404).json({ message: "Task not found." });
  }
  res.json({ message: "Task status updated.", task: findTask.get(id) });
});

// Edit an existing task without creating a new row.
app.patch("/api/tasks/:id", function (req, res) {
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
  const result = db.prepare(`
    UPDATE tasks SET title = ?, description = ?, assignee = ?, status = ? WHERE id = ?
  `).run(task.title, task.description, task.assignee, task.status, id);
  if (result.changes === 0) return res.status(404).json({ message: "Task not found." });
  res.json({ message: "Task updated.", task: findTask.get(id) });
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

app.listen(PORT, function () {
  console.log(`Open http://localhost:${PORT}`);
});