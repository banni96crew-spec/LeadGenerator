import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { ErrorObject, ValidateFunction } from "ajv";
import { REPO_ROOT } from "../lib/paths.js";

const require = createRequire(import.meta.url);
const Ajv = require("ajv") as typeof import("ajv").default;
const addFormats = require("ajv-formats") as (
  ajv: import("ajv").default
) => import("ajv").default;

const SCHEMAS_DIR = path.join(REPO_ROOT, "schemas");

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const validators = new Map<string, ValidateFunction>();

function schemaNameFromFile(filename: string): string {
  return filename.replace(/\.schema\.json$/, "");
}

for (const file of readdirSync(SCHEMAS_DIR)) {
  if (!file.endsWith(".schema.json")) continue;
  const schemaPath = path.join(SCHEMAS_DIR, file);
  const raw = readFileSync(schemaPath, "utf8");
  if (!raw.trim()) {
    throw new Error(`Empty schema file: ${schemaPath}`);
  }
  const schema = JSON.parse(raw);
  const name = schemaNameFromFile(file);
  const validate = ajv.compile(schema);
  validators.set(name, validate);
}

export function formatValidationErrors(errors: ErrorObject[]): string[] {
  return errors.map((err) => {
    const pointer = err.instancePath || "/";
    return `path=${pointer}: ${err.message ?? "validation failed"}`;
  });
}

export function assertValid(data: unknown, schemaName: string): void {
  const validate = validators.get(schemaName);
  if (!validate) {
    throw new Error(`Unknown schema: ${schemaName}`);
  }
  if (!validate(data)) {
    const messages = formatValidationErrors(validate.errors ?? []);
    throw new Error(
      `Schema validation failed (${schemaName}): ${messages.join("; ")}`
    );
  }
}

export function isValid(data: unknown, schemaName: string): boolean {
  try {
    assertValid(data, schemaName);
    return true;
  } catch {
    return false;
  }
}
