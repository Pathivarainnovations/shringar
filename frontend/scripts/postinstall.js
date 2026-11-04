// postinstall.js - Copy maplibre-gl CSP worker to public folder
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sourceWorker = path.join(__dirname, "..", "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
const destDir = path.join(__dirname, "..", "public");
const destWorker = path.join(destDir, "maplibre-gl-csp-worker.js");

try {
  // Ensure public directory exists
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (!fs.existsSync(sourceWorker)) {
    // Never write a stand-in worker: it would make maps fail silently. Fail loudly instead.
    console.error("postinstall: maplibre-gl worker not found at " + sourceWorker + ". Run `npm install` again.");
    process.exit(1);
  }
  fs.copyFileSync(sourceWorker, destWorker);
  console.log("Copied maplibre-gl worker to public/maplibre-gl-csp-worker.js");
} catch (err) {
  console.error("postinstall error:", err);
  process.exit(1);
}