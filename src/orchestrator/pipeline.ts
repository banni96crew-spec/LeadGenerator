import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { hashInputs } from "../lib/hash.js";
import { logStage } from "../lib/log.js";
import { runGateG1 } from "../gates/g1Capture.js";
import { runGateG2 } from "../gates/g2Audit.js";
import { runGateG3 } from "../gates/g3Copy.js";
import { runGateG4 } from "../gates/g4Design.js";
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
import { assembleDesign } from "../steps/design/assemble.js";
import { renderPreview } from "../steps/design/renderPreview.js";
import type { Lead, PipelineState, StageName } from "../lib/types.js";

// G1_MAX_ATTEMPTS=3: 1 primary capture + 2 retries per CONVENTIONS
const G1_MAX_ATTEMPTS = 3;
// G2 audit gate-only invocations (A1: agent fixes audit.json between runs)
const G2_MAX_ATTEMPTS = 3;
const G3_MAX_ATTEMPTS = 2;
const G4_MAX_ATTEMPTS = 2;
/** A1 seam: agent artifact missing (audit/content/design/critic) */
const EXIT_AWAITING = 3;

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

function resetStagePending(state: PipelineState, name: StageName): void {
  updateStage(state, name, {
    status: "pending",
    hash: undefined,
    artifact: undefined,
    error: undefined,
    attempts: undefined,
    cost: undefined,
  });
}

function clearDesignGateArtifacts(leadDir: string): void {
  for (const rel of [
    "design/preview-desktop.png",
    "design/preview-mobile.png",
    "design/critic.json",
  ]) {
    const abs = path.join(leadDir, rel);
    if (existsSync(abs)) {
      try {
        unlinkSync(abs);
      } catch {
        /* ignore */
      }
    }
  }
}

function invalidateDesign(state: PipelineState, leadDir?: string): void {
  if (leadDir) clearDesignGateArtifacts(leadDir);
  resetStagePending(state, "design");
}

function invalidateCopy(state: PipelineState, leadDir?: string): void {
  resetStagePending(state, "copy");
  invalidateDesign(state, leadDir);
}

function invalidateAudit(state: PipelineState, leadDir?: string): void {
  resetStagePending(state, "audit");
  invalidateCopy(state, leadDir);
}

function syncAuditWithCaptureHash(
  state: PipelineState,
  leadDir?: string
): void {
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
  invalidateAudit(state, leadDir);
}

function syncCopyWithUpstreamHash(
  state: PipelineState,
  leadDir?: string
): void {
  const upstream =
    state.branch === "has_website"
      ? state.stages.audit.hash
      : state.stages.research.hash;
  const copyStage = state.stages.copy;
  if (
    !upstream ||
    !copyStage.hash ||
    copyStage.hash === upstream ||
    (copyStage.status !== "done" && copyStage.status !== "failed")
  ) {
    return;
  }
  invalidateCopy(state, leadDir);
}

function syncDesignWithCopyHash(
  state: PipelineState,
  leadDir?: string
): void {
  const copyHash = state.stages.copy.hash;
  const designStage = state.stages.design;
  if (
    !copyHash ||
    !designStage.hash ||
    designStage.hash === copyHash ||
    (designStage.status !== "done" && designStage.status !== "failed")
  ) {
    return;
  }
  invalidateDesign(state, leadDir);
}

