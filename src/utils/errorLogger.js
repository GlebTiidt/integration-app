import fs from "fs";
import path from "path";

const LOG_DIR = process.env.LOG_DIR || "logs";
const LOG_FILE = process.env.LOG_FILE_ERRORS || "zabun-airtable-errors.log";
const LOG_PATH = path.join(LOG_DIR, LOG_FILE);

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(String(value));
  }
}

export function logError(context, error, meta = {}) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    context,
    message: error?.message || String(error),
    stack: error?.stack,
    meta
  };

  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_PATH, `${safeJsonStringify(entry)}\n`, "utf8");
  } catch (writeErr) {
    console.error("⚠️ Failed to write error log:", writeErr);
  }
}
