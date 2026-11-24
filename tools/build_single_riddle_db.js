const fs = require("fs");
const path = require("path");

const root = __dirname;
const dataDir = path.join(root, "..", "data");
const sourceDir = process.argv[2] ? path.resolve(process.argv[2]) : dataDir;
const outputJson = path.join(dataDir, "riddles.json");
const outputPackageLua = path.join(dataDir, "azertox_db.lua");
const outputLua = outputPackageLua;

function cleanText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\p{L}\p{N}_]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalQuestion(value) {
  let q = cleanText(value);
  const prefixes = [
    "for a steal a brainrot riddle ",
    "admin abuse riddle ",
    "in steal a brainrot ",
    "steal a brainrot ",
    "answer this brainrot question ",
    "answer this brainrot riddle ",
    "answer this riddle ",
    "which answer fits this steal a brainrot clue ",
    "which answer fits this brainrot clue ",
    "which answer fits this clue ",
    "brainrot quiz ",
    "brainrot riddle ",
    "riddle question ",
    "riddle ",
    "the riddle is ",
    "riddle is ",
    "the riddle ",
    "the question is ",
    "question is ",
    "the question ",
    "question ",
    "what is ",
    "whats ",
    "who is ",
    "which is ",
    "what ",
    "who ",
    "which ",
    "my ",
  ];

  let changed = true;
  while (changed && q) {
    changed = false;
    for (const prefix of prefixes) {
      if (q.startsWith(prefix)) {
        q = q.slice(prefix.length).trim();
        changed = true;
        break;
      }
    }
  }

  for (const suffix of [" answer 1", " answer 2", " answer 3", " answer 4", " answer 5", " exact answer", " exact"]) {
    if (q.endsWith(suffix)) {
      q = q.slice(0, -suffix.length).trim();
      break;
    }
  }
  const aliases = {
    "age of sammy": "how old is sammy",
    "sammy age": "how old is sammy",
    "sammys age": "how old is sammy",
    "the year of the candy": "candy mutation year",
    "year of the candy": "candy mutation year",
    "the year of candy": "candy mutation year",
    "year of candy": "candy mutation year",
    "candy year": "candy mutation year",
    "what year was candy released": "candy mutation year",
    "year was candy released": "candy mutation year",
    "when was candy released": "when was candy mutation released",
    "the year of release sab": "sab release year",
    "year of release sab": "sab release year",
    "release year sab": "sab release year",
    "what year did sab release": "sab release year",
    "year did sab release": "sab release year",
    "when did sab release": "when was sab released",
    "sammys name": "sammy name",
    "what is sammys name": "sammy name",
    "what is sammy name": "sammy name",
    "what is the name of sammy": "sammy name",
    "what is his name": "sammy name",
    "his name": "sammy name",
  };
  q = aliases[q] || q;
  return q;
}

function cleanAnswer(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toUpperCase()
    .slice(0, 50);
}

// These are ambiguous clue fragments, not sufficiently specific questions.
// Keeping them out of the active DB prevents "age", "cat" and "release year"
// from receiving an automatic answer without a subject.
const blockedGenericQuestions = new Set([
  "age", "animal", "artist", "answer", "birthday", "birthplace", "brainrot",
  "cash", "cat", "city", "code", "color", "country", "created", "creator",
  "date", "day", "dog", "food", "game", "hair", "income", "launched",
  "location", "month", "name", "owner", "question", "rarity", "release",
  "release date", "release month", "release year", "sab", "sport", "state",
  "style", "username", "year",
]);

const buckets = new Map();
let inputRows = 0;
let discarded = 0;

const sourceFiles = fs.readdirSync(sourceDir).filter((name) => /^shard-\d+\.json$/.test(name)).sort();
if (sourceFiles.length === 0) {
  throw new Error(`No shard-###.json files found in ${sourceDir}. Pass the source directory as the first argument.`);
}
for (const file of sourceFiles) {
  const records = JSON.parse(fs.readFileSync(path.join(sourceDir, file), "utf8"));
  for (const record of records) {
    inputRows += 1;
    const question = canonicalQuestion(record.question);
    const answer = cleanAnswer(record.answer);
    const combined = `${question} ${answer}`;
    if (!question || question.length < 2 || question.length > 300 || !answer || blockedGenericQuestions.has(question) || /https?:|api key|webhook|cookie|password|access token/i.test(combined)) {
      discarded += 1;
      continue;
    }
    let bucket = buckets.get(question);
    if (!bucket) {
      bucket = { counts: new Map(), last: 0 };
      buckets.set(question, bucket);
    }
    bucket.counts.set(answer, (bucket.counts.get(answer) || 0) + 1);
    bucket.last = inputRows;
  }
}

