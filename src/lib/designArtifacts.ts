import { runGateG4 } from "../gates/g4Design.js";
import type { GateContext } from "./types.js";

export function designArtifactIsValid(ctx: GateContext): boolean {
  return runGateG4(ctx).pass;
}
