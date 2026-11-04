// DEVELOPMENT ONLY. Backs up the database, then deletes it so the next server start creates an empty one.
//
//   cd backend
//   node scripts/reset-dev-db.js          (asks you to type RESET)
//   node scripts/reset-dev-db.js --yes    (skips the question; still refuses in production, still backs up)
//
// After resetting, start the server (it creates the empty schema), then run
//   node scripts/init-reference-data.js
// Refuses to run when NODE_ENV=production.
import "../src/env.js";
import Database from "better-sqlite3";
import { existsSync, rmSync, statSync, mkdirSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.DB_FILE ?? path.resolve(__dirname, "../../database/shringar.db");

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to reset the database: NODE_ENV=production.");
  process.exit(1);
}
if (!existsSync(DB_FILE)) {
  console.log(`No database at ${DB_FILE} - nothing to reset.`);
  process.exit(0);
}

console.log(`Database: ${DB_FILE} (${(statSync(DB_FILE).size / 1024).toFixed(0)} KB)`);
console.log("This will DELETE all data in it (a backup is made first).");

if (!process.argv.includes("--yes")) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('Type RESET to continue: ')).trim();
  rl.close();
  if (answer !== "RESET") {
    console.log("Cancelled. Nothing was changed.");
    process.exit(0);
  }
}

const backupDir = path.resolve(__dirname, "..");
const stamp = new Date().toISOString();
const ymd = stamp.slice(0, 10).replaceAll("-", "");
let backup = path.join(backupDir, `backup-${ymd}.db`);
if (existsSync(backup)) backup = path.join(backupDir, `backup-${ymd}-${stamp.slice(11, 19).replaceAll(":", "")}.db`);
mkdirSync(backupDir, { recursive: true });

// SQLite's online backup API is WAL-safe (a plain file copy could miss recent writes).
const src = new Database(DB_FILE, { readonly: true });
try {
  await src.backup(backup);
} finally {
  src.close();
}
console.log(`Backup written: ${backup}`);

try {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_FILE + suffix, { force: true });
} catch (err) {
  console.error(`Could not delete the database (${err.code ?? err.message}). Stop the backend server and run this again. Your backup is safe.`);
  process.exit(1);
}
console.log("Database deleted. Start the server to create a fresh empty one, then run: node scripts/init-reference-data.js");
