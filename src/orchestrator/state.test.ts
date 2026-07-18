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
        vertical: "construction",
        footer_tagline: "Премиум-строительство.",
        sections: {
          hero: {
            headline: "Дом под ключ",
            subheadline: "Фиксированная смета",
            cta_primary: "Рассчитать проект",
            cta_secondary: "Смотреть дома",
          },
          proof: [
            { value: "A", label: "a" },
            { value: "B", label: "b" },
            { value: "C", label: "c" },
            { value: "D", label: "d" },
          ],
          approach: {
            eyebrow: "Подход",
            h2: "Как работаем",
            prose: "Один контур на объект.",
            steps: [
              { title: "S1", text: "t1" },
              { title: "S2", text: "t2" },
              { title: "S3", text: "t3" },
              { title: "S4", text: "t4" },
            ],
          },
          projects: {
            eyebrow: "Проекты",
            h2: "Кейсы",
            lead: "Истории участков.",
            items: [
              { title: "W1", text: "w1" },
              { title: "W2", text: "w2" },
              { title: "W3", text: "w3" },
            ],
          },
          materials: {
            eyebrow: "Материалы",
            h2: "Спецификация",
            prose: "До старта.",
            items: ["i1", "i2", "i3"],
          },
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

function writePassingDeploy(leadDir: string): void {
  writeFileSync(
    path.join(leadDir, "deploy.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        demo_url: "https://t.leadgenerator-demos.pages.dev",
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

describe("shouldSkip publish", () => {
  it("skips when done, design hash matches, and G5 would pass", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-state-pub-"));
    const leadId = "pub-skip";
    writePassingDeploy(leadDir);
    const state = initState(leadId, "has_website");
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
    assert.equal(
      shouldSkip(
        state.stages.publish,
        "des-1",
        false,
        leadId,
        leadDir,
        "publish"
      ),
      true
    );
  });

  it("does not skip when checks broken (G5 fail)", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-state-pub-"));
    const leadId = "pub-noskip";
    writeFileSync(
      path.join(leadDir, "deploy.json"),
      JSON.stringify(
        {
          schema_version: "1.0",
          demo_url: "https://t.leadgenerator-demos.pages.dev",
          checks: {},
        },
        null,
        2
      )
    );
    const state = initState(leadId, "has_website");
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
    assert.equal(
      shouldSkip(
        state.stages.publish,
        "des-1",
        false,
        leadId,
        leadDir,
        "publish"
      ),
      false
    );
  });

  it("does not skip when force=true", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-state-pub-"));
    const leadId = "pub-force";
    writePassingDeploy(leadDir);
    const state = initState(leadId, "has_website");
    state.stages.publish = {
      status: "done",
      hash: "des-1",
      artifact: "deploy.json",
    };
    assert.equal(
      shouldSkip(
        state.stages.publish,
        "des-1",
        true,
        leadId,
        leadDir,
        "publish"
      ),
      false
    );
  });
});

describe("shouldSkip offer", () => {
  const DEMO = "https://g4-verify-construction.leadgenerator-7sp.pages.dev";

  function writeValidOffer(leadDir: string): void {
    writePassingDeploy(leadDir);
    // Override demo_url to match portfolio allowlist URL used below
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
    mkdirSync(path.join(leadDir, "offer"), { recursive: true });
    writeFileSync(
      path.join(leadDir, "offer", "offer.json"),
      JSON.stringify(
        {
          schema_version: "1.0",
          message: "Короткое персональное предложение.",
          usp: ["Демо"],
          why_this_company: "Слабый CTA на сайте.",
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
    writeFileSync(path.join(leadDir, "offer", "offer.md"), "# Offer\n\nТекст.\n");
    writeFileSync(path.join(leadDir, "offer", "audit.pdf"), "%PDF-1.4");
  }

  it("skips when done, publish hash matches, and local offer artifacts valid", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-state-offer-"));
    const leadId = "offer-skip";
    writeValidOffer(leadDir);
    const state = initState(leadId, "has_website");
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
    assert.equal(
      shouldSkip(
        state.stages.offer,
        "pub-1",
        false,
        leadId,
        leadDir,
        "offer"
      ),
      true
    );
  });

  it("does not skip when offer.md missing", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-state-offer-"));
    const leadId = "offer-noskip";
    writeValidOffer(leadDir);
    writeFileSync(path.join(leadDir, "offer", "offer.md"), "");
    const state = initState(leadId, "has_website");
    state.stages.offer = {
      status: "done",
      hash: "pub-1",
      artifact: "offer/offer.json",
    };
    assert.equal(
      shouldSkip(
        state.stages.offer,
        "pub-1",
        false,
        leadId,
        leadDir,
        "offer"
      ),
      false
    );
  });

  it("idempotent skip does not re-fetch", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-state-offer-"));
    const leadId = "offer-nofetch";
    writeValidOffer(leadDir);
    const state = initState(leadId, "has_website");
    state.stages.offer = {
      status: "done",
      hash: "pub-1",
      artifact: "offer/offer.json",
    };

    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error("shouldSkip(offer) must not fetch");
    }) as typeof fetch;

    try {
      assert.equal(
        shouldSkip(
          state.stages.offer,
          "pub-1",
          false,
          leadId,
          leadDir,
          "offer"
        ),
        true
      );
      assert.equal(fetchCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
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
