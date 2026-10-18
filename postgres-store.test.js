const {test} = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
function setup() {
 const calls=[];
 const client={
  async query(sql,values) { calls.push({sql,values}); return {rows:[{id:7}],rowCount:1}; },
  release() {calls.push({sql:"RELEASE"});}
 };
 class Pool {
  query(...args) {return client.query(...args);}
  async connect() {return client;}
  async end() {}
 }
 const module={exports:{}};
 const file=path.join(__dirname, __dirname.endsWith("tests")?"../postgres-store.js":"postgres-store.js");
 vm.runInNewContext(fs.readFileSync(file,"utf8"), {module,require:()=>({Pool}),process:{env:{DATABASE_URL:"postgres://example.invalid/test"}}});
 return {store:module.exports("expenses_app",["members","expenses","expense_shares"]),calls};
}
test("cloud statements scope tables, bind values, retain API aliases and return inserted IDs",async()=>{
 const {store,calls}=setup();
 await store.prepare("SELECT amount_cents AS amountCents FROM expenses WHERE id = ?").all(3);
 assert.equal(calls[0].sql,'SELECT amount_cents AS "amountCents" FROM "expenses_app"."expenses" WHERE id = $1');
 assert.equal(calls[0].values[0],3);
 const result=await store.prepare("INSERT INTO members (name) VALUES (?)").run("Chris");
 assert.equal(result.lastInsertRowid,7);
 assert.match(calls[1].sql,/RETURNING \*$/);
});
test("cloud transaction commits and releases the same connection",async()=>{
 const {store,calls}=setup();
 await store.transaction(async tx=>{await tx.prepare("SELECT id FROM members").all();});
 assert.equal(calls[0].sql,"BEGIN ISOLATION LEVEL REPEATABLE READ");
 assert.equal(calls.at(-2).sql,"COMMIT");
 assert.equal(calls.at(-1).sql,"RELEASE");
});
test("cloud transaction rolls back and releases its connection on failure",async()=>{
 const {store,calls}=setup();
 await assert.rejects(store.transaction(async()=>{throw new Error("share failed");}),/share failed/);
 assert.equal(calls.at(-2).sql,"ROLLBACK");
 assert.equal(calls.at(-1).sql,"RELEASE");
});
