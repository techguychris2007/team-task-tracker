let teamKey = "";
const accessPanel = document.querySelector("#team-access");
const workspace = document.querySelector("#workspace");
const accessMessage = document.createElement("p");
accessMessage.setAttribute("role", "status");
accessPanel.append(accessMessage);
async function teamFetch(url, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${teamKey}`);
  return fetch(url, { ...options, headers });
}
const form = document.querySelector("#task-form");
const statusMessage = document.querySelector("#form-status");
const submitButton = form.querySelector('button[type="submit"]');
const columns = {
  todo: document.querySelector("#todo-tasks"),
  in_progress: document.querySelector("#in-progress-tasks"),
  done: document.querySelector("#done-tasks")
};
let tasks = [];
let editingId = null;
let saving = false;
const cancelEditButton = document.querySelector("#cancel-edit");
const formHeading = document.querySelector("#form-title");
function setBusy(busy) {
  saving = busy;
  for (const control of document.querySelectorAll("#task-form input, #task-form textarea, #task-form select, #task-form button, .task-card button, .task-card select")) {
    control.disabled = busy;
  }
}
function resetEditor() {
  editingId = null;
  form.reset();
  formHeading.textContent = "Create a task";
  submitButton.textContent = "Add task";
  cancelEditButton.hidden = true;
}
cancelEditButton.addEventListener("click", function () {
  if (saving) return;
  resetEditor();
  statusMessage.textContent = "Editing cancelled.";
});
function renderBoard() {
  for (const column of Object.values(columns)) column.replaceChildren();
  const done = tasks.filter(task => task.status === "done").length;
  document.querySelector("#progress-summary").textContent = `${done} of ${tasks.length} tasks completed.`;
  const filter = document.querySelector("#assignee-filter").value.trim().toLowerCase();
  for (const task of tasks.filter(task => task.assignee.toLowerCase().includes(filter))) {
    const card = document.createElement("article");
    card.className = "task-card";
    const title = document.createElement("h4");
    title.textContent = task.title;
    const assignee = document.createElement("p");
    assignee.className = "task-assignee";
    assignee.textContent = `Assigned to: ${task.assignee}`;
    card.append(title, assignee);
    if (task.description) {
      const description = document.createElement("p");
      description.className = "task-description";
      description.textContent = task.description;
      card.append(description);
    }
    const statusLabel = document.createElement("label");
    statusLabel.textContent = "Task status";
    statusLabel.htmlFor = `task-status-${task.id}`;
    const statusSelect = document.createElement("select");
    statusSelect.id = `task-status-${task.id}`;
    for (const optionData of [
      { value: "todo", label: "To do" },
      { value: "in_progress", label: "In progress" },
      { value: "done", label: "Done" }
    ]) {
      const option = document.createElement("option");
      option.value = optionData.value;
      option.textContent = optionData.label;
      statusSelect.append(option);
    }
    statusSelect.value = task.status;
    statusSelect.addEventListener("change", async function () {
      if (saving) return;
      setBusy(true);
      statusMessage.textContent = "Updating task...";
      try {
        const response = await teamFetch(`/api/tasks/${task.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: statusSelect.value })
        });
        const result = await response.json();
        if (!response.ok) {
          statusSelect.value = task.status;
          statusMessage.textContent = result.message;
          return;
        }
        tasks = tasks.map(existingTask => existingTask.id === result.task.id ? result.task : existingTask);
        renderBoard();
        statusMessage.textContent = "Task status saved.";
      } catch (error) {
        statusSelect.value = task.status;
        statusMessage.textContent = "Could not confirm the update. Refresh the board to check its saved status.";
        console.error(error);
      } finally {
        renderBoard();
        setBusy(false);
      }
    });
    card.append(statusLabel, statusSelect);
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", function () {
      if (saving) return;
      editingId = task.id;
      for (const field of ["title", "description", "assignee", "status"]) {
        form.elements.namedItem(field).value = task[field];
      }
      formHeading.textContent = "Edit task";
      submitButton.textContent = "Save changes";
      cancelEditButton.hidden = false;
      statusMessage.textContent = "";
      form.elements.namedItem("title").focus();
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    card.append(editButton);
    columns[task.status].append(card);
  }
  for (const column of Object.values(columns)) {
    if (column.children.length === 0) {
      const placeholder = document.createElement("p");
      placeholder.className = "empty";
      placeholder.textContent = "No tasks yet.";
      column.append(placeholder);
    }
  }
}
async function loadTasks() {
  const response = await teamFetch("/api/tasks");
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Could not load tasks.");
  tasks = result.tasks;
  renderBoard();
}
form.addEventListener("submit", async function (event) {
  event.preventDefault();
  if (saving) return;
  const formData = new FormData(form);
  const task = {
    title: formData.get("title").trim(),
    description: formData.get("description").trim(),
    assignee: formData.get("assignee").trim(),
    status: formData.get("status")
  };
  if (!task.title || !task.assignee) {
    statusMessage.textContent = "Please enter a task title and an assignee.";
    return;
  }
  const isEditing = editingId !== null;
  const url = isEditing ? `/api/tasks/${editingId}` : "/api/tasks";
  setBusy(true);
  statusMessage.textContent = "Saving task...";
  try {
    const response = await teamFetch(url, {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task)
    });
    const result = await response.json();
    if (!response.ok) { statusMessage.textContent = result.message; return; }
    if (isEditing) {
      tasks = tasks.map(existingTask => existingTask.id === result.task.id ? result.task : existingTask);
    } else {
      tasks.unshift(result.task);
    }
    resetEditor();
    statusMessage.textContent = isEditing ? "Task changes saved." : `Task "${result.task.title}" saved.`;
  } catch (error) {
    statusMessage.textContent = "Could not confirm the save. Refresh the board before retrying.";
    console.error(error);
  } finally {
    renderBoard();
    setBusy(false);
  }
});
async function initializeBoard() {
  submitButton.disabled = true;
  statusMessage.textContent = "Loading tasks...";
  try {
    await loadTasks();
    statusMessage.textContent = "";
    submitButton.disabled = false;
  } catch (error) {
    statusMessage.textContent = "Could not load tasks. Check that the server is running, then refresh.";
    console.error(error);
  }
}
document.querySelector("#team-access-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  teamKey = document.querySelector("#team-key").value.trim();
  accessMessage.textContent = "Opening board...";
  try {
    await loadTasks();
    accessPanel.hidden = true;
    workspace.hidden = false;
    document.querySelector("#team-key").value = "";
    statusMessage.textContent = "";
    setBusy(false);
    accessMessage.textContent = "";
  } catch (error) {
    teamKey = "";
    accessMessage.textContent = error.message || "Could not open board. Check the server and team key.";
  } finally { button.disabled = false; }
});
document.querySelector("#sign-out").addEventListener("click", () => {
  if (saving) return;
  teamKey = "";
  tasks = [];
  resetEditor();
  renderBoard();
  workspace.hidden = true;
  accessPanel.hidden = false;
});
document.querySelector("#assignee-filter").addEventListener("input", renderBoard);
document.querySelector("#refresh-board").addEventListener("click", async () => {
  if (saving) return;
  setBusy(true);
  try { await loadTasks(); statusMessage.textContent = "Board refreshed."; }
  catch (error) { statusMessage.textContent = error.message; }
  finally { setBusy(false); }
});
