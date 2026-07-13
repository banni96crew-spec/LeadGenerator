import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  initState,
  migrateBranchState,
  shouldSkip,
} from "./state.js";
import type { PipelineState, StageName } from "../lib/types.js";

function writeMinimalAudit(leadDir: string, leadId: string): void {
  const captureDir = path.join(leadDir, "capture");
  mkdirSync(captureDir, { recursive: true });
  writeFileSync(path.join(captureDir, "desktop.png"), Buffer.alloc(6000, 1));
  writeFileSync(path.join(captureDir, "text.txt"), "x".repeat(250));
  writeFileSync(
    path.join(leadDir, "audit.json"),
    JSON.stringify({
      schema_version: "1.0",
      lead_id: leadId,
      business_facts: {
        services: ["s"],
        usp_existing: ["u"],
        audience: "a",
      },
      findings: [
        {
          id: "f1",
          category: "доверие",
          claim: "c1",
          evidence: "capture/desktop.png",
          impact: "i1",
          severity: "high",
        },
        {
          id: "f2",
          category: "контент",
          claim: "c2",
          evidence: "capture/text.txt#L10-L12",
          impact: "i2",
          severity: "medium",
        },
        {
          id: "f3",
          category: "конверсия",
          claim: "c3",
          evidence: "capture/desktop.png",
          impact: "i3",
          severity: "low",
        },
      ],
      money_loss_summary: "Краткое резюме потерь.",
    })
  );
}

describe("shouldSkip audit", () => {
  it("skips when done, capture hash matches, and G2 passes", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-state-audit-"));
    const leadId = "skip-co";
    writeMinimalAudit(leadDir, leadId);
    const state = initState(leadId, "has_website");
    state.stages.capture = {
      status: "done",
      hash: "cap-hash-1",
      artifact: "capture/meta.json",
    };
    state.stages.audit = {
      status: "done",
      hash: "cap-hash-1",
      artifact: "audit.json",
    };
    assert.equal(
      shouldSkip(
        state.stages.audit,
        "cap-hash-1",
        false,
        leadId,
        leadDir,
        "audit"
      ),
      true
    );
  });

  it("does not skip when evidence broken (G2 fail)", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-state-audit-"));
    const leadId = "noskip-co";
    writeMinimalAudit(leadDir, leadId);
    writeFileSync(
      path.join(leadDir, "audit.json"),
      JSON.stringify({
        schema_version: "1.0",
        lead_id: leadId,
        business_facts: {
          services: ["s"],
          usp_existing: ["u"],
          audience: "a",
        },
        findings: [
          {
            id: "f1",
            category: "доверие",
            claim: "c1",
            evidence: "capture/missing.png",
            impact: "i1",
            severity: "high",
          },
          {
            id: "f2",
            category: "контент",
            claim: "c2",
            evidence: "capture/text.txt#L10-L12",
            impact: "i2",
            severity: "medium",
          },
          {
            id: "f3",
            category: "конверсия",
            claim: "c3",
            evidence: "capture/desktop.png",
            impact: "i3",
            severity: "low",
          },
        ],
        money_loss_summary: "Краткое резюме потерь.",
      })
    );
    const state = initState(leadId, "has_website");
    state.stages.capture = { status: "done", hash: "cap-hash-1" };
    state.stages.audit = {
      status: "done",
      hash: "cap-hash-1",
      artifact: "audit.json",
    };
    assert.equal(
      shouldSkip(
        state.stages.audit,
        "cap-hash-1",
        false,
        leadId,
        leadDir,
        "audit"
      ),
      false
    );
  });

  it("does not skip when force=true", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-state-audit-"));
    const leadId = "force-co";
    writeMinimalAudit(leadDir, leadId);
    const state = initState(leadId, "has_website");
    state.stages.capture = { status: "done", hash: "cap-hash-1" };
    state.stages.audit = {
      status: "done",
      hash: "cap-hash-1",
      artifact: "audit.json",
    };
    assert.equal(
      shouldSkip(
        state.stages.audit,
        "cap-hash-1",
        true,
        leadId,
        leadDir,
        "audit"
      ),
      false
    );
  });
});

