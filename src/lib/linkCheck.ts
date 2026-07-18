import { existsSync } from "node:fs";
import path from "node:path";

const FETCH_TIMEOUT_MS = 10_000;
const AUDIT_PDF_RELATIVE = "offer/audit.pdf";

export type LinkCheckResult = {
  ok: boolean;
  errors: string[];
};

export type OfferLinksInput = {
  demo: string;
  portfolio: string;
  audit_pdf: string;
};

export type OfferForLinkCheck = {
  links: OfferLinksInput;
};

export type DeployForLinkCheck = {
  demo_url: string;
};

export type PortfolioCase = {
  url: string;
};

export type PortfolioForLinkCheck = {
  cases: PortfolioCase[];
};

export type CheckOfferLinksArgs = {
  leadDir: string;
  offer: OfferForLinkCheck;
  deploy: DeployForLinkCheck;
  portfolio: PortfolioForLinkCheck;
};

function leadIdFromDir(leadDir: string): string {
  return path.basename(path.resolve(leadDir));
}

function formatLinkError(
  leadId: string,
  link: string,
  url: string,
  status: string | number
): string {
  return `lead_id=${leadId} stage=offer gate=G6 link=${link} url=${url} status=${status}`;
}

/** Reject empty, example.com, localhost, and non-parseable URLs. */
export function isPlaceholderUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    return (
      host === "example.com" ||
      host.endsWith(".example.com") ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "[::1]"
    );
  } catch {
    return true;
  }
}

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * External HTTPS check: HEAD first, GET fallback on 405.
 * Requires final status 200. Timeout 10s per attempt.
 */
export async function checkUrl(
  url: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const headRes = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (headRes.status === 405) {
      const getRes = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      return { ok: getRes.status === 200, status: getRes.status };
    }
    return { ok: headRes.status === 200, status: headRes.status };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkExternalHttps(
  leadId: string,
  link: string,
  url: string,
  errors: string[]
): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) {
    errors.push(formatLinkError(leadId, link, "", "empty"));
    return;
  }
  if (!isHttpsUrl(trimmed) || isPlaceholderUrl(trimmed)) {
    errors.push(formatLinkError(leadId, link, trimmed, "placeholder"));
    return;
  }

  const result = await checkUrl(trimmed);
  if (!result.ok) {
    const status =
      result.status !== undefined && result.status !== 0
        ? result.status
        : result.error
          ? "fetch_error"
          : 0;
    errors.push(formatLinkError(leadId, link, trimmed, status));
  }
}

function normalizeRelativePath(rel: string): string {
  return rel.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/");
}

/**
 * Verify offer links for Gate G6 code checks.
 * Read-only — does not mutate offer/deploy/portfolio artifacts.
 */
export async function checkOfferLinks(
  args: CheckOfferLinksArgs
): Promise<LinkCheckResult> {
  const { leadDir, offer, deploy, portfolio } = args;
  const leadId = leadIdFromDir(leadDir);
  const errors: string[] = [];

  const demo = offer.links?.demo ?? "";
  const portfolioUrl = offer.links?.portfolio ?? "";
  const auditPdf = offer.links?.audit_pdf ?? "";
  const demoUrl = deploy.demo_url ?? "";

  // --- demo: must match deploy.demo_url, then HTTP 200 ---
  const demoTrimmed = String(demo).trim();
  const deployTrimmed = String(demoUrl).trim();

  if (!demoTrimmed) {
    errors.push(formatLinkError(leadId, "demo", "", "empty"));
  } else if (!deployTrimmed) {
    errors.push(formatLinkError(leadId, "demo", demoTrimmed, "deploy_missing"));
  } else if (demoTrimmed !== deployTrimmed) {
    errors.push(formatLinkError(leadId, "demo", demoTrimmed, "mismatch"));
  } else {
    await checkExternalHttps(leadId, "demo", demoTrimmed, errors);
  }

  // --- portfolio: must be allowlisted, then HTTP 200 ---
  const portfolioTrimmed = String(portfolioUrl).trim();
  const allowed = new Set(
    (portfolio.cases ?? [])
      .map((c) => String(c.url ?? "").trim())
      .filter(Boolean)
  );

  if (!portfolioTrimmed) {
    errors.push(formatLinkError(leadId, "portfolio", "", "empty"));
  } else if (!isHttpsUrl(portfolioTrimmed) || isPlaceholderUrl(portfolioTrimmed)) {
    errors.push(
      formatLinkError(leadId, "portfolio", portfolioTrimmed, "placeholder")
    );
  } else if (!allowed.has(portfolioTrimmed)) {
    errors.push(
      formatLinkError(leadId, "portfolio", portfolioTrimmed, "not_in_portfolio")
    );
  } else {
    await checkExternalHttps(leadId, "portfolio", portfolioTrimmed, errors);
  }

  // --- audit_pdf: local relative path under leadDir ---
  const auditTrimmed = String(auditPdf).trim();
  if (!auditTrimmed) {
    errors.push(formatLinkError(leadId, "audit_pdf", "", "empty"));
  } else if (/^https?:\/\//i.test(auditTrimmed)) {
    // Local-only per M5 Decisions; reject remote / placeholder URLs.
    errors.push(
      formatLinkError(
        leadId,
        "audit_pdf",
        auditTrimmed,
        isPlaceholderUrl(auditTrimmed) ? "placeholder" : "not_local"
      )
    );
  } else {
    const normalized = normalizeRelativePath(auditTrimmed);
    if (normalized !== AUDIT_PDF_RELATIVE) {
      errors.push(
        formatLinkError(leadId, "audit_pdf", auditTrimmed, "bad_path")
      );
    } else {
      const abs = path.join(leadDir, AUDIT_PDF_RELATIVE);
      if (!existsSync(abs)) {
        errors.push(
          formatLinkError(leadId, "audit_pdf", auditTrimmed, "missing_file")
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
