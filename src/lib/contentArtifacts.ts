import { runGateG3 } from "../gates/g3Copy.js";
import type { GateContext } from "./types.js";

export function contentArtifactIsValid(ctx: GateContext): boolean {
  return runGateG3(ctx).pass;
}
