import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertValid, isValid } from "./validate.js";

describe("deploy schema", () => {
  it("accepts checks: {}", () => {
    assertValid(
      {
        schema_version: "1.0",
        demo_url: "https://t.leadgenerator-demos.pages.dev",
        checks: {},
      },
      "deploy"
    );
  });

  it("accepts full checks", () => {
    assertValid(
      {
        schema_version: "1.0",
        demo_url: "https://t.leadgenerator-demos.pages.dev",
        checks: {
          http_200: true,
          no_console_errors: true,
          lighthouse_perf: 92,
        },
      },
      "deploy"
    );
  });

  it("rejects non-https demo_url", () => {
    assert.equal(
      isValid(
        {
          schema_version: "1.0",
          demo_url: "http://t.leadgenerator-demos.pages.dev",
          checks: {},
        },
        "deploy"
      ),
      false
    );
  });

  it("rejects unknown check fields", () => {
    assert.equal(
      isValid(
        {
          schema_version: "1.0",
          demo_url: "https://t.leadgenerator-demos.pages.dev",
          checks: { http_200: true, extra: true },
        },
        "deploy"
      ),
      false
    );
  });
});
