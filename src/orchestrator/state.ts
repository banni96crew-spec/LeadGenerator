import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { assertValid } from "../gates/validate.js";
import { auditArtifactIsValid } from "../lib/auditArtifacts.js";
import { captureArtifactIsValid } from "../lib/captureArtifacts.js";
import { contentArtifactIsValid } from "../lib/contentArtifacts.js";
import { designArtifactIsValid } from "../lib/designArtifacts.js";
import { deployArtifactIsValid } from "../lib/deployArtifacts.js";
import { stateFile } from "../lib/paths.js";
import {
  ALL_STAGES,
  BRANCH_EXCLUSIVE_STAGES,
  getInitialStageStatus,
  type Branch,
  type PipelineState,
  type StageName,
  type StageRecord,
} from "../lib/types.js";

export { BRANCH_EXCLUSIVE_STAGES };

export function initState(leadId: string, branch: Branch): PipelineState {
  const stages = {} as PipelineState["stages"];
  for (const stage of ALL_STAGES) {
    stages[stage] = { status: getInitialStageStatus(stage, branch) };
  }
  return {
    schema_version: "1.0",
    lead_id: leadId,
    branch,
    stages,
    updated_at: new Date().toISOString(),
  };
}

export function loadState(leadId: string): PipelineState {
  const file = stateFile(leadId);
  if (!existsSync(file)) {
    throw new Error(`state.json not found for lead ${leadId}`);
  }
  const state = JSON.parse(readFileSync(file, "utf8")) as PipelineState;
  assertValid(state, "state");
  return state;
}

export function saveState(state: PipelineState): void {
  state.updated_at = new Date().toISOString();
  assertValid(state, "state");
  writeFileSync(stateFile(state.lead_id), JSON.stringify(state, null, 2));
}

export function updateStage(
  state: PipelineState,
  name: StageName,
  patch: Partial<StageRecord>
): PipelineState {
  state.stages[name] = { ...state.stages[name], ...patch };
  return state;
}

export function repairBranchStages(state: PipelineState): PipelineState {
  for (const stage of ALL_STAGES) {
    const expected = getInitialStageStatus(stage, state.branch);
    const current = state.stages[stage].status;
    if (current === "pending" && expected === "skipped") {
      state.stages[stage].status = "skipped";
    }
  }
  return state;
}

export function migrateBranchState(
  state: PipelineState,
  newBranch: Branch
): PipelineState {
  state.branch = newBranch;
  for (const stage of BRANCH_EXCLUSIVE_STAGES) {
    const current = state.stages[stage].status;
    const expected = getInitialStageStatus(stage, newBranch);
    if (current === "pending" || current === "skipped") {
      state.stages[stage].status = expected;
    }
  }
  return repairBranchStages(state);
}

export function shouldSkip(
  stage: StageRecord,
  inputsHash: string,
  force: boolean,
  leadId: string,
  leadDir: string,
  stageName: StageName
): boolean {
  if (force) return false;
  if (stage.status !== "done") return false;
  if (stage.hash !== inputsHash) return false;
  if (!stage.artifact) return false;

  const ctx = { lead_id: leadId, leadDir };

  if (stageName === "capture") {
    return captureArtifactIsValid(ctx);
  }

  if (stageName === "audit") {
    return auditArtifactIsValid(ctx, "has_website");
  }

  if (stageName === "copy") {
    return contentArtifactIsValid(ctx);
  }

  if (stageName === "design") {
    return designArtifactIsValid(ctx);
  }

  if (stageName === "publish") {
    return deployArtifactIsValid(ctx);
  }

  const artifactPath = path.join(leadDir, stage.artifact);
  return existsSync(artifactPath);
}
