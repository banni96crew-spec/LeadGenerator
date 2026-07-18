import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertValid, isValid } from "./validate.js";

/** Fixture aligned with validate-schemas.ts offer example. */
const validOfferFixture = {
  schema_version: "1.0",
  message:
    "Добрый день! Подготовили короткий разбор сайта и демо-страницу с вашими услугами — удобно показать команде.",
  usp: ["Фиксированная смета до старта", "Еженедельный отчёт по объекту"],
  why_this_company:
    "У вас сильная экспертиза в строительстве, но на сайте сложно сразу увидеть следующий шаг для клиента.",
  links: {
    demo: "https://domeo.leadgenerator-demos.pages.dev",
    portfolio: "https://g4-verify-construction.leadgenerator-7sp.pages.dev",
    audit_pdf: "offer/audit.pdf",
  },
};

describe("offer schema", () => {
  it("accepts validate-schemas fixture", () => {
    assertValid(validOfferFixture, "offer");
  });

  it("rejects message longer than maxLength 1500", () => {
    const tooLong = {
      ...validOfferFixture,
      message: `${"А".repeat(1501)}`,
    };
    assert.equal(isValid(tooLong, "offer"), false);
    assert.throws(() => assertValid(tooLong, "offer"), /maxLength|1500|\/message/i);
  });

  it("accepts message at exactly 1500 chars", () => {
    assertValid(
      {
        ...validOfferFixture,
        message: "Б".repeat(1500),
      },
      "offer"
    );
  });
});
