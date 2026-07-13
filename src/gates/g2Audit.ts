import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { lintAuditClientText } from "./auditTextLinter.js";
import { assertValid } from "./validate.js";
import type { Branch, GateContext, GateResult } from "../lib/types.js";

const MIN_FINDINGS = 3;

function formatGateError(
  ctx: GateContext,
  stage: string,
  artifact: string,
  reason: string
): string {
  return `lead_id=${ctx.lead_id} stage=${stage} gate=G2 artifact=${artifact} ${reason}`;
}

function resolveEvidencePath(evidence: string): string {
  const hashIndex = evidence.indexOf("#");
  return hashIndex >= 0 ? evidence.slice(0, hashIndex) : evidence;
}

function isSafeCapturePath(relPath: string): boolean {
  if (!relPath.startsWith("capture/")) return false;
  if (relPath.includes("..")) return false;
  return true;
}

export function runGateG2(ctx: GateContext, branch: Branch): GateResult {
  const errors: string[] = [];
  const stageName = branch === "has_website" ? "audit" : "research";

  if (branch === "no_website") {
    return {
      pass: false,
      gate: "G2",
      errors: [
        formatGateError(
          ctx,
          stageName,
          "research.json",
          "reason=research branch not in M2"
        ),
      ],
    };
  }

  const artifactRel = "audit.json";
  const artifactPath = path.join(ctx.leadDir, artifactRel);

  if (!existsSync(artifactPath)) {
    return {
      pass: false,
      gate: "G2",
      errors: [
        formatGateError(ctx, "audit", artifactRel, "reason=file missing"),
      ],
    };
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(readFileSync(artifactPath, "utf8"));
    assertValid(data, "audit");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(formatGateError(ctx, "audit", artifactRel, `reason=${message}`));
    return { pass: false, gate: "G2", errors };
  }

  if (data.lead_id !== ctx.lead_id) {
    errors.push(
      formatGateError(
        ctx,
        "audit",
        artifactRel,
        `lead_id=${String(data.lead_id)} expected=${ctx.lead_id}`
      )
    );
  }

  const findings = data.findings as unknown[];
  if (!Array.isArray(findings) || findings.length < MIN_FINDINGS) {
    errors.push(
      formatGateError(
        ctx,
        "audit",
        artifactRel,
        `findings=${Array.isArray(findings) ? findings.length : 0} required>=${MIN_FINDINGS}`
      )
    );
  } else {
    for (const item of findings) {
      const finding = item as Record<string, unknown>;
      const id = String(finding.id ?? "unknown");
      const evidence = String(finding.evidence ?? "");
      const relPath = resolveEvidencePath(evidence);

      if (!isSafeCapturePath(relPath)) {
        errors.push(
          formatGateError(
            ctx,
            "audit",
            artifactRel,
            `finding id=${id} evidence=${evidence} reason=invalid path prefix`
          )
        );
        continue;
      }

      const absPath = path.join(ctx.leadDir, relPath);
      if (!existsSync(absPath)) {
        errors.push(
          formatGateError(
            ctx,
            "audit",
            artifactRel,
            `finding id=${id} evidence=${evidence} reason=file missing`
          )
        );
      }
    }

    const languageErrors = lintAuditClientText(
      findings as Array<Record<string, unknown>>,
      String(data.money_loss_summary ?? "")
    );
    for (const reason of languageErrors) {
      errors.push(formatGateError(ctx, "audit", artifactRel, reason));
    }
  }

  return {
    pass: errors.length === 0,
    gate: "G2",
    errors,
  };
}
