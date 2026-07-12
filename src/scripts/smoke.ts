import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { runPipeline } from "../orchestrator/pipeline.js";
import { initState } from "../orchestrator/state.js";
import { leadDir, leadFile } from "../lib/paths.js";
import { assertValid } from "../gates/validate.js";
import { getInitialStageStatus, type PipelineState, type StageName } from "../lib/types.js";

type Check = { name: string; pass: boolean; detail?: string };

const checks: Check[] = [];

function record(name: string, pass: boolean, detail?: string): void {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function loadState(leadId: string): PipelineState {
  const state = JSON.parse(
    readFileSync(path.join(leadDir(leadId), "state.json"), "utf8")
  ) as PipelineState;
  assertValid(state, "state");
  return state;
}

function assertBranchMatrix(state: PipelineState): boolean {
  for (const stage of [
    "capture",
    "research",
    "audit",
    "copy",
    "design",
    "publish",
    "offer",
  ] as StageName[]) {
    const expected = getInitialStageStatus(stage, state.branch);
    if (state.stages[stage].status !== expected) {
      return false;
    }
  }
  return true;
}

try {
  execSync("npm run typecheck", { stdio: "pipe", cwd: process.cwd() });
  execSync("npm run validate-schemas", { stdio: "pipe", cwd: process.cwd() });
  record("preflight", true, "typecheck + validate-schemas");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  record("preflight", false, message.slice(0, 120));
}

const bareDomain = await runPipeline({
  resolveInput: {
    kind: "data",
    data: { name: "Bare Domain Co", site: "example.com" },
  },
});
const bareLead = JSON.parse(
  readFileSync(leadFile(bareDomain.state.lead_id), "utf8")
);
assertValid(bareLead, "lead");
record(
  "bare_domain",
  bareLead.site === "https://example.com" &&
    bareDomain.state.branch === "has_website" &&
    existsSync(leadFile(bareDomain.state.lead_id)),
  `site=${bareLead.site} branch=${bareDomain.state.branch}`
);

const noSite = await runPipeline({
  resolveInput: { kind: "data", data: { name: "NoSite Co" } },
});
const noSiteState = loadState(noSite.state.lead_id);
record(
  "no_website",
  noSite.exitCode === 0 &&
    noSiteState.branch === "no_website" &&
    noSiteState.stages.capture.status === "skipped" &&
    noSiteState.stages.research.status === "pending" &&
    noSiteState.stages.audit.status === "skipped",
  `branch=${noSiteState.branch}`
);

record(
  "branch_matrix_no_website",
  assertBranchMatrix(noSiteState),
  `branch=${noSiteState.branch}`
);

const probeFail = await runPipeline({
  resolveInput: {
    kind: "data",
    data: {
      name: "Bad URL Co",
      site: "https://this-domain-does-not-exist-xyz123.invalid",
    },
  },
});
const badState = loadState(probeFail.state.lead_id);
record(
  "probe_fail",
  probeFail.exitCode === 0 &&
    badState.branch === "no_website" &&
    badState.stages.capture.status === "skipped",
  `branch=${badState.branch} capture=${badState.stages.capture.status}`
);

if (existsSync(path.join(leadDir("domeo"), "state.json"))) {
  const sticky = await runPipeline({
    resolveInput: { kind: "lead", path: leadDir("domeo") },
    stage: "capture",
  });
  record(
    "branch_sticky",
    sticky.exitCode === 0 && sticky.state.stages.capture.status === "done",
    "domeo re-run without force keeps done"
  );

  const idem = await runPipeline({
    resolveInput: { kind: "lead", path: leadDir("domeo") },
    stage: "capture",
  });
  record(
    "idempotency_skip",
    idem.exitCode === 0 && idem.state.stages.capture.status === "done",
    "re-run without force"
  );

  const domeoBeforeForce = loadState("domeo");
  const attemptsBefore = domeoBeforeForce.stages.capture.attempts ?? 0;
  const forceRun = await runPipeline({
    resolveInput: { kind: "lead", path: leadDir("domeo") },
    stage: "capture",
    force: true,
  });
  const domeoAfterForce = loadState("domeo");
  record(
    "force_rerun",
    forceRun.exitCode === 0 &&
      domeoAfterForce.stages.capture.status === "done" &&
      (domeoAfterForce.stages.capture.attempts ?? 0) >= attemptsBefore,
    `attempts=${domeoAfterForce.stages.capture.attempts}`
  );

  const failedStatePath = path.join(leadDir("domeo"), "state.json");
  const failedBackup = readFileSync(failedStatePath, "utf8");
  try {
    const failedState = loadState("domeo");
    failedState.stages.capture = {
      status: "failed",
      error: "smoke injected failure",
      attempts: 3,
    };
    writeFileSync(failedStatePath, JSON.stringify(failedState, null, 2));
    const retry = await runPipeline({
      resolveInput: { kind: "lead", path: leadDir("domeo") },
      stage: "capture",
    });
    record(
      "failed_retry",
      retry.state.stages.capture.status !== "skipped" &&
        (retry.state.stages.capture.status === "done" ||
          retry.state.stages.capture.status === "failed"),
      `status=${retry.state.stages.capture.status}`
    );
  } finally {
    writeFileSync(failedStatePath, failedBackup);
    await runPipeline({
      resolveInput: { kind: "lead", path: leadDir("domeo") },
      stage: "capture",
    });
  }

  const domeoState = loadState("domeo");
  const hasWebsiteInit = initState("smoke-matrix-hw", "has_website");
  record(
    "branch_matrix_has_website",
    assertBranchMatrix(hasWebsiteInit),
    `branch=${hasWebsiteInit.branch}`
  );

  record(
    "domeo_done",
    domeoState.stages.capture.status === "done",
    `status=${domeoState.stages.capture.status}`
  );

  const domeoMeta = JSON.parse(
    readFileSync(path.join(leadDir("domeo"), "capture", "meta.json"), "utf8")
  );
  assertValid(domeoMeta, "capture-meta");
  record(
    "domeo_meta",
    !("brand_hints" in domeoMeta),
    "no brand_hints in meta"
  );
} else {
  record("branch_sticky", false, "leads/domeo fixture missing");
  record("idempotency_skip", false, "leads/domeo fixture missing");
  record("force_rerun", false, "leads/domeo fixture missing");
  record("failed_retry", false, "leads/domeo fixture missing");
  record("branch_matrix_has_website", false, "leads/domeo fixture missing");
  record("domeo_done", false, "leads/domeo fixture missing");
  record("domeo_meta", false, "leads/domeo fixture missing");
}

const example = await runPipeline({
  resolveInput: {
    kind: "data",
    data: { name: "GitHub Demo", site: "https://github.com" },
  },
  force: true,
});
const exampleState = loadState(example.state.lead_id);
const exampleDesktop = path.join(leadDir(example.state.lead_id), "capture", "desktop.png");
record(
  "second_site",
  example.exitCode === 0 &&
    exampleState.stages.capture.status === "done" &&
    existsSync(exampleDesktop),
  `status=${exampleState.stages.capture.status}`
);

const failed = checks.filter((c) => !c.pass).length;
console.log(`\nSmoke summary: ${checks.length - failed}/${checks.length} passed`);
process.exit(failed > 0 ? 1 : 0);
