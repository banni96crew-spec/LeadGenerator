import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  invalidateDesign,
  invalidatePublish,
  runPublishGate,
  syncOfferWithPublishHash,
  syncPublishWithDesignHash,
} from "./pipeline.js";
import { initState, saveState } from "./state.js";
import { leadDir as resolveLeadDir } from "../lib/paths.js";
import type { Lead } from "../lib/types.js";

function writeDeploy(leadDir: string, checks: Record<string, unknown>): void {
  writeFileSync(
    path.join(leadDir, "deploy.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        demo_url: "https://t.leadgenerator-demos.pages.dev",
        checks,
      },
      null,
      2
    )
  );
}

describe("syncPublishWithDesignHash", () => {
  it("invalidates publish when design hash diverges", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-sync-pub-"));
    writeDeploy(leadDir, {
      http_200: true,
      no_console_errors: true,
      lighthouse_perf: 90,
    });
    const state = initState("sync-pub", "has_website");
    state.stages.design = {
      status: "done",
      hash: "des-new",
      artifact: "design/build.json",
    };
    state.stages.publish = {
      status: "done",
      hash: "des-old",
      artifact: "deploy.json",
      cost: 0,
      attempts: 1,
    };

    syncPublishWithDesignHash(state, leadDir);

    assert.equal(state.stages.publish.status, "pending");
    assert.equal(state.stages.publish.hash, undefined);
    assert.equal(state.stages.publish.artifact, undefined);
    assert.equal(existsSync(path.join(leadDir, "deploy.json")), false);
    assert.equal(state.stages.design.status, "done");
    assert.equal(state.stages.design.hash, "des-new");
  });

  it("does nothing when hashes match", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-sync-pub-"));
    writeDeploy(leadDir, {
      http_200: true,
      no_console_errors: true,
      lighthouse_perf: 90,
    });
    const state = initState("sync-same", "has_website");
    state.stages.design = {
      status: "done",
      hash: "des-1",
      artifact: "design/build.json",
    };
    state.stages.publish = {
      status: "done",
      hash: "des-1",
      artifact: "deploy.json",
    };

    syncPublishWithDesignHash(state, leadDir);

    assert.equal(state.stages.publish.status, "done");
    assert.equal(state.stages.publish.hash, "des-1");
    assert.equal(existsSync(path.join(leadDir, "deploy.json")), true);
  });
});

describe("invalidateDesign cascade", () => {
  it("resets design and publish and deletes deploy.json", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-inv-des-"));
    const designDir = path.join(leadDir, "design");
    mkdirSync(designDir, { recursive: true });
    writeFileSync(path.join(designDir, "critic.json"), "{}");
    writeDeploy(leadDir, {
      http_200: true,
      no_console_errors: true,
      lighthouse_perf: 90,
    });

    const state = initState("inv-des", "has_website");
    state.stages.design = {
      status: "done",
      hash: "des-1",
      artifact: "design/build.json",
    };
    state.stages.publish = {
      status: "done",
      hash: "des-1",
      artifact: "deploy.json",
      error: "stale",
    };
    state.stages.offer = {
      status: "done",
      hash: "des-1",
      artifact: "offer/offer.json",
    };

    invalidateDesign(state, leadDir);

    assert.equal(state.stages.design.status, "pending");
    assert.equal(state.stages.design.hash, undefined);
    assert.equal(state.stages.publish.status, "pending");
    assert.equal(state.stages.publish.hash, undefined);
    assert.equal(state.stages.publish.error, undefined);
    assert.equal(state.stages.offer.status, "pending");
    assert.equal(state.stages.offer.hash, undefined);
    assert.equal(existsSync(path.join(leadDir, "deploy.json")), false);
    assert.equal(existsSync(path.join(designDir, "critic.json")), false);
  });
});

