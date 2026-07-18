import { execFile } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { assertValid } from "../../gates/validate.js";
import { REPO_ROOT } from "../../lib/paths.js";
import {
  extractDemoUrlFromWranglerOutput,
  loadPublishEnv,
  previewDemoUrl,
} from "./env.js";

const execFileAsync = promisify(execFile);

export type RunPublishOptions = {
  leadId: string;
  leadDir: string;
  buildDir?: string;
};

export type DeployArtifact = {
  schema_version: "1.0";
  demo_url: string;
  checks: {
    http_200?: boolean;
    no_console_errors?: boolean;
    lighthouse_perf?: number;
  };
};

function wranglerEntry(): string {
  return path.join(REPO_ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
}

/** Redact secrets from command output before including in errors. */
function scrubSecrets(text: string, apiToken: string): string {
  let out = text;
  if (apiToken) {
    out = out.split(apiToken).join("[REDACTED]");
  }
  return out.replace(/CLOUDFLARE_API_TOKEN[=:]\s*\S+/gi, "CLOUDFLARE_API_TOKEN=[REDACTED]");
}

/**
 * Deploy design/dist to Cloudflare Pages as a preview branch named {lead_id}.
 * Writes schema-valid deploy.json with checks: {} (smoke fills checks later).
 * Never deploys to production main for leads.
 */
export async function runPublish(options: RunPublishOptions): Promise<string> {
  const { leadId, leadDir } = options;
  const buildDir =
    options.buildDir ?? path.join(leadDir, "design", "dist");
  const indexHtml = path.join(buildDir, "index.html");

  if (!existsSync(indexHtml)) {
    throw new Error(
      `lead_id=${leadId} stage=publish: missing ${path.join("design", "dist", "index.html")} under ${leadDir}`
    );
  }

  if (leadId.trim().toLowerCase() === "main") {
    throw new Error(
      `lead_id=${leadId} stage=publish: refusing to deploy lead branch "main" (production). Use a lead-specific branch.`
    );
  }

  const env = loadPublishEnv();
  const wranglerJs = wranglerEntry();

  if (!existsSync(wranglerJs)) {
    throw new Error(
      `lead_id=${leadId} stage=publish: wrangler not installed (expected ${wranglerJs}). Run npm install.`
    );
  }

  const args = [
    wranglerJs,
    "pages",
    "deploy",
    buildDir,
    "--project-name",
    env.pagesProject,
    "--branch",
    leadId,
    "--commit-dirty=true",
  ];

  let wranglerOut = "";
  try {
    const result = await execFileAsync(process.execPath, args, {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: env.accountId,
        CLOUDFLARE_API_TOKEN: env.apiToken,
      },
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    });
    wranglerOut = `${String(result.stdout ?? "")}\n${String(result.stderr ?? "")}`;
  } catch (err) {
    const e = err as {
      message?: string;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      code?: number | string;
    };
    wranglerOut = `${String(e.stdout ?? "")}\n${String(e.stderr ?? "")}`;
    const detail = scrubSecrets(
      [String(e.stderr ?? ""), String(e.stdout ?? ""), e.message ?? String(err)]
        .filter(Boolean)
        .join("\n")
        .trim(),
      env.apiToken
    );
    throw new Error(
      `lead_id=${leadId} stage=publish: wrangler pages deploy failed (branch=${leadId}, project=${env.pagesProject})${detail ? `: ${detail}` : ""}`
    );
  }

  const demoUrl = extractDemoUrlFromWranglerOutput(wranglerOut, leadId);
  if (!demoUrl) {
    // Constructed project-name URL is often wrong when CF assigns a hashed
    // subdomain (e.g. leadgenerator-7sp). Fail loud rather than smoke a 404.
    throw new Error(
      `lead_id=${leadId} stage=publish: could not parse demo_url from wrangler output (project=${env.pagesProject}). ` +
        `Expected "Deployment alias URL:" or "Take a peek over at https://….pages.dev". ` +
        `Fallback shape would be ${previewDemoUrl(leadId, env.pagesProject)} but Pages subdomain may differ from project name.`
    );
  }

  const deploy: DeployArtifact = {
    schema_version: "1.0",
    demo_url: demoUrl,
    checks: {},
  };

  assertValid(deploy, "deploy");

  const deployPath = path.join(leadDir, "deploy.json");
  writeFileSync(deployPath, JSON.stringify(deploy, null, 2), "utf8");

  return "deploy.json";
}
