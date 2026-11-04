// Starts a throwaway backend (own port, own temp database) for the UI tests, and removes it afterwards.
// The tests therefore never touch your real database. Requires `npm install` to have been run in ../backend.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 4177;
let child: ChildProcess | null = null;
let dir = "";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function setup() {
  const backend = path.resolve(__dirname, "../../backend");
  dir = mkdtempSync(path.join(os.tmpdir(), "shringar-test-"));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test", // development behaviour: sign-in codes are returned to the tests
    DB_FILE: path.join(dir, "test.db"),
    PORT: String(PORT),
    ADMIN_EMAIL: "owner@example.com",
    FRONTEND_ORIGIN: "http://localhost:3000",
    SMTP_HOST: "",
    RESEND_API_KEY: "",
  };
  execFileSync(process.execPath, ["scripts/init-reference-data.js"], { cwd: backend, env, stdio: "pipe" });
  const proc = spawn(process.execPath, ["src/server.js"], { cwd: backend, env, stdio: "ignore" });
  child = proc;
  proc.on("error", (e) => console.error("test backend failed to start:", e.message));

  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`The test backend did not start on port ${PORT}. Is the port free and are backend dependencies installed (cd backend && npm install)?`);
}

export async function teardown() {
  const proc = child;
  if (proc) {
    const exited = new Promise((r) => proc.once("exit", r));
    proc.kill();
    await Promise.race([exited, sleep(3000)]);
  }
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* a locked temp file on Windows is harmless */
  }
}