describe("invalidatePublish → offer cascade", () => {
  it("resets offer and deletes offer.json + offer.md", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-inv-pub-offer-"));
    const offerDir = path.join(leadDir, "offer");
    mkdirSync(offerDir, { recursive: true });
    writeDeploy(leadDir, {
      http_200: true,
      no_console_errors: true,
      lighthouse_perf: 90,
    });
    writeFileSync(path.join(offerDir, "offer.json"), "{}");
    writeFileSync(path.join(offerDir, "offer.md"), "text");
    writeFileSync(path.join(offerDir, "audit.pdf"), "%PDF");

    const state = initState("inv-pub-offer", "has_website");
    state.stages.publish = {
      status: "done",
      hash: "pub-1",
      artifact: "deploy.json",
    };
    state.stages.offer = {
      status: "done",
      hash: "pub-1",
      artifact: "offer/offer.json",
      error: "stale",
    };

    invalidatePublish(state, leadDir);

    assert.equal(state.stages.publish.status, "pending");
    assert.equal(state.stages.offer.status, "pending");
    assert.equal(state.stages.offer.hash, undefined);
    assert.equal(state.stages.offer.artifact, undefined);
    assert.equal(state.stages.offer.error, undefined);
    assert.equal(existsSync(path.join(offerDir, "offer.json")), false);
    assert.equal(existsSync(path.join(offerDir, "offer.md")), false);
    assert.equal(existsSync(path.join(offerDir, "audit.pdf")), true);
  });
});

describe("syncOfferWithPublishHash", () => {
  it("invalidates offer when publish hash diverges", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-sync-offer-"));
    const offerDir = path.join(leadDir, "offer");
    mkdirSync(offerDir, { recursive: true });
    writeFileSync(path.join(offerDir, "offer.json"), "{}");

    const state = initState("sync-offer", "has_website");
    state.stages.publish = {
      status: "done",
      hash: "pub-new",
      artifact: "deploy.json",
    };
    state.stages.offer = {
      status: "done",
      hash: "pub-old",
      artifact: "offer/offer.json",
    };

    syncOfferWithPublishHash(state, leadDir);

    assert.equal(state.stages.offer.status, "pending");
    assert.equal(state.stages.offer.hash, undefined);
    assert.equal(existsSync(path.join(offerDir, "offer.json")), false);
    assert.equal(state.stages.publish.status, "done");
    assert.equal(state.stages.publish.hash, "pub-new");
  });

  it("does nothing when hashes match", () => {
    const state = initState("sync-offer-same", "has_website");
    state.stages.publish = {
      status: "done",
      hash: "pub-1",
      artifact: "deploy.json",
    };
    state.stages.offer = {
      status: "done",
      hash: "pub-1",
      artifact: "offer/offer.json",
    };

    syncOfferWithPublishHash(state);

    assert.equal(state.stages.offer.status, "done");
    assert.equal(state.stages.offer.hash, "pub-1");
  });
});

describe("runPublishGate design precondition", () => {
  const leadId = "t7-publish-design-pending";
  const dir = resolveLeadDir(leadId);

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails with diagnostic when design is not done (no live deploy)", async () => {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });

    const lead: Lead = {
      schema_version: "1.0",
      lead_id: leadId,
      name: "T7 Publish Gate",
      site: "https://example.com",
    };
    writeFileSync(path.join(dir, "lead.json"), JSON.stringify(lead, null, 2));

    const state = initState(leadId, "has_website");
    assert.equal(state.stages.design.status, "pending");
    saveState(state);

    const result = await runPublishGate(lead, dir, state, false);

    assert.equal(result.exitCode, 1);
    assert.equal(result.state.stages.publish.status, "failed");
    assert.ok(
      result.state.stages.publish.error?.includes("design not done"),
      result.state.stages.publish.error
    );
    assert.ok(
      result.state.stages.publish.error?.includes(`lead_id=${leadId}`)
    );
    assert.equal(existsSync(path.join(dir, "deploy.json")), false);
  });
});

