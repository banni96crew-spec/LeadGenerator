import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { runGateG6 } from "./g6Offer.js";

const originalFetch = globalThis.fetch;

const DEMO = "https://g4-verify-construction.leadgenerator-7sp.pages.dev";
const PORTFOLIO = "https://g4-verify-construction.leadgenerator-7sp.pages.dev";

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetchSequence(
  responses: Array<{ status: number } | { throw: Error }>
): void {
  let i = 0;
  globalThis.fetch = (async () => {
    const next = responses[i] ?? { status: 500 };
    i += 1;
    if ("throw" in next) throw next.throw;
    return new Response(null, { status: next.status });
  }) as typeof fetch;
}

function setupLead(leadId = "acme"): string {
  const root = mkdtempSync(path.join(tmpdir(), "lg-g6-"));
  const leadDir = path.join(root, leadId);
  mkdirSync(path.join(leadDir, "offer"), { recursive: true });
  writeFileSync(path.join(leadDir, "offer", "audit.pdf"), "%PDF-1.4 test");
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
  writeFileSync(
    path.join(leadDir, "lead.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        lead_id: leadId,
        name: "Акме Строй",
      },
      null,
      2
    )
  );
  return leadDir;
}

function writeOffer(
  leadDir: string,
  offer: Record<string, unknown>,
  md = "Оффер для клиента.\n"
): void {
  writeFileSync(
    path.join(leadDir, "offer", "offer.json"),
    JSON.stringify(offer, null, 2)
  );
  writeFileSync(path.join(leadDir, "offer", "offer.md"), md);
}

function validOffer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "1.0",
    message:
      "Добрый день, Акме Строй! Подготовили разбор сайта и демо-страницу — удобно показать команде.",
    usp: ["Фиксированная смета до старта", "Еженедельный отчёт"],
    why_this_company:
      "У Акме Строй сильная экспертиза, но на сайте сложно сразу увидеть следующий шаг для клиента.",
    links: {
      demo: DEMO,
      portfolio: PORTFOLIO,
      audit_pdf: "offer/audit.pdf",
    },
    ...overrides,
  };
}

describe("runGateG6", () => {
  it("passes with schema-valid offer, offer.md, links 200, tone clean", async () => {
    const leadDir = setupLead("acme");
    writeOffer(leadDir, validOffer());
    mockFetchSequence([{ status: 200 }, { status: 200 }]);

    const result = await runGateG6({ lead_id: "acme", leadDir });
    assert.equal(result.pass, true, result.errors.join("; "));
    assert.equal(result.gate, "G6");
    assert.equal(result.errors.length, 0);
  });

  it("fails on bad demo (mismatch)", async () => {
    const leadDir = setupLead("acme");
    writeOffer(
      leadDir,
      validOffer({
        links: {
          demo: "https://other.pages.dev",
          portfolio: PORTFOLIO,
          audit_pdf: "offer/audit.pdf",
        },
      })
    );
    mockFetchSequence([]);

    const result = await runGateG6({ lead_id: "acme", leadDir });
    assert.equal(result.pass, false);
    assert.equal(result.gate, "G6");
    assert.ok(
      result.errors.some(
        (e) => e.includes("link=demo") && e.includes("status=mismatch")
      ),
      result.errors.join("; ")
    );
    assert.ok(result.errors.some((e) => e.includes("lead_id=acme")));
    assert.ok(result.errors.some((e) => e.includes("stage=offer")));
    assert.ok(result.errors.some((e) => e.includes("gate=G6")));
  });

  it("fails when why_this_company is missing", async () => {
    const leadDir = setupLead("acme");
    const offer = validOffer();
    delete offer.why_this_company;
    writeOffer(leadDir, offer);
    mockFetchSequence([{ status: 200 }, { status: 200 }]);

    const result = await runGateG6({ lead_id: "acme", leadDir });
    assert.equal(result.pass, false);
    assert.ok(
      result.errors.some(
        (e) =>
          e.includes("why_this_company") ||
          e.includes("/why_this_company") ||
          e.toLowerCase().includes("required")
      ),
      result.errors.join("; ")
    );
    assert.ok(result.errors.some((e) => e.includes("gate=G6")));
    assert.ok(result.errors.some((e) => e.includes("stage=offer")));
  });

  it("fails when message exceeds 1500 chars", async () => {
    const leadDir = setupLead("acme");
    writeOffer(
      leadDir,
      validOffer({
        message: `${"Акме Строй ".repeat(200)}хвост`,
      })
    );
    mockFetchSequence([{ status: 200 }, { status: 200 }]);

    const result = await runGateG6({ lead_id: "acme", leadDir });
    assert.equal(result.pass, false);
    assert.ok(
      result.errors.some(
        (e) =>
          e.includes("maxLength") ||
          e.includes("1500") ||
          e.includes("too long") ||
          e.includes("/message")
      ),
      result.errors.join("; ")
    );
    assert.ok(result.errors.some((e) => e.includes("gate=G6")));
  });

  it("fails when offer.md is missing", async () => {
    const leadDir = setupLead("acme");
    writeFileSync(
      path.join(leadDir, "offer", "offer.json"),
      JSON.stringify(validOffer(), null, 2)
    );
    // no offer.md
    mockFetchSequence([{ status: 200 }, { status: 200 }]);

    const result = await runGateG6({ lead_id: "acme", leadDir });
    assert.equal(result.pass, false);
    assert.ok(
      result.errors.some(
        (e) =>
          e.includes("artifact=offer/offer.md") && e.includes("file missing")
      ),
      result.errors.join("; ")
    );
  });

  it("fails when offer.md is empty", async () => {
    const leadDir = setupLead("acme");
    writeOffer(leadDir, validOffer(), "   \n");
    mockFetchSequence([{ status: 200 }, { status: 200 }]);

    const result = await runGateG6({ lead_id: "acme", leadDir });
    assert.equal(result.pass, false);
    assert.ok(
      result.errors.some(
        (e) => e.includes("artifact=offer/offer.md") && e.includes("empty")
      ),
      result.errors.join("; ")
    );
  });

  it("fails when portfolio link returns 404", async () => {
    const leadDir = setupLead("acme");
    writeOffer(leadDir, validOffer());
    // demo HEAD 200, then portfolio HEAD 404
    mockFetchSequence([{ status: 200 }, { status: 404 }]);

    const result = await runGateG6({ lead_id: "acme", leadDir });
    assert.equal(result.pass, false);
    assert.ok(
      result.errors.some(
        (e) => e.includes("link=portfolio") && e.includes("status=404")
      ),
      result.errors.join("; ")
    );
    assert.ok(result.errors.some((e) => e.includes("gate=G6")));
  });

  it("fails on tone hit (banned phrase)", async () => {
    const leadDir = setupLead("acme");
    writeOffer(
      leadDir,
      validOffer({
        message:
          "Добрый день, Акме Строй! Предлагаем индивидуальный подход к вашему сайту.",
      })
    );
    mockFetchSequence([{ status: 200 }, { status: 200 }]);

    const result = await runGateG6({ lead_id: "acme", leadDir });
    assert.equal(result.pass, false);
    assert.ok(
      result.errors.some(
        (e) =>
          e.includes("banned_phrase") &&
          e.includes("индивидуальный подход")
      ),
      result.errors.join("; ")
    );
    assert.ok(result.errors.some((e) => e.includes("gate=G6")));
  });
});
