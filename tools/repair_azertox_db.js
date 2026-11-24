const fs = require("fs");
const path = require("path");

const root = __dirname;
const sourceDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "..", "data");
const shardPath = path.join(sourceDir, "shard-021.json");
const manifestPath = path.join(root, "..", "data", "manifest.json");
const luaPath = path.join(root, "..", "data", "azertox_db.lua");

let rows = JSON.parse(fs.readFileSync(shardPath, "utf8"));
const before = rows.length;
rows = rows.filter((row) => !(row.question === "content type" && row.answer === "APPLICATIONJSON"));
fs.writeFileSync(shardPath, JSON.stringify(rows));

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const entry = manifest.shards.find((item) => item.file === "shard-021.json");
manifest.totalRecords -= before - rows.length;
manifest.databaseRecords = manifest.totalRecords;
if (entry) {
  entry.count = rows.length;
  entry.bytes = fs.statSync(shardPath).size;
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

let lua = fs.readFileSync(luaPath, "utf8");
lua = lua.replace(/\r?\n    \{ q = "content type", a = \{ "APPLICATIONJSON" \}, al = \{\} \},/, "");
fs.writeFileSync(luaPath, lua);
console.log(JSON.stringify({ removed: before - rows.length, total: manifest.totalRecords }, null, 2));
