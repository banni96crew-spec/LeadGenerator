import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { hashInputs } from "../lib/hash.js";
import { logStage } from "../lib/log.js";
import { runGateG1 } from "../gates/g1Capture.js";
import { runGateG2 } from "../gates/g2Audit.js";
import {
  leadFile,
  normalizeSiteUrl,
  resolveLeadPath,
  slugify,
  stateFile,
} from "../lib/paths.js";
import { decideBranch } from "./routing.js";
import { resolveLead, type ResolveInput } from "./resolveLead.js";
import {
  initState,
  loadState,
  migrateBranchState,
  repairBranchStages,
  saveState,
  shouldSkip,
  updateStage,
} from "./state.js";
import { runCapture } from "../steps/capture/index.js";
import type { Lead, PipelineState, StageName } from "../lib/types.js";

// G1_MAX_ATTEMPTS=3: 1 primary capture + 2 retries per CONVENTIONS
const G1_MAX_ATTEMPTS = 3;
// G2 audit gate-only invocations (A1: agent fixes audit.json between runs)
const G2_MAX_ATTEMPTS = 3;
const EXIT_AWAITING_AUDIT = 3;

export type PipelineOptions = {
  resolveInput: ResolveInput;
  stage?: StageName;
  force?: boolean;
};

function normalizeStoredSite(site: unknown): string | undefined {
  if (site === undefined || site === null) return undefined;
  const trimmed = String(site).trim();
  if (!trimmed) return undefined;
  return normalizeSiteUrl(trimmed);
}

function readPreviousSite(input: ResolveInput): string | undefined {
  try {
    let file: string;
    if (input.kind === "lead") {
      const dir = resolveLeadPath(input.path);
      file = path.join(dir, "lead.json");
    } else {
      const raw =
        typeof input.data === "string"
          ? (JSON.parse(input.data) as Record<string, unknown>)
          : input.data;
      const name = String(raw.name ?? "").trim();
      if (!name) return undefined;
      file = leadFile(slugify(name));
    }
    if (!existsSync(file)) return undefined;
    const stored = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    return normalizeStoredSite(stored.site);
  } catch {
    return undefined;
  }
}

function sitesEqual(
  previous: string | undefined,
  current: string | undefined
): boolean {
  return previous === current;
}

function formatGateErrors(
  leadId: string,
  stage: string,
  gate: string,
  errors: string[]
): string {
  return (
    errors.join("; ") ||
    `lead_id=${leadId} stage=${stage} gate=${gate} reason=unknown`
  );
}

function formatCaptureError(leadId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `lead_id=${leadId} stage=capture reason=${message}`;
}

function invalidateAudit(state: PipelineState): void {
  updateStage(state, "audit", {
    status: "pending",
    hash: undefined,
    artifact: undefined,
    error: undefined,
    attempts: undefined,
    cost: undefined,
  });
}

function syncAuditWithCaptureHash(state: PipelineState): void {
  const captureHash = state.stages.capture.hash;
  const auditStage = state.stages.audit;
  if (
    !captureHash ||
    !auditStage.hash ||
    auditStage.hash === captureHash ||
    (auditStage.status !== "done" && auditStage.status !== "failed")
  ) {
    return;
  }
  invalidateAudit(state);
}

