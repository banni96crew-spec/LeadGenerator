import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractDemoUrlFromWranglerOutput, previewDemoUrl } from "./env.js";

describe("extractDemoUrlFromWranglerOutput", () => {
  it("prefers Deployment alias URL over hash deployment URL", () => {
    const output = `
✨ Success! Uploaded 12 files
✨ Deployment complete! Take a peek over at https://fc57d399.leadgenerator-7sp.pages.dev
✨ Deployment alias URL: https://g4-verify-construction.leadgenerator-7sp.pages.dev
`;
    assert.equal(
      extractDemoUrlFromWranglerOutput(output, "g4-verify-construction"),
      "https://g4-verify-construction.leadgenerator-7sp.pages.dev"
    );
  });

  it("falls back to Take a peek over at URL", () => {
    const output =
      "✨ Deployment complete! Take a peek over at https://abc123.leadgenerator-7sp.pages.dev";
    assert.equal(
      extractDemoUrlFromWranglerOutput(output, "g4-verify-construction"),
      "https://abc123.leadgenerator-7sp.pages.dev"
    );
  });

  it("picks branch-prefixed pages.dev URL from mixed output", () => {
    const output = `
uploaded
https://deadbeef.leadgenerator-7sp.pages.dev
https://g4-verify-construction.leadgenerator-7sp.pages.dev
`;
    assert.equal(
      extractDemoUrlFromWranglerOutput(output, "g4-verify-construction"),
      "https://g4-verify-construction.leadgenerator-7sp.pages.dev"
    );
  });

  it("strips ANSI and trailing punctuation", () => {
    const output =
      "\u001b[32m✨ Deployment alias URL: https://demo.leadgenerator-7sp.pages.dev.\u001b[0m";
    assert.equal(
      extractDemoUrlFromWranglerOutput(output, "demo"),
      "https://demo.leadgenerator-7sp.pages.dev"
    );
  });

  it("returns null when no pages.dev URL present", () => {
    assert.equal(extractDemoUrlFromWranglerOutput("deploy failed", "x"), null);
  });
});

describe("previewDemoUrl", () => {
  it("builds project-name shaped URL (may differ from CF subdomain)", () => {
    assert.equal(
      previewDemoUrl("g4-verify-construction", "leadgenerator"),
      "https://g4-verify-construction.leadgenerator.pages.dev"
    );
  });
});