function getCopyUpstreamHash(state: PipelineState): string | undefined {
  if (state.branch === "has_website") {
    return state.stages.audit.hash;
  }
  return state.stages.research.hash;
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
          invalidateAudit(state, leadDir);
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

  syncAuditWithCaptureHash(state, leadDir);

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
    return { state, exitCode: EXIT_AWAITING };
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

function runCopyGate(
  lead: Lead,
  leadDir: string,
  state: PipelineState,
  force: boolean
): { state: PipelineState; exitCode: number } {
  const stageName: StageName = "copy";
  const contentPath = path.join(leadDir, "content.json");

  const upstreamDone =
    state.branch === "has_website"
      ? state.stages.audit.status === "done"
      : state.stages.research.status === "done";

  if (!upstreamDone) {
    const reason =
      state.branch === "has_website"
        ? "audit not done"
        : "research not done";
    const error = `lead_id=${lead.lead_id} stage=copy reason=${reason}`;
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

  syncCopyWithUpstreamHash(state, leadDir);

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

  const inputHash = getCopyUpstreamHash(state);
  if (!inputHash) {
    const error = `lead_id=${lead.lead_id} stage=copy reason=upstream hash missing`;
    updateStage(state, stageName, { status: "failed", error });
    saveState(state);
    return { state, exitCode: 1 };
  }

  if (!existsSync(contentPath)) {
    updateStage(state, stageName, { status: "pending", error: undefined });
    saveState(state);
    logStage({
      lead_id: lead.lead_id,
      stage: stageName,
      status: "awaiting",
      cost: 0,
      message: "awaiting content.json (agents/copy/PROMPT.md)",
    });
    return { state, exitCode: EXIT_AWAITING };
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

  const gate = runGateG3({ lead_id: lead.lead_id, leadDir });

  if (gate.pass) {
    updateStage(state, stageName, {
      status: "done",
      artifact: "content.json",
      hash: inputHash,
      cost: 0,
      error: undefined,
    });
    // Content revalidated — design must re-run (previews/critic may be stale)
    invalidateDesign(state, leadDir);
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
    "copy",
    "G3",
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
  return { state, exitCode: attempts >= G3_MAX_ATTEMPTS ? 1 : 1 };
}

async function runDesignGate(
  lead: Lead,
  leadDir: string,
  state: PipelineState,
  force: boolean
): Promise<{ state: PipelineState; exitCode: number }> {
  const stageName: StageName = "design";
  const criticPath = path.join(leadDir, "design", "critic.json");

  if (state.stages.copy.status !== "done") {
    const error = `lead_id=${lead.lead_id} stage=design reason=copy not done`;
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

  syncDesignWithCopyHash(state, leadDir);

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

  const inputHash = state.stages.copy.hash;
  if (!inputHash) {
    const error = `lead_id=${lead.lead_id} stage=design reason=copy hash missing`;
    updateStage(state, stageName, { status: "failed", error });
    saveState(state);
    return { state, exitCode: 1 };
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

  try {
    await assembleDesign(leadDir);
    await renderPreview(leadDir);
    // Rebuild always invalidates prior critic — LLM must re-score fresh previews.
    if (existsSync(criticPath)) {
      unlinkSync(criticPath);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const lastError = `lead_id=${lead.lead_id} stage=design gate=G4 reason=assemble/renderPreview ${message}`;
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
    return { state, exitCode: 1 };
  }

  const codeGate = runGateG4(
    { lead_id: lead.lead_id, leadDir },
    { codeOnly: true }
  );
  if (!codeGate.pass) {
    const lastError = formatGateErrors(
      lead.lead_id,
      "design",
      "G4",
      codeGate.errors
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
    return { state, exitCode: attempts >= G4_MAX_ATTEMPTS ? 1 : 1 };
  }

  if (!existsSync(criticPath)) {
    updateStage(state, stageName, { status: "pending", error: undefined });
    saveState(state);
    logStage({
      lead_id: lead.lead_id,
      stage: stageName,
      status: "awaiting",
      cost: 0,
      ms: Date.now() - started,
      message: "awaiting design/critic.json (agents/design-critic/PROMPT.md)",
    });
    return { state, exitCode: EXIT_AWAITING };
  }

  const gate = runGateG4({ lead_id: lead.lead_id, leadDir });
  if (gate.pass) {
    updateStage(state, stageName, {
      status: "done",
      artifact: "design/build.json",
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
    "design",
    "G4",
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
  return { state, exitCode: attempts >= G4_MAX_ATTEMPTS ? 1 : 1 };
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
    case "copy":
      return runCopyGate(lead, leadDir, state, force);
    case "design":
      return runDesignGate(lead, leadDir, state, force);
    default:
      throw new Error(
        `M3 milestone implements capture|audit|copy|design (got ${targetStage})`
      );
  }
}
