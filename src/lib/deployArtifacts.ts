import { runGateG5 } from "../gates/g5Publish.js";
import type { GateContext } from "./types.js";

export function deployArtifactIsValid(ctx: GateContext): boolean {
  return runGateG5(ctx).pass;
}
