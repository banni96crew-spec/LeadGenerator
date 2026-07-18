import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isValid } from "../gates/validate.js";
import { REPO_ROOT } from "./paths.js";

export const OFFER_JSON_REL = "offer/offer.json";
export const OFFER_MD_REL = "offer/offer.md";
export const OFFER_AUDIT_PDF_REL = "offer/audit.pdf";

function normalizeRelativePath(rel: string): string {
  return rel.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/");
}

function readJson(filePath: string): unknown | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export function offerJsonPath(leadDir: string): string {
  return path.join(leadDir, OFFER_JSON_REL);
}

export function offerMdPath(leadDir: string): string {
  return path.join(leadDir, OFFER_MD_REL);
}

export function offerAuditPdfPath(leadDir: string): string {
  return path.join(leadDir, OFFER_AUDIT_PDF_REL);
}

export function portfolioJsonPath(): string {
  return path.join(REPO_ROOT, "context", "portfolio.json");
}

type OfferLinks = {
  demo?: unknown;
  portfolio?: unknown;
  audit_pdf?: unknown;
};

/**
 * Sync local-only validity for offer idempotent skip.
 * Schema + files + link field consistency — NO fetch, NO runGateG6.
 */
export function offerArtifactIsValid(leadDir: string): boolean {
  const offerPath = offerJsonPath(leadDir);
  if (!existsSync(offerPath)) return false;

  const offerRaw = readJson(offerPath);
  if (!offerRaw || !isValid(offerRaw, "offer")) return false;

  const offer = offerRaw as {
    links?: OfferLinks;
  };

  const mdPath = offerMdPath(leadDir);
  if (!existsSync(mdPath)) return false;
  if (!readFileSync(mdPath, "utf8").trim()) return false;

  if (!existsSync(offerAuditPdfPath(leadDir))) return false;

  const links = offer.links;
  if (!links) return false;

  const deployPath = path.join(leadDir, "deploy.json");
  if (!existsSync(deployPath)) return false;
  const deployRaw = readJson(deployPath);
  if (!deployRaw || typeof deployRaw !== "object") return false;
  const demoUrl = String(
    (deployRaw as { demo_url?: unknown }).demo_url ?? ""
  ).trim();
  const demo = String(links.demo ?? "").trim();
  if (!demo || !demoUrl || demo !== demoUrl) return false;

  const portfolioPath = portfolioJsonPath();
  if (!existsSync(portfolioPath)) return false;
  const portfolioRaw = readJson(portfolioPath);
  if (!portfolioRaw || typeof portfolioRaw !== "object") return false;
  const cases = (portfolioRaw as { cases?: Array<{ url?: unknown }> }).cases;
  const allowed = new Set(
    (Array.isArray(cases) ? cases : [])
      .map((c) => String(c?.url ?? "").trim())
      .filter(Boolean)
  );
  const portfolioUrl = String(links.portfolio ?? "").trim();
  if (!portfolioUrl || !allowed.has(portfolioUrl)) return false;

  const auditPdf = String(links.audit_pdf ?? "").trim();
  if (!auditPdf || /^https?:\/\//i.test(auditPdf)) return false;
  if (normalizeRelativePath(auditPdf) !== OFFER_AUDIT_PDF_REL) return false;

  return true;
}