function doneCaptureState(branch: "has_website" | "no_website"): PipelineState {
  const state = initState("test-co", branch);
  state.stages.capture = {
    status: "done",
    artifact: "capture/meta.json",
    hash: "abc123",
    cost: 0,
    attempts: 1,
  };
  return state;
}

describe("shouldSkip copy", () => {
  it("skips when done, audit hash matches, and G3 passes", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-state-copy-"));
    const leadId = "copy-skip";
    writeFileSync(
      path.join(leadDir, "content.json"),
      JSON.stringify({
        schema_version: "1.0",
        vertical: "renovation",
        sections: {
          hero: {
            headline: "Ремонт квартир",
            subheadline: "Смета",
            cta: "Рассчитать",
          },
          benefits: [
            { title: "A", text: "a" },
            { title: "B", text: "b" },
            { title: "C", text: "c" },
          ],
          social_proof: { cases: ["Кейс"] },
          contact: { phone: "+7", cta: "Заявка" },
        },
        reuse_facts: ["факт"],
      })
    );
    const state = initState(leadId, "has_website");
    state.stages.audit = {
      status: "done",
      hash: "aud-1",
      artifact: "audit.json",
    };
    state.stages.copy = {
      status: "done",
      hash: "aud-1",
      artifact: "content.json",
    };
    assert.equal(
      shouldSkip(
        state.stages.copy,
        "aud-1",
        false,
        leadId,
        leadDir,
        "copy"
      ),
      true
    );
  });
});

describe("migrateBranchState", () => {
  it("preserves done capture when branch changes", () => {
    const state = doneCaptureState("has_website");
    const migrated = migrateBranchState(state, "no_website");
    assert.equal(migrated.stages.capture.status, "done");
    assert.equal(migrated.stages.capture.hash, "abc123");
    assert.equal(migrated.branch, "no_website");
  });

  it("flips skipped research to pending on has_website to no_website", () => {
    const state = initState("test-co", "has_website");
    assert.equal(state.stages.research.status, "skipped");
    const migrated = migrateBranchState(state, "no_website");
    assert.equal(migrated.stages.research.status, "pending");
    assert.equal(migrated.stages.audit.status, "skipped");
  });

  it("flips pending audit to skipped on no_website to has_website", () => {
    const state = initState("test-co", "no_website");
    assert.equal(state.stages.audit.status, "skipped");
    state.stages.audit.status = "pending";
    const migrated = migrateBranchState(state, "has_website");
    assert.equal(migrated.stages.audit.status, "pending");
    assert.equal(migrated.stages.research.status, "skipped");
  });

  it("does not reset shared stages copy/design", () => {
    const state = initState("test-co", "has_website");
    state.stages.copy = { status: "failed", error: "prior error" };
    const migrated = migrateBranchState(state, "no_website");
    assert.equal(migrated.stages.copy.status, "failed");
    assert.equal(migrated.stages.copy.error, "prior error");
  });
});

describe("initState branch matrix", () => {
  const matrix: Array<{
    branch: "has_website" | "no_website";
    expected: Partial<Record<StageName, string>>;
  }> = [
    {
      branch: "has_website",
      expected: {
        capture: "pending",
        research: "skipped",
        audit: "pending",
      },
    },
    {
      branch: "no_website",
      expected: {
        capture: "skipped",
        research: "pending",
        audit: "skipped",
      },
    },
  ];

  for (const { branch, expected } of matrix) {
    it(`initializes ${branch} branch stages`, () => {
      const state = initState("matrix-co", branch);
      assert.equal(state.branch, branch);
      for (const [stage, status] of Object.entries(expected)) {
        assert.equal(
          state.stages[stage as StageName].status,
          status,
          `${stage} for ${branch}`
        );
      }
      for (const shared of ["copy", "design", "publish", "offer"] as const) {
        assert.equal(state.stages[shared].status, "pending");
      }
    });
  }
});
