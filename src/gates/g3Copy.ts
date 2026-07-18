import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { assertValid } from "./validate.js";
import type { GateContext, GateResult } from "../lib/types.js";

/** Digit-primary proof values (plan lock). */
const DIGIT_PRIMARY =
  /^(?=.*\d)[\d\s.%+−–—\/x×]+$/u;

function formatGateError(
  ctx: GateContext,
  artifact: string,
  reason: string
): string {
  return `lead_id=${ctx.lead_id} stage=copy gate=G3 artifact=${artifact} ${reason}`;
}

function cyrillicRatio(text: string): number {
  const letters = text.replace(/[^A-Za-zА-Яа-яЁё]/gu, "");
  if (!letters.length) return 0;
  const cyr = letters.replace(/[^А-Яа-яЁё]/gu, "").length;
  return cyr / letters.length;
}

function hasRussian(text: string): boolean {
  return cyrillicRatio(text) >= 0.4 || /[А-Яа-яЁё]/.test(text);
}

function isDigitPrimary(value: string): boolean {
  return DIGIT_PRIMARY.test(value.trim());
}

function readUtf8IfExists(filePath: string): string | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Evidence corpus for digit-primary proof: lead.json + (audit.json else research.json).
 * reuse_facts alone does NOT count (anti-laundering).
 */
function loadProofEvidenceCorpus(
  ctx: GateContext
): { corpus: string } | { error: string } {
  const leadText = readUtf8IfExists(path.join(ctx.leadDir, "lead.json"));
  if (leadText === undefined) {
    return { error: "proof digit evidence: lead.json missing" };
  }
  const auditText = readUtf8IfExists(path.join(ctx.leadDir, "audit.json"));
  const researchText = readUtf8IfExists(
    path.join(ctx.leadDir, "research.json")
  );
  const evidence = auditText ?? researchText;
  if (evidence === undefined) {
    return { error: "proof digit evidence: no audit/research corpus" };
  }
  return { corpus: `${leadText}\n${evidence}` };
}

function proofValueEvidenced(value: string, corpus: string): boolean {
  const trimmed = value.trim();
  if (corpus.includes(trimmed)) return true;
  const digitCore = trimmed.replace(/\D/g, "");
  if (digitCore.length >= 1 && corpus.includes(digitCore)) return true;
  return false;
}

export function runGateG3(ctx: GateContext): GateResult {
  const errors: string[] = [];
  const artifactRel = "content.json";
  const artifactPath = path.join(ctx.leadDir, artifactRel);

  if (!existsSync(artifactPath)) {
    return {
      pass: false,
      gate: "G3",
      errors: [formatGateError(ctx, artifactRel, "reason=file missing")],
    };
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(readFileSync(artifactPath, "utf8"));
    assertValid(data, "content");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(formatGateError(ctx, artifactRel, `reason=${message}`));
    const legacyHint =
      /benefits|social_proof|trust|symptoms|why_us/i.test(message) ||
      (() => {
        try {
          const raw = readFileSync(artifactPath, "utf8");
          return /"benefits"|"social_proof"|"renovation"|"trust"|"symptoms"|"why_us"/.test(
            raw
          );
        } catch {
          return false;
        }
      })();
    if (legacyHint) {
      errors.push(
        formatGateError(
          ctx,
          artifactRel,
          "reason=legacy content schema; migrate or re-run copy"
        )
      );
    }
    return { pass: false, gate: "G3", errors };
  }

  const vertical = String(data.vertical ?? "").trim();
  if (!vertical) {
    errors.push(formatGateError(ctx, artifactRel, "reason=vertical empty"));
  }

  const footerTagline = String(data.footer_tagline ?? "").trim();
  if (!footerTagline) {
    errors.push(
      formatGateError(ctx, artifactRel, "reason=footer_tagline empty")
    );
  }

  const sections = data.sections as Record<string, unknown>;
  const hero = sections.hero as Record<string, string>;
  const proof = sections.proof as Array<Record<string, string>>;
  const approach = sections.approach as {
    prose?: string;
    steps?: Array<Record<string, string>>;
  };
  const projects = sections.projects as {
    items?: Array<Record<string, string>>;
  };
  const materials = sections.materials as { items?: string[] };

  if (!hero.cta_primary?.trim()) {
    errors.push(
      formatGateError(ctx, artifactRel, "reason=hero.cta_primary empty")
    );
  }
  if (!hero.cta_secondary?.trim()) {
    errors.push(
      formatGateError(ctx, artifactRel, "reason=hero.cta_secondary empty")
    );
  }
  if (!Array.isArray(proof) || proof.length !== 4) {
    errors.push(
      formatGateError(
        ctx,
        artifactRel,
        `proof=${Array.isArray(proof) ? proof.length : 0} required=4`
      )
    );
  }
  if (!Array.isArray(approach.steps) || approach.steps.length !== 4) {
    errors.push(
      formatGateError(
        ctx,
        artifactRel,
        `approach.steps=${Array.isArray(approach.steps) ? approach.steps.length : 0} required=4`
      )
    );
  }
  if (!Array.isArray(projects.items) || projects.items.length !== 3) {
    errors.push(
      formatGateError(
        ctx,
        artifactRel,
        `projects.items=${Array.isArray(projects.items) ? projects.items.length : 0} required=3`
      )
    );
  }
  if (!Array.isArray(materials.items) || materials.items.length !== 3) {
    errors.push(
      formatGateError(
        ctx,
        artifactRel,
        `materials.items=${Array.isArray(materials.items) ? materials.items.length : 0} required=3`
      )
    );
  }

  const digitValues = Array.isArray(proof)
    ? proof
        .map((p) => String(p?.value ?? "").trim())
        .filter((v) => v.length > 0 && isDigitPrimary(v))
    : [];

  if (digitValues.length > 0) {
    const corpusResult = loadProofEvidenceCorpus(ctx);
    if ("error" in corpusResult) {
      errors.push(formatGateError(ctx, artifactRel, corpusResult.error));
    } else {
      for (const value of digitValues) {
        if (!proofValueEvidenced(value, corpusResult.corpus)) {
          errors.push(
            formatGateError(
              ctx,
              artifactRel,
              `reason=proof digit value "${value}" not evidenced in lead/audit|research`
            )
          );
        }
      }
    }
  }

  const ruSamples = [
    hero.headline,
    hero.cta_primary,
    hero.cta_secondary,
    footerTagline,
    approach.prose,
  ].filter(Boolean) as string[];
  for (const sample of ruSamples) {
    if (!hasRussian(sample)) {
      errors.push(
        formatGateError(
          ctx,
          artifactRel,
          `reason=Russian required sample="${sample.slice(0, 40)}"`
        )
      );
      break;
    }
  }

  return {
    pass: errors.length === 0,
    gate: "G3",
    errors,
  };
}
