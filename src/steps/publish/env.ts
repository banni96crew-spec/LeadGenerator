import { loadEnv } from "../../lib/loadEnv.js";

export type PublishEnv = {
  accountId: string;
  apiToken: string;
  pagesProject: string;
  lighthousePerfMin: number;
};

const DEFAULT_LIGHTHOUSE_PERF_MIN = 85;

const ANSI_RE = /\u001b\[[0-9;]*m/g;
const PAGES_DEV_URL_RE = /https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev/gi;

/**
 * Fallback preview URL shape. Prefer {@link extractDemoUrlFromWranglerOutput}:
 * Cloudflare Pages `subdomain` often differs from the project name
 * (e.g. project `leadgenerator` → `leadgenerator-7sp.pages.dev`).
 */
export function previewDemoUrl(leadId: string, pagesProject: string): string {
  const branch = leadId.trim();
  const project = pagesProject.trim();
  if (!branch) {
    throw new Error("lead_id is required to build preview demo_url");
  }
  if (!project) {
    throw new Error("CLOUDFLARE_PAGES_PROJECT is required to build preview demo_url");
  }
  return `https://${branch}.${project}.pages.dev`;
}

/**
 * Parse demo_url from wrangler `pages deploy` stdout/stderr.
 * Prefers branch alias URL over per-deployment hash URL.
 */
export function extractDemoUrlFromWranglerOutput(
  output: string,
  leadId: string
): string | null {
  const text = output.replace(ANSI_RE, "");
  const branch = leadId.trim().toLowerCase();

  const aliasMatch = text.match(/Deployment alias URL:\s*(https:\/\/\S+)/i);
  if (aliasMatch?.[1]) {
    return trimUrl(aliasMatch[1]);
  }

  const peekMatch = text.match(/Take a peek over at\s*(https:\/\/\S+)/i);
  if (peekMatch?.[1]) {
    return trimUrl(peekMatch[1]);
  }

  const urls = [...text.matchAll(PAGES_DEV_URL_RE)].map((m) => m[0]);
  if (urls.length === 0) {
    return null;
  }

  const branchAlias = urls.find((u) =>
    u.toLowerCase().startsWith(`https://${branch}.`)
  );
  return branchAlias ?? urls[0] ?? null;
}

function trimUrl(raw: string): string {
  return raw.replace(/[.,;)\]]+$/g, "");
}

export function loadPublishEnv(): PublishEnv {
  loadEnv();

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim() ?? "";
  const pagesProject = process.env.CLOUDFLARE_PAGES_PROJECT?.trim() ?? "";
  const minRaw = process.env.LIGHTHOUSE_PERF_MIN?.trim() ?? String(DEFAULT_LIGHTHOUSE_PERF_MIN);
  const lighthousePerfMin = Number(minRaw);

  const missing: string[] = [];
  if (!accountId) missing.push("CLOUDFLARE_ACCOUNT_ID");
  if (!apiToken) missing.push("CLOUDFLARE_API_TOKEN");
  if (!pagesProject) missing.push("CLOUDFLARE_PAGES_PROJECT");
  if (missing.length > 0) {
    throw new Error(
      `Missing Cloudflare env for Publish: ${missing.join(", ")}. Set them in .env (never commit tokens).`
    );
  }

  if (!Number.isFinite(lighthousePerfMin) || lighthousePerfMin < 0 || lighthousePerfMin > 100) {
    throw new Error(
      `LIGHTHOUSE_PERF_MIN must be a number 0–100 (got ${JSON.stringify(minRaw)})`
    );
  }

  return {
    accountId,
    apiToken,
    pagesProject,
    lighthousePerfMin,
  };
}
