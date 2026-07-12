import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { hashInputs } from "../lib/hash.js";
import { logStage } from "../lib/log.js";
import { runGateG1 } from "../gates/g1Capture.js";
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

function formatGateErrors(leadId: string, errors: string[]): string {
  return (
    errors.join("; ") ||
    `lead_id=${leadId} stage=capture gate=G1 reason=unknown`
  );
}

function formatCaptureError(leadId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `lead_id=${leadId} stage=capture reason=${message}`;
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

      lastError = formatGateErrors(lead.lead_id, gate.errors);
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
  if (targetStage !== "capture") {
    throw new Error(
      `Foundation milestone only implements capture stage (got ${targetStage})`
    );
  }

  return runCaptureWithGate(lead, leadDir, state, options.force ?? false);
}
