const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-test-'));
process.env.DATABASE_PATH = path.join(dir, 'tasks.db');
process.env.TEAM_TOKEN = 'test-team-key-'.repeat(4);
const { app, db } = require('./server');
const server = app.listen(0);
const ready = new Promise(resolve => server.once('listening', resolve));
async function request(route, options = {}, authenticated = true) {
  await ready;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authenticated) headers.Authorization = `Bearer ${process.env.TEAM_TOKEN}`;
  return fetch(`http://127.0.0.1:${server.address().port}${route}`, { ...options, headers });
}
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
test('task data requires the team key', async () => {
  assert.equal((await request('/api/tasks', {}, false)).status, 401);
  assert.equal((await request('/api/tasks', {method:'POST', body:'{}'}, false)).status, 401);
});
test('create, edit, change status and reload a saved task', async () => {
  const input = {title:'Review deployment',description:'Verify saved data',assignee:'Chris',status:'todo'};
  const created = await request('/api/tasks', {method:'POST',body:JSON.stringify(input)});
  assert.equal(created.status,201);
  const {task} = await created.json();
  const edited = await request(`/api/tasks/${task.id}`, {method:'PATCH',body:JSON.stringify({...input,title:'Review complete'})});
  assert.equal(edited.status,200);
  assert.equal((await edited.json()).task.title,'Review complete');
  const moved = await request(`/api/tasks/${task.id}/status`, {method:'PATCH',body:JSON.stringify({status:'done'})});
  assert.equal((await moved.json()).task.status,'done');
  const board = await (await request('/api/tasks')).json();
  assert.equal(board.tasks[0].status,'done');
  assert.equal(board.tasks[0].title,'Review complete');
});
test('invalid tasks and missing updates produce useful errors', async () => {
  assert.equal((await request('/api/tasks',{method:'POST',body:'{}'})).status,400);
  assert.equal((await request('/api/tasks/999/status',{method:'PATCH',body:JSON.stringify({status:'done'})})).status,404);
});
