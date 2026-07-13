import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { assertValid } from "./validate.js";
import type { GateContext, GateResult } from "../lib/types.js";

const MIN_PREVIEW_BYTES = 5120;
const MIN_CRITIC_SCORE = 4;

function formatGateError(
  ctx: GateContext,
  artifact: string,
  reason: string
): string {
  return `lead_id=${ctx.lead_id} stage=design gate=G4 artifact=${artifact} ${reason}`;
}

export type G4Options = {
  /** When true, skip critic.json checks (code-only pass before critic exists). */
  codeOnly?: boolean;
};

export function runGateG4(
  ctx: GateContext,
  options: G4Options = {}
): GateResult {
  const errors: string[] = [];
  const codeOnly = options.codeOnly === true;

  const indexRel = "design/dist/index.html";
  const indexPath = path.join(ctx.leadDir, indexRel);
  if (!existsSync(indexPath)) {
    return {
      pass: false,
      gate: "G4",
      errors: [formatGateError(ctx, indexRel, "reason=file missing")],
    };
  }

  const buildRel = "design/build.json";
  const buildPath = path.join(ctx.leadDir, buildRel);
  if (!existsSync(buildPath)) {
    return {
      pass: false,
      gate: "G4",
      errors: [formatGateError(ctx, buildRel, "reason=file missing")],
    };
  }

  let build: Record<string, unknown>;
  try {
    build = JSON.parse(readFileSync(buildPath, "utf8"));
    assertValid(build, "design-build");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(formatGateError(ctx, buildRel, `reason=${message}`));
    return { pass: false, gate: "G4", errors };
  }

  const screens = build.screens as string[];
  for (const rel of screens) {
    const abs = path.join(ctx.leadDir, rel);
    if (!existsSync(abs)) {
      errors.push(formatGateError(ctx, rel, "reason=file missing"));
      continue;
    }
    const size = statSync(abs).size;
    if (size <= MIN_PREVIEW_BYTES) {
      errors.push(
        formatGateError(
          ctx,
          rel,
          `size=${size} required>${MIN_PREVIEW_BYTES}`
        )
      );
    }
  }

  if (typeof build.console_errors_count === "number") {
    if (build.console_errors_count !== 0) {
      errors.push(
        formatGateError(
          ctx,
          buildRel,
          `console_errors_count=${build.console_errors_count} required=0`
        )
      );
    }
  }

  if (build.overflow_mobile === true) {
    errors.push(
      formatGateError(ctx, buildRel, "reason=overflow_mobile=true")
    );
  }

  if (codeOnly) {
    return {
      pass: errors.length === 0,
      gate: "G4",
      errors,
    };
  }

  const criticRel = "design/critic.json";
  const criticPath = path.join(ctx.leadDir, criticRel);
  if (!existsSync(criticPath)) {
    errors.push(formatGateError(ctx, criticRel, "reason=file missing"));
    return { pass: false, gate: "G4", errors };
  }

  let critic: Record<string, unknown>;
  try {
    critic = JSON.parse(readFileSync(criticPath, "utf8"));
    assertValid(critic, "critic");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(formatGateError(ctx, criticRel, `reason=${message}`));
    return { pass: false, gate: "G4", errors };
  }

  if (critic.pass !== true) {
    errors.push(formatGateError(ctx, criticRel, "reason=pass=false"));
  }

  const scores = critic.scores as Record<string, number>;
  for (const key of ["trust", "modern", "sellable", "readable"] as const) {
    const value = scores[key];
    if (typeof value !== "number" || value < MIN_CRITIC_SCORE) {
      errors.push(
        formatGateError(
          ctx,
          criticRel,
          `score.${key}=${String(value)} required>=${MIN_CRITIC_SCORE}`
        )
      );
    }
  }

  return {
    pass: errors.length === 0,
    gate: "G4",
    errors,
  };
}