async function runCaptureWithGate(
  lead: Lead,
  leadDir: string,
  state: PipelineState,
  force: boolean
): Promise<{ state: PipelineState; exitCode: number }> {
  const stageName: StageName = "capture";
  const inputHash = hashInputs(lead);
  const metaPath = path.join(leadDir, "capture", "meta.json");
  const previousCaptureHash = state.stages.capture.hash;

  if (state.branch === "no_website") {
    updateStage(state, stageName, { status: "skipped" });
    saveState(state);
    logStage({
      lead_id: lead.lead_id,
      stage: stageName,
      status: "skipped",
      cost: 0,
      message: "no_website branch",
    });
    return { state, exitCode: 0 };
  }

  if (state.stages[stageName].status === "running" && !force) {
    updateStage(state, stageName, { status: "pending" });
    saveState(state);
    logStage({
      lead_id: lead.lead_id,
      stage: stageName,
      status: "reset",
      cost: 0,
      message: "stale running reset to pending",
    });
  }

  if (
    shouldSkip(
      state.stages[stageName],
      inputHash,
      force,
      lead.lead_id,
      leadDir,
      stageName
    )
  ) {
    logStage({
      lead_id: lead.lead_id,
      stage: stageName,
      status: "skipped",
      cost: 0,
      message: "idempotent skip",
    });
    return { state, exitCode: 0 };
  }

  let attempts = 0;
  let lastError = "";

  while (attempts < G1_MAX_ATTEMPTS) {
    attempts += 1;
    const started = Date.now();
    updateStage(state, stageName, {
      status: "running",
      attempts,
      error: undefined,
    });
    saveState(state);

    let captureError: string | undefined;
    let artifact: string | undefined;

    try {
      artifact = await runCapture(lead, leadDir, {
        attempt: attempts - 1,
      });
    } catch (err) {
      captureError = formatCaptureError(lead.lead_id, err);
      logStage({
        lead_id: lead.lead_id,
        stage: stageName,
        status: "error",
        ms: Date.now() - started,
        message: captureError,
      });
    }

    if (existsSync(metaPath)) {
      const gate = runGateG1({ lead_id: lead.lead_id, leadDir });

      if (gate.pass) {
        updateStage(state, stageName, {
          status: "done",
          artifact: artifact ?? "capture/meta.json",
          hash: inputHash,
          cost: 0,
          error: undefined,
        });
        if (
          previousCaptureHash &&
          previousCaptureHash !== inputHash &&
          (state.stages.audit.status === "done" ||
            state.stages.audit.status === "failed")
        ) {
          invalidateAudit(state);
        }
        saveState(state);
        logStage({
          lead_id: lead.lead_id,
          stage: stageName,
          status: "done",
          ms: Date.now() - started,
          cost: 0,
        });
        return { state, exitCode: 0 };
      }

      lastError = formatGateErrors(
        lead.lead_id,
        "capture",
        "G1",
        gate.errors
      );
      logStage({
        lead_id: lead.lead_id,
        stage: stageName,
        status: "gate_fail",
        ms: Date.now() - started,
        message: lastError,
      });
    } else {
      lastError =
        captureError ??
        `lead_id=${lead.lead_id} stage=capture reason=meta missing`;
    }
  }

  updateStage(state, stageName, {
    status: "failed",
    attempts,
    error: lastError,
  });
  saveState(state);
  return { state, exitCode: 1 };
}

