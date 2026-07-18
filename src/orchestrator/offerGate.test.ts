import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { after, afterEach, describe, it } from "node:test";
import { runOfferGate } from "./pipeline.js";
import { initState, saveState } from "./state.js";
import { leadDir as resolveLeadDir } from "../lib/paths.js";
import type { Lead } from "../lib/types.js";

const DEMO = "https://g4-verify-construction.leadgenerator-7sp.pages.dev";
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function writePassingDeploy(leadDir: string): void {
  writeFileSync(
    path.join(leadDir, "deploy.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        demo_url: DEMO,
        checks: {
          http_200: true,
          no_console_errors: true,
          lighthouse_perf: 90,
        },
      },
      null,
      2
    )
  );
}

function writeValidOfferBundle(leadDir: string): void {
  mkdirSync(path.join(leadDir, "offer"), { recursive: true });
  writeFileSync(
    path.join(leadDir, "offer", "offer.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        message: "Короткое персональное предложение для компании.",
        usp: ["Демо под ваш бренд"],
        why_this_company: "На сайте слабый CTA и нет доверия.",
        links: {
          demo: DEMO,
          portfolio: DEMO,
          audit_pdf: "offer/audit.pdf",
        },
      },
      null,
      2
    )
  );
  writeFileSync(
    path.join(leadDir, "offer", "offer.md"),
    "# Offer\n\nТекст предложения.\n"
  );
  writeFileSync(path.join(leadDir, "offer", "audit.pdf"), "%PDF-1.4 test");
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

function publishDoneState(leadId: string): ReturnType<typeof initState> {
  const state = initState(leadId, "has_website");
  state.stages.publish = {
    status: "done",
    hash: "pub-hash-1",
    artifact: "deploy.json",
    cost: 0,
  };
  return state;
}

describe("runOfferGate publish precondition", () => {
  const leadId = "t7-offer-publish-pending";
  const dir = resolveLeadDir(leadId);

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails with diagnostic when publish is not done", async () => {
    const lead = prepareLead(leadId, dir, "T7 Offer Gate");
    const state = initState(leadId, "has_website");
    assert.equal(state.stages.publish.status, "pending");
    saveState(state);

    let pdfCalls = 0;
    let g6Calls = 0;
    const result = await runOfferGate(lead, dir, state, false, {
      generateAuditPdf: async () => {
        pdfCalls += 1;
        return "offer/audit.pdf";
      },
      runGateG6: async () => {
        g6Calls += 1;
        return { pass: true, gate: "G6", errors: [] };
      },
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.state.stages.offer.status, "failed");
    assert.ok(
      result.state.stages.offer.error?.includes("publish not done"),
      result.state.stages.offer.error
    );
    assert.ok(
      result.state.stages.offer.error?.includes(`lead_id=${leadId}`)
    );
    assert.equal(pdfCalls, 0);
    assert.equal(g6Calls, 0);
  });
});

describe("runOfferGate EXIT_AWAITING", () => {
  const missingJsonId = "t7-offer-await-json";
  const missingMdId = "t7-offer-await-md";
  const missingJsonDir = resolveLeadDir(missingJsonId);
  const missingMdDir = resolveLeadDir(missingMdId);

  after(() => {
    for (const dir of [missingJsonDir, missingMdDir]) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns exit 3 when offer.json is missing after PDF", async () => {
    const lead = prepareLead(missingJsonId, missingJsonDir, "Await JSON");
    writePassingDeploy(missingJsonDir);
    mkdirSync(path.join(missingJsonDir, "offer"), { recursive: true });
    writeFileSync(
      path.join(missingJsonDir, "offer", "offer.md"),
      "Текст оффера\n"
    );

    const state = publishDoneState(missingJsonId);
    saveState(state);

    let pdfCalls = 0;
    let g6Calls = 0;
    const result = await runOfferGate(lead, missingJsonDir, state, false, {
      generateAuditPdf: async () => {
        pdfCalls += 1;
        writeFileSync(
          path.join(missingJsonDir, "offer", "audit.pdf"),
          "%PDF"
        );
        return "offer/audit.pdf";
      },
      runGateG6: async () => {
        g6Calls += 1;
        return { pass: true, gate: "G6", errors: [] };
      },
    });

    assert.equal(result.exitCode, 3);
    assert.equal(result.state.stages.offer.status, "pending");
    assert.equal(pdfCalls, 1);
    assert.equal(g6Calls, 0);
  });

  it("returns exit 3 when offer.md is missing after PDF", async () => {
    const lead = prepareLead(missingMdId, missingMdDir, "Await MD");
    writePassingDeploy(missingMdDir);
    mkdirSync(path.join(missingMdDir, "offer"), { recursive: true });
    writeFileSync(
      path.join(missingMdDir, "offer", "offer.json"),
      JSON.stringify(
        {
          schema_version: "1.0",
          message: "Текст",
          usp: ["USP"],
          why_this_company: "Почему",
          links: {
            demo: DEMO,
            portfolio: DEMO,
            audit_pdf: "offer/audit.pdf",
          },
        },
        null,
        2
      )
    );

    const state = publishDoneState(missingMdId);
    saveState(state);

    let pdfCalls = 0;
    let g6Calls = 0;
    const result = await runOfferGate(lead, missingMdDir, state, false, {
      generateAuditPdf: async () => {
        pdfCalls += 1;
        writeFileSync(path.join(missingMdDir, "offer", "audit.pdf"), "%PDF");
        return "offer/audit.pdf";
      },
      runGateG6: async () => {
        g6Calls += 1;
        return { pass: true, gate: "G6", errors: [] };
      },
    });

    assert.equal(result.exitCode, 3);
    assert.equal(result.state.stages.offer.status, "pending");
    assert.equal(pdfCalls, 1);
    assert.equal(g6Calls, 0);
  });
});

describe("runOfferGate idempotent skip", () => {
  const leadId = "t7-offer-skip-nofetch";
  const dir = resolveLeadDir(leadId);

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("skips without calling fetch, generateAuditPdf, or runGateG6", async () => {
    const lead = prepareLead(leadId, dir, "Skip Offer");
    writePassingDeploy(dir);
    writeValidOfferBundle(dir);

    const state = publishDoneState(leadId);
    state.stages.offer = {
      status: "done",
      hash: "pub-hash-1",
      artifact: "offer/offer.json",
      cost: 0,
    };
    saveState(state);

    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error("idempotent skip must not fetch");
    }) as typeof fetch;

    let pdfCalls = 0;
    let g6Calls = 0;
    const result = await runOfferGate(lead, dir, state, false, {
      generateAuditPdf: async () => {
        pdfCalls += 1;
        throw new Error("idempotent skip must not generate PDF");
      },
      runGateG6: async () => {
        g6Calls += 1;
        throw new Error("idempotent skip must not run G6");
      },
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.state.stages.offer.status, "done");
    assert.equal(fetchCalls, 0);
    assert.equal(pdfCalls, 0);
    assert.equal(g6Calls, 0);
    assert.equal(existsSync(path.join(dir, "offer", "offer.json")), true);
  });
});
