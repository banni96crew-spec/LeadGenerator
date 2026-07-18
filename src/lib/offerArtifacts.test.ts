import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  OFFER_AUDIT_PDF_REL,
  offerArtifactIsValid,
} from "./offerArtifacts.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const DEMO = "https://g4-verify-construction.leadgenerator-7sp.pages.dev";
const PORTFOLIO = DEMO;

function writeValidOfferBundle(leadDir: string): void {
  mkdirSync(path.join(leadDir, "offer"), { recursive: true });
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
    path.join(leadDir, "offer", "offer.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        message: "Короткое персональное предложение для компании.",
        usp: ["Демо под ваш бренд"],
        why_this_company: "На сайте слабый CTA и нет доверия.",
        links: {
          demo: DEMO,
          portfolio: PORTFOLIO,
          audit_pdf: OFFER_AUDIT_PDF_REL,
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

describe("offerArtifactIsValid", () => {
  it("returns true for schema-valid local offer bundle", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-offer-valid-"));
    writeValidOfferBundle(leadDir);
    assert.equal(offerArtifactIsValid(leadDir), true);
  });

  it("returns false when offer.md is empty", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-offer-md-"));
    writeValidOfferBundle(leadDir);
    writeFileSync(path.join(leadDir, "offer", "offer.md"), "   \n");
    assert.equal(offerArtifactIsValid(leadDir), false);
  });

  it("returns false when demo mismatches deploy.demo_url", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-offer-demo-"));
    writeValidOfferBundle(leadDir);
    const offerPath = path.join(leadDir, "offer", "offer.json");
    const offer = JSON.parse(readFileSync(offerPath, "utf8")) as {
      links: { demo: string };
    };
    offer.links.demo = "https://other.example.pages.dev";
    writeFileSync(offerPath, JSON.stringify(offer, null, 2));
    assert.equal(offerArtifactIsValid(leadDir), false);
  });

  it("returns false when portfolio URL is not allowlisted", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-offer-port-"));
    writeValidOfferBundle(leadDir);
    const offerPath = path.join(leadDir, "offer", "offer.json");
    const offer = JSON.parse(readFileSync(offerPath, "utf8")) as {
      links: { portfolio: string };
    };
    offer.links.portfolio = "https://invented-not-in-list.pages.dev/x";
    writeFileSync(offerPath, JSON.stringify(offer, null, 2));
    assert.equal(offerArtifactIsValid(leadDir), false);
  });

  it("returns false when audit.pdf is missing", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-offer-pdf-"));
    writeValidOfferBundle(leadDir);
    unlinkSync(path.join(leadDir, "offer", "audit.pdf"));
    assert.equal(offerArtifactIsValid(leadDir), false);
  });

  it("does not call fetch (sync local-only validity)", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-offer-nofetch-"));
    writeValidOfferBundle(leadDir);
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error("offerArtifactIsValid must not fetch");
    }) as typeof fetch;

    assert.equal(offerArtifactIsValid(leadDir), true);
    assert.equal(fetchCalls, 0);
  });
});
