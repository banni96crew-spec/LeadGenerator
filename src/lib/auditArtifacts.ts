import { runGateG2 } from "../gates/g2Audit.js";
import type { Branch, GateContext } from "./types.js";

export function auditArtifactIsValid(
  ctx: GateContext,
  branch: Branch
): boolean {
  return runGateG2(ctx, branch).pass;
}
