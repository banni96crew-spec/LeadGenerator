import { runGateG1 } from "../gates/g1Capture.js";
import type { GateContext } from "./types.js";

export function captureArtifactIsValid(ctx: GateContext): boolean {
  return runGateG1(ctx).pass;
}
