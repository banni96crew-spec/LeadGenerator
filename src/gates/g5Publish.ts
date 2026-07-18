import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { assertValid } from "./validate.js";
import type { GateContext, GateResult } from "../lib/types.js";

const DEFAULT_LIGHTHOUSE_PERF_MIN = 85;

function formatGateError(
  ctx: GateContext,
  artifact: string,
  reason: string
): string {
  return `lead_id=${ctx.lead_id} stage=publish gate=G5 artifact=${artifact} ${reason}`;
}

function lighthousePerfMin(): number {
  const raw = process.env.LIGHTHOUSE_PERF_MIN?.trim();
  if (raw === undefined || raw === "") return DEFAULT_LIGHTHOUSE_PERF_MIN;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return DEFAULT_LIGHTHOUSE_PERF_MIN;
  }
  return n;
}

/**
 * Gate G5 — read-only evaluation of deploy.json.checks.
 * Does not run fetch, Playwright, or Lighthouse (smoke owns those).
 */
export function runGateG5(ctx: GateContext): GateResult {
  const errors: string[] = [];
  const artifact = "deploy.json";
  const deployPath = path.join(ctx.leadDir, artifact);

  if (!existsSync(deployPath)) {
    return {
      pass: false,
      gate: "G5",
      errors: [formatGateError(ctx, artifact, "reason=file missing")],
    };
  }

  let deploy: Record<string, unknown>;
  try {
    deploy = JSON.parse(readFileSync(deployPath, "utf8")) as Record<
      string,
      unknown
    >;
    assertValid(deploy, "deploy");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(formatGateError(ctx, artifact, `reason=${message}`));
    return { pass: false, gate: "G5", errors };
  }

  const checks = deploy.checks as Record<string, unknown> | undefined;
  if (
    !checks ||
    typeof checks !== "object" ||
    Object.keys(checks).length === 0
  ) {
    errors.push(
      formatGateError(
        ctx,
        artifact,
        "reason=checks empty; smoke must populate http_200, no_console_errors, lighthouse_perf"
      )
    );
    return { pass: false, gate: "G5", errors };
  }

  const min = lighthousePerfMin();

  if (checks.http_200 !== true) {
    errors.push(
      formatGateError(
        ctx,
        artifact,
        `http_200=${String(checks.http_200)} required=true`
      )
    );
  }

  if (checks.no_console_errors !== true) {
    errors.push(
      formatGateError(
        ctx,
        artifact,
        `no_console_errors=${String(checks.no_console_errors)} required=true`
      )
    );
  }

  const perf = checks.lighthouse_perf;
  if (typeof perf !== "number" || !Number.isFinite(perf)) {
    errors.push(
      formatGateError(
        ctx,
        artifact,
        `lighthouse_perf=${String(perf)} required=number`
      )
    );
  } else if (perf < min) {
    errors.push(
      formatGateError(
        ctx,
        artifact,
        `lighthouse_perf=${perf} required>=${min}`
      )
    );
  }

  return {
    pass: errors.length === 0,
    gate: "G5",
    errors,
  };
}
