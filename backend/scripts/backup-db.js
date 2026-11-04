// Safe online backup of the SQLite database (works while the server is running).
//
//   cd backend
//   npm run backup                 -> backend/backups/shringar-YYYYMMDD-HHMMSS.db
//   node scripts/backup-db.js D:\backups   (custom folder)
//
// Uses SQLite's backup API, so the copy is consistent even though the database is in WAL mode.
// Schedule it (Windows Task Scheduler / cron) and copy the files off the server.
import "../src/env.js";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.DB_FILE ?? path.resolve(__dirname, "../../database/shringar.db");
const outDir = path.resolve(process.argv[2] ?? path.join(__dirname, "../backups"));

if (!existsSync(DB_FILE)) {
  console.error(`No database at ${DB_FILE}`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const target = path.join(outDir, `shringar-${stamp}.db`);

const db = new Database(DB_FILE, { readonly: true });
try {
  await db.backup(target);
  console.log(`Backup written: ${target}`);
} finally {
  db.close();
}
