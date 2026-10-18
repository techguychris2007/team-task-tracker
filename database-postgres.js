const createStore = require("./postgres-store");
const db = createStore("tasks_app", ["tasks"]);
module.exports = { db,
 insertTask: db.prepare("INSERT INTO tasks (title,description,assignee,status) VALUES (?,?,?,?)"),
 listTasks: db.prepare("SELECT * FROM tasks ORDER BY id DESC"),
 findTask: db.prepare("SELECT * FROM tasks WHERE id = ?")
};