describe("runPublishGate leadDir path + retry budget", () => {
  const pathLeadId = "t10-pub-path-lead";
  const forceLeadId = "t10-pub-force-lead";
  const capLeadId = "t10-pub-cap-lead";
  const pathDir = resolveLeadDir(pathLeadId);
  const forceDir = resolveLeadDir(forceLeadId);
  const capDir = resolveLeadDir(capLeadId);

  const passingChecks = {
    http_200: true,
    no_console_errors: true,
    lighthouse_perf: 90,
  };

  after(() => {
    for (const dir of [pathDir, forceDir, capDir]) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function designDoneState(leadId: string): ReturnType<typeof initState> {
    const state = initState(leadId, "has_website");
    state.stages.design = {
      status: "done",
      hash: "des-hash-1",
      artifact: "design/build.json",
    };
    return state;
  }

  function prepareLead(leadId: string, dir: string, name: string): Lead {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const lead: Lead = {
      schema_version: "1.0",
      lead_id: leadId,
      name,
      site: "https://example.com",
    };
    writeFileSync(path.join(dir, "lead.json"), JSON.stringify(lead, null, 2));
    return lead;
  }

  it("reads deploy.json under leadDir when runPublish returns a relative artifact", async () => {
    const lead = prepareLead(pathLeadId, pathDir, "Path Lead");
    // Ensure CWD has no deploy.json — relative read would fail without leadDir join.
    assert.equal(existsSync(path.join(process.cwd(), "deploy.json")), false);

    const state = designDoneState(pathLeadId);
    let readFromLeadDir = false;

    const result = await runPublishGate(lead, pathDir, state, false, {
      runPublish: async () => {
        writeDeploy(pathDir, passingChecks);
        return "deploy.json";
      },
      smokeTestUrl: async (_url, dir) => {
        readFromLeadDir = existsSync(path.join(dir, "deploy.json"));
        return { pass: true, checks: passingChecks, errors: [] };
      },
      runGateG5: () => ({ pass: true, gate: "G5", errors: [] }),
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.state.stages.publish.status, "done");
    assert.equal(readFromLeadDir, true);
    assert.equal(existsSync(path.join(pathDir, "deploy.json")), true);
  });

  it("re-enters retry loop when persisted attempts already exhausted", async () => {
    const lead = prepareLead(forceLeadId, forceDir, "Force Lead");

    const state = designDoneState(forceLeadId);
    state.stages.publish = {
      status: "failed",
      hash: undefined,
      artifact: undefined,
      attempts: 2,
      error: "previous exhaustion",
    };

    let publishCalls = 0;
    const result = await runPublishGate(lead, forceDir, state, true, {
      runPublish: async () => {
        publishCalls += 1;
        writeDeploy(forceDir, passingChecks);
        return "deploy.json";
      },
      smokeTestUrl: async () => ({
        pass: true,
        checks: passingChecks,
        errors: [],
      }),
      runGateG5: () => ({ pass: true, gate: "G5", errors: [] }),
    });

    assert.equal(publishCalls, 1, "must enter loop despite persisted attempts=2");
    assert.equal(result.exitCode, 0);
    assert.equal(result.state.stages.publish.status, "done");
  });

  it("still caps at 2 cycles per invocation", async () => {
    const lead = prepareLead(capLeadId, capDir, "Cap Lead");

    const state = designDoneState(capLeadId);
    state.stages.publish = {
      status: "failed",
      attempts: 2,
      error: "previous exhaustion",
    };

    let publishCalls = 0;
    const result = await runPublishGate(lead, capDir, state, false, {
      runPublish: async () => {
        publishCalls += 1;
        throw new Error("deploy boom");
      },
    });

    assert.equal(publishCalls, 2);
    assert.equal(result.exitCode, 1);
    assert.equal(result.state.stages.publish.status, "failed");
    assert.equal(result.state.stages.publish.attempts, 2);
  });
});
