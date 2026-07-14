import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { runGateG3 } from "./g3Copy.js";

function validContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "1.0",
    vertical: "clinic",
    sections: {
      hero: {
        eyebrow: "Частная клиника",
        headline: "Приём терапевта уже завтра",
        subheadline: "Диагностика за один визит",
        cta: "Записаться",
      },
      trust: [
        { title: "Лицензия", text: "Медицинская деятельность" },
        { title: "Запись", text: "На конкретное время" },
        { title: "Приём", text: "От 30 минут" },
      ],
      symptoms: [
        { pain: "Боль 1", solve: "Решение 1" },
        { pain: "Боль 2", solve: "Решение 2" },
        { pain: "Боль 3", solve: "Решение 3" },
        { pain: "Боль 4", solve: "Решение 4" },
      ],
      why_us: [
        { title: "Плюс 1", text: "Текст 1" },
        { title: "Плюс 2", text: "Текст 2" },
        { title: "Плюс 3", text: "Текст 3" },
      ],
      contact: {
        phone: "+7 (495) 000-00-00",
        cta: "Оставить заявку",
      },
    },
    reuse_facts: ["Частная клиника", "Москва"],
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
      eyebrow: "Клиника",
      headline: "Заголовок",
      subheadline: "Подзаголовок",
      cta: " ",
    };
    writeContent(leadDir, data);
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("hero.cta")));
  });

  it("fails when trust < 3", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    const data = validContent();
    const sections = data.sections as Record<string, unknown>;
    sections.trust = [
      { title: "A", text: "a" },
      { title: "B", text: "b" },
    ];
    writeContent(leadDir, data);
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("trust")));
  });

  it("fails when symptoms < 4", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    const data = validContent();
    const sections = data.sections as Record<string, unknown>;
    sections.symptoms = [
      { pain: "a", solve: "b" },
      { pain: "c", solve: "d" },
      { pain: "e", solve: "f" },
    ];
    writeContent(leadDir, data);
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("symptoms")));
  });

  it("fails on bad schema", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    writeContent(leadDir, { schema_version: "1.0" });
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
  });

  it("hints legacy renovation schema", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    writeContent(leadDir, {
      schema_version: "1.0",
      vertical: "renovation",
      sections: {
        hero: { headline: "Заголовок", subheadline: "Подзаголовок", cta: "Записаться" },
        benefits: [{ title: "A", text: "a" }],
        social_proof: { cases: ["Кейс 1"] },
        contact: { phone: "+7", cta: "Позвонить" },
      },
      reuse_facts: ["Москва"],
    });
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(
      result.errors.some((e) => e.includes("legacy renovation schema"))
    );
  });
});
