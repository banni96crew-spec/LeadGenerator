import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { runGateG3 } from "./g3Copy.js";

function validContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "1.0",
    vertical: "renovation",
    sections: {
      hero: {
        headline: "Ремонт квартир под ключ",
        subheadline: "Фиксированная смета",
        cta: "Рассчитать стоимость",
      },
      benefits: [
        { title: "Смета", text: "Не растёт после старта" },
        { title: "Сроки", text: "В договоре" },
        { title: "Гарантия", text: "На работы" },
      ],
      social_proof: {
        cases: ["Объект с прозрачным планом работ"],
      },
      contact: {
        phone: "+7 (495) 000-00-00",
        cta: "Оставить заявку",
      },
    },
    reuse_facts: ["Ремонт квартир", "Москва"],
    ...overrides,
  };
}

function writeContent(leadDir: string, data: Record<string, unknown>): void {
  writeFileSync(path.join(leadDir, "content.json"), JSON.stringify(data, null, 2));
}

describe("runGateG3", () => {
  it("passes on valid content.json", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    writeContent(leadDir, validContent());
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, true);
    assert.equal(result.gate, "G3");
  });

  it("fails when hero.cta empty", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    const data = validContent();
    const sections = data.sections as Record<string, unknown>;
    sections.hero = {
      headline: "Заголовок",
      subheadline: "Подзаголовок",
      cta: " ",
    };
    writeContent(leadDir, data);
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("hero.cta")));
  });

  it("fails when benefits < 3", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    const data = validContent();
    const sections = data.sections as Record<string, unknown>;
    sections.benefits = [
      { title: "A", text: "a" },
      { title: "B", text: "b" },
    ];
    writeContent(leadDir, data);
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
  });

  it("fails when social_proof empty", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    const data = validContent();
    const sections = data.sections as Record<string, unknown>;
    sections.social_proof = {};
    writeContent(leadDir, data);
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("social_proof")));
  });

  it("fails on bad schema", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    writeContent(leadDir, { schema_version: "1.0" });
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
  });
});