const unique = {};
let conflicts = 0;
const conflictExamples = [];
for (const [question, bucket] of buckets) {
  const answers = [...bucket.counts.entries()].sort((a, b) => {
    const frequency = b[1] - a[1];
    if (frequency !== 0) return frequency;
    return 0;
  });
  if (answers.length > 1) {
    conflicts += 1;
    if (conflictExamples.length < 12) {
      conflictExamples.push({ question, answers: answers.slice(0, 5) });
    }
  }
  // Highest frequency wins.  Ties remain deterministic because shard order
  // is stable; the first answer is the canonical answer for this question.
  unique[question] = answers[0][0];
}

const ordered = Object.fromEntries(Object.keys(unique).sort().map((question) => [question, unique[question]]));
// Facts that appear with equal counts in old dumps.  These are the current
// canonical values used by the local wiki refresh and prevent a tie from
// silently selecting the older answer.
const overrides = {
  "how many og brainrots are there": "SEVEN",
  "how many headless horseman exist": "EIGHTYSIX",
  "how many mutations are there": "SIXTEEN",
  "how old is sammy": "24",
  "sammy name": "SAMMY",
  "his name": "SAMMY",
  "candy mutation year": "2025",
  "candy mutation release year": "2025",
  "when was candy mutation released": "JULY2025",
  "sab release year": "2025",
  "when was sab released": "MAY162025",
};
for (const [question, answer] of Object.entries(overrides)) {
  ordered[question] = answer;
}
const json = JSON.stringify(ordered);
fs.writeFileSync(outputJson, json + "\n");

const luaRows = Object.entries(ordered).map(([question, answer]) =>
  `    { q = ${JSON.stringify(question)}, a = { ${JSON.stringify(answer)} }, al = {} },`
).join("\n");
const lua = [
  "return {",
  "  version = 2,",
  "  codes = {},",
  "  riddles = {",
  luaRows,
  "  }",
  "}",
  "",
].join("\n");
fs.writeFileSync(outputLua, lua);
fs.writeFileSync(outputPackageLua, lua);

const manifestPath = path.join(dataDir, "manifest.json");
const manifest = {
  schemaVersion: 3,
  game: "Steal a Brainrot",
  totalRecords: Object.keys(ordered).length,
  shardSize: Object.keys(ordered).length,
  shards: [{ file: "azertox_db.lua.txt", format: "lua", count: Object.keys(ordered).length, bytes: Buffer.byteLength(lua) }],
  databaseFile: "azertox_db.lua.txt",
  databaseFormat: "lua-return-table",
  recordFormat: { entry: "riddles", question: "q", answer: "a[1]", oneAnswerPerQuestion: true },
  generatedAt: new Date().toISOString(),
  databaseRecords: Object.keys(ordered).length,
  databaseShards: 1,
  deduplication: "canonical-question-one-answer",
  updatedBy: "build_single_riddle_db.js",
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const rootManifestPath = path.join(root, "..", "manifest.json");
const rootManifest = JSON.parse(fs.readFileSync(rootManifestPath, "utf8"));
rootManifest.databaseRecords = manifest.totalRecords;
rootManifest.databaseShards = 1;
rootManifest.databaseFile = "data/azertox_db.lua";
rootManifest.script = "code/azertoxbest.lua";
fs.writeFileSync(rootManifestPath, JSON.stringify(rootManifest, null, 2) + "\n");

console.log(JSON.stringify({
  inputRows,
  uniqueQuestions: Object.keys(ordered).length,
  conflictsResolvedToOneAnswer: conflicts,
  discarded,
  jsonBytes: Buffer.byteLength(json + "\n"),
  luaBytes: Buffer.byteLength(lua),
  conflictExamples,
}, null, 2));
