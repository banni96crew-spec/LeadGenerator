import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./paths.js";

/**
 * Load KEY=VALUE pairs from a .env file into process.env.
 * Existing process.env keys are never overridden.
 */
export function loadEnv(envPath?: string): void {
  const filePath = envPath ?? path.join(REPO_ROOT, ".env");
  if (!existsSync(filePath)) {
    return;
  }

  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }

    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

/** Alias used by orchestrator CLI entry. */
export function loadEnvFile(envPath?: string): void {
  loadEnv(envPath);
}
