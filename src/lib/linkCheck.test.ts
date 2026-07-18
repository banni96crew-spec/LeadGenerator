import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  checkOfferLinks,
  checkUrl,
  isPlaceholderUrl,
} from "./linkCheck.js";

const originalFetch = globalThis.fetch;

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

describe("isPlaceholderUrl", () => {
  it("rejects empty, example.com, localhost", () => {
    assert.equal(isPlaceholderUrl(""), true);
    assert.equal(isPlaceholderUrl("https://example.com/x"), true);
    assert.equal(isPlaceholderUrl("https://foo.example.com"), true);
    assert.equal(isPlaceholderUrl("https://localhost/x"), true);
    assert.equal(
      isPlaceholderUrl("https://g4-verify-construction.leadgenerator-7sp.pages.dev"),
      false
    );
  });
});

describe("checkUrl", () => {
  it("returns ok on HEAD 200", async () => {
    mockFetchSequence([{ status: 200 }]);
    const r = await checkUrl("https://demo.example-ok.test/");
    assert.equal(r.ok, true);
    assert.equal(r.status, 200);
  });

  it("falls back to GET on HEAD 405", async () => {
    mockFetchSequence([{ status: 405 }, { status: 200 }]);
    const r = await checkUrl("https://demo.example-ok.test/");
    assert.equal(r.ok, true);
    assert.equal(r.status, 200);
  });

  it("fails on non-200 without GET fallback", async () => {
    mockFetchSequence([{ status: 404 }]);
    const r = await checkUrl("https://demo.example-ok.test/");
    assert.equal(r.ok, false);
    assert.equal(r.status, 404);
  });
});

describe("checkOfferLinks", () => {
  const portfolio = {
    cases: [
      { url: "https://g4-verify-construction.leadgenerator-7sp.pages.dev" },
      { url: "https://developers.cloudflare.com/pages/" },
    ],
  };

  function setupLead(): string {
    const dir = path.join(tmpdir(), `lg-linkcheck-test-co-${Date.now()}`);
    mkdirSync(path.join(dir, "offer"), { recursive: true });
    writeFileSync(path.join(dir, "offer", "audit.pdf"), "%PDF-1.4 test");
    return dir;
  }

  it("passes when demo matches, portfolio allowlisted, pdf exists, HTTP 200", async () => {
    const leadDir = setupLead();
    const demo = "https://g4-verify-construction.leadgenerator-7sp.pages.dev";
    mockFetchSequence([{ status: 200 }, { status: 200 }]);

    const result = await checkOfferLinks({
      leadDir,
      offer: {
        links: {
          demo,
          portfolio: demo,
          audit_pdf: "offer/audit.pdf",
        },
      },
      deploy: { demo_url: demo },
      portfolio,
    });

    assert.equal(result.ok, true, result.errors.join("; "));
    assert.deepEqual(result.errors, []);
  });

  it("fails demo mismatch without inventing success", async () => {
    const leadDir = setupLead();
    mockFetchSequence([]); // no fetch expected for mismatched demo

    const result = await checkOfferLinks({
      leadDir,
      offer: {
        links: {
          demo: "https://other.pages.dev",
          portfolio: "https://g4-verify-construction.leadgenerator-7sp.pages.dev",
          audit_pdf: "offer/audit.pdf",
        },
      },
      deploy: {
        demo_url: "https://g4-verify-construction.leadgenerator-7sp.pages.dev",
      },
      portfolio,
    });

    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(
        (e) => e.includes("link=demo") && e.includes("status=mismatch")
      ),
      result.errors.join("; ")
    );
  });

  it("rejects example.com portfolio and missing audit.pdf", async () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-linkcheck-nopf-"));
    mkdirSync(path.join(leadDir, "offer"), { recursive: true });
    // no audit.pdf
    mockFetchSequence([{ status: 200 }]); // demo only if match

    const demo = "https://g4-verify-construction.leadgenerator-7sp.pages.dev";
    const result = await checkOfferLinks({
      leadDir,
      offer: {
        links: {
          demo,
          portfolio: "https://example.com/case",
          audit_pdf: "offer/audit.pdf",
        },
      },
      deploy: { demo_url: demo },
      portfolio,
    });

    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(
        (e) =>
          e.includes("link=portfolio") && e.includes("status=placeholder")
      ),
      result.errors.join("; ")
    );
    assert.ok(
      result.errors.some(
        (e) =>
          e.includes("link=audit_pdf") && e.includes("status=missing_file")
      ),
      result.errors.join("; ")
    );
    assert.ok(
      result.errors.every((e) =>
        /lead_id=.+ stage=offer gate=G6 link=/.test(e)
      )
    );
  });

  it("rejects portfolio URL not in portfolio.json", async () => {
    const leadDir = setupLead();
    const demo = "https://g4-verify-construction.leadgenerator-7sp.pages.dev";
    mockFetchSequence([{ status: 200 }]);

    const result = await checkOfferLinks({
      leadDir,
      offer: {
        links: {
          demo,
          portfolio: "https://invented-not-in-list.pages.dev/x",
          audit_pdf: "offer/audit.pdf",
        },
      },
      deploy: { demo_url: demo },
      portfolio,
    });

    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(
        (e) =>
          e.includes("link=portfolio") && e.includes("status=not_in_portfolio")
      ),
      result.errors.join("; ")
    );
  });
});
