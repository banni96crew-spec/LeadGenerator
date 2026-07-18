import {
  createWriteStream,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { assertValid } from "../gates/validate.js";
import { REPO_ROOT } from "./paths.js";

const RELATIVE_PDF_PATH = "offer/audit.pdf";
const FONT_NAME = "AuditBody";
const FONT_PATH = path.join(REPO_ROOT, "assets", "fonts", "DejaVuSans.ttf");

type AuditFinding = {
  claim: string;
  evidence: string;
  impact: string;
  severity: string;
};

type AuditDocument = {
  business_facts: {
    services: string[];
    usp_existing: string[];
    audience: string;
  };
  findings: AuditFinding[];
  money_loss_summary: string;
};

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function awaitWritableFinish(stream: NodeJS.WritableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once("finish", () => resolve());
    stream.once("error", reject);
  });
}

/**
 * Render audit.json into a client-facing Russian PDF at offer/audit.pdf.
 * Returns the relative path from the lead root.
 */
export async function generateAuditPdf(leadDir: string): Promise<string> {
  const auditRaw = readJson(path.join(leadDir, "audit.json"));
  assertValid(auditRaw, "audit");
  const audit = auditRaw as AuditDocument;

  const leadRaw = readJson(path.join(leadDir, "lead.json"));
  assertValid(leadRaw, "lead");
  const companyName = (leadRaw as { name: string }).name;

  const offerDir = path.join(leadDir, "offer");
  mkdirSync(offerDir, { recursive: true });
  const outAbs = path.join(leadDir, RELATIVE_PDF_PATH);

  const doc = new PDFDocument({ margin: 50 });
  const stream = createWriteStream(outAbs);
  const finished = awaitWritableFinish(stream);
  doc.pipe(stream);

  doc.registerFont(FONT_NAME, FONT_PATH);
  doc.font(FONT_NAME);

  doc.fontSize(18).text(`${companyName} — Аудит сайта`);
  doc.moveDown();

  doc.fontSize(14).text("Резюме");
  doc.moveDown(0.4);
  doc.fontSize(11).text(audit.money_loss_summary);
  doc.moveDown();

  doc.fontSize(14).text("Ключевые проблемы");
  doc.moveDown(0.4);
  for (const [index, finding] of audit.findings.entries()) {
    doc
      .fontSize(12)
      .text(`${index + 1}. [${finding.severity}] ${finding.claim}`);
    doc.fontSize(10).text(`Влияние: ${finding.impact}`);
    doc.text(`Доказательство: ${finding.evidence}`);
    doc.moveDown(0.5);
  }

  doc.moveDown(0.3);
  doc.fontSize(14).text("Факты о бизнесе");
  doc.moveDown(0.4);
  doc.fontSize(10);
  const facts = audit.business_facts;
  if (facts.services.length > 0) {
    doc.text(`Услуги: ${facts.services.join("; ")}`);
  }
  if (facts.usp_existing.length > 0) {
    doc.text(`УТП: ${facts.usp_existing.join("; ")}`);
  }
  doc.text(`Аудитория: ${facts.audience}`);

  doc.end();
  await finished;

  const size = statSync(outAbs).size;
  if (size <= 0) {
    throw new Error(`audit.pdf empty after write: ${outAbs}`);
  }

  return RELATIVE_PDF_PATH;
}
