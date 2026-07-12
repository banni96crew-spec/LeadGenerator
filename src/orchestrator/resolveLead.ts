import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { assertValid } from "../gates/validate.js";
import {
  slugify,
  leadDir,
  leadFile,
  resolveLeadPath,
  normalizeSiteUrl,
} from "../lib/paths.js";
import type { Lead } from "../lib/types.js";

export type ResolveInput =
  | { kind: "data"; data: string | Record<string, unknown> }
  | { kind: "lead"; path: string };

export type ResolveResult = {
  leadId: string;
  leadDir: string;
  leadPath: string;
  lead: Lead;
};

function parseDataInput(data: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof data === "string") {
    return JSON.parse(data) as Record<string, unknown>;
  }
  return data;
}

function normalizeLead(raw: Record<string, unknown>): Lead {
  const name = String(raw.name ?? "").trim();
  if (!name) {
    throw new Error("lead.name is required");
  }

  const leadId = slugify(name);
  const lead: Lead = {
    schema_version: "1.0",
    lead_id: leadId,
    name,
  };

  if (raw.site !== undefined && raw.site !== null && String(raw.site).trim()) {
    lead.site = normalizeSiteUrl(String(raw.site));
  }
  if (raw.category) lead.category = String(raw.category);
  if (raw.geo) lead.geo = String(raw.geo);
  if (raw.phone) lead.phone = String(raw.phone);
  if (raw.source) lead.source = String(raw.source);
  if (raw.raw && typeof raw.raw === "object") {
    lead.raw = raw.raw as Record<string, unknown>;
  }

  return lead;
}

export function resolveLead(input: ResolveInput): ResolveResult {
  let lead: Lead;

  if (input.kind === "data") {
    const raw = parseDataInput(input.data);
    lead = normalizeLead(raw);
    if (!lead.source) lead.source = "inline";
  } else {
    const dir = resolveLeadPath(input.path);
    const file = dir.endsWith("lead.json")
      ? dir
      : path.join(dir, "lead.json");
    if (!existsSync(file)) {
      throw new Error(`lead.json not found at ${file}`);
    }
    const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    lead = normalizeLead(raw);
  }

  assertValid(lead, "lead");

  const dir = leadDir(lead.lead_id);
  mkdirSync(dir, { recursive: true });
  const filePath = leadFile(lead.lead_id);
  writeFileSync(filePath, JSON.stringify(lead, null, 2));

  return {
    leadId: lead.lead_id,
    leadDir: dir,
    leadPath: filePath,
    lead,
  };
}

// TODO: xlsx-источник (exceljs) при leads_source=xlsx
