import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { assertValid } from "./validate.js";
import type { GateContext, GateResult } from "../lib/types.js";

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
    return { pass: false, gate: "G3", errors };
  }

  const vertical = String(data.vertical ?? "").trim();
  if (!vertical) {
    errors.push(formatGateError(ctx, artifactRel, "reason=vertical empty"));
  }

  const sections = data.sections as Record<string, unknown>;
  const hero = sections.hero as Record<string, string>;
  const contact = sections.contact as Record<string, string>;
  const benefits = sections.benefits as Array<Record<string, string>>;
  const social = sections.social_proof as {
    reviews?: string[];
    cases?: string[];
  };

  if (!hero.cta?.trim()) {
    errors.push(formatGateError(ctx, artifactRel, "reason=hero.cta empty"));
  }
  if (!contact.cta?.trim()) {
    errors.push(formatGateError(ctx, artifactRel, "reason=contact.cta empty"));
  }
  if (!Array.isArray(benefits) || benefits.length < 3) {
    errors.push(
      formatGateError(
        ctx,
        artifactRel,
        `benefits=${Array.isArray(benefits) ? benefits.length : 0} required>=3`
      )
    );
  }

  const reviewCount = social.reviews?.length ?? 0;
  const caseCount = social.cases?.length ?? 0;
  if (reviewCount + caseCount < 1) {
    errors.push(
      formatGateError(
        ctx,
        artifactRel,
        "reason=social_proof empty (need reviews or cases)"
      )
    );
  }

  const ruSamples = [hero.headline, hero.cta, contact.cta].filter(Boolean);
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