function runAuditGate(
  lead: Lead,
  leadDir: string,
  state: PipelineState,
  force: boolean
): { state: PipelineState; exitCode: number } {
  const stageName: StageName = "audit";
  const auditPath = path.join(leadDir, "audit.json");

  if (state.branch === "no_website") {
    updateStage(state, stageName, { status: "skipped" });
    saveState(state);
    logStage({
      lead_id: lead.lead_id,
      stage: stageName,
      status: "skipped",
      cost: 0,
      message: "no_website branch",
    });
    return { state, exitCode: 0 };
  }

  if (state.stages.capture.status !== "done") {
    const error = `lead_id=${lead.lead_id} stage=audit reason=capture not done`;
    updateStage(state, stageName, { status: "failed", error });
    saveState(state);
    logStage({
      lead_id: lead.lead_id,
      stage: stageName,
      status: "failed",
      message: error,
    });
    return { state, exitCode: 1 };
  }

  syncAuditWithCaptureHash(state);

  if (state.stages[stageName].status === "running" && !force) {
    updateStage(state, stageName, { status: "pending" });
    saveState(state);
    logStage({
      lead_id: lead.lead_id,
      stage: stageName,
      status: "reset",
      cost: 0,
      message: "stale running reset to pending",
    });
  }

  const inputHash = state.stages.capture.hash;
  if (!inputHash) {
    const error = `lead_id=${lead.lead_id} stage=audit reason=capture hash missing`;
    updateStage(state, stageName, { status: "failed", error });
    saveState(state);
    return { state, exitCode: 1 };
  }

  if (!existsSync(auditPath)) {
    updateStage(state, stageName, { status: "pending", error: undefined });
    saveState(state);
    logStage({
      lead_id: lead.lead_id,
      stage: stageName,
      status: "awaiting",
      cost: 0,
      message: "awaiting audit.json (agents/audit/PROMPT.md)",
    });
    return { state, exitCode: EXIT_AWAITING_AUDIT };
  }

  if (
    shouldSkip(
      state.stages[stageName],
      inputHash,
      force,
      lead.lead_id,
      leadDir,
      stageName
    )
  ) {
    logStage({
      lead_id: lead.lead_id,
      stage: stageName,
      status: "skipped",
      cost: 0,
      message: "idempotent skip",
    });
    return { state, exitCode: 0 };
  }

  const started = Date.now();
  const attempts = (state.stages[stageName].attempts ?? 0) + 1;
  updateStage(state, stageName, {
    status: "running",
    attempts,
    error: undefined,
  });
  saveState(state);

  const gate = runGateG2({ lead_id: lead.lead_id, leadDir }, state.branch);

  if (gate.pass) {
    updateStage(state, stageName, {
      status: "done",
      artifact: "audit.json",
      hash: inputHash,
      cost: 0,
      error: undefined,
    });
    saveState(state);
    logStage({
      lead_id: lead.lead_id,
      stage: stageName,
      status: "done",
      ms: Date.now() - started,
      cost: 0,
    });
    return { state, exitCode: 0 };
  }

  const lastError = formatGateErrors(
    lead.lead_id,
    "audit",
    "G2",
    gate.errors
  );
  updateStage(state, stageName, {
    status: "failed",
    attempts,
    error: lastError,
  });
  saveState(state);
  logStage({
    lead_id: lead.lead_id,
    stage: stageName,
    status: "gate_fail",
    ms: Date.now() - started,
    message: lastError,
  });
  return { state, exitCode: attempts >= G2_MAX_ATTEMPTS ? 1 : 1 };
}

export async function runPipeline(
  options: PipelineOptions
): Promise<{ state: PipelineState; exitCode: number }> {
  const previousSite = readPreviousSite(options.resolveInput);
  const resolved = resolveLead(options.resolveInput);
  const { lead, leadDir, leadId } = resolved;
  const currentSite = normalizeStoredSite(lead.site);
  const siteChanged = !sitesEqual(previousSite, currentSite);

  let state: PipelineState;

  if (!existsSync(stateFile(leadId))) {
    const branch = await decideBranch(lead);
    state = initState(leadId, branch);
    saveState(state);
  } else {
    try {
      state = loadState(leadId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Corrupt state.json for ${leadId}: ${message}`);
    }

    if (siteChanged) {
      const newBranch = await decideBranch(lead);
      if (newBranch !== state.branch) {
        logStage({
          lead_id: leadId,
          stage: "routing",
          status: "branch_migrate",
          message: `site changed: ${state.branch} -> ${newBranch}`,
        });
        state = migrateBranchState(state, newBranch);
      } else {
        state = repairBranchStages(state);
      }
    } else {
      state = repairBranchStages(state);
    }
    saveState(state);
  }

  const targetStage = options.stage ?? "capture";
  const force = options.force ?? false;

  switch (targetStage) {
    case "capture":
      return runCaptureWithGate(lead, leadDir, state, force);
    case "audit":
      return runAuditGate(lead, leadDir, state, force);
    default:
      throw new Error(
        `M2 milestone implements capture and audit stages (got ${targetStage})`
      );
  }
}
