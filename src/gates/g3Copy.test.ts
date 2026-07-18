import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { runGateG3 } from "./g3Copy.js";

function validContent(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schema_version: "1.0",
    vertical: "construction",
    footer_tagline: "Премиум-строительство частных домов.",
    sections: {
      hero: {
        headline: "Дом под ключ с фиксированной сметой",
        subheadline: "Архитектура, инженерия и контроль на площадке",
        cta_primary: "Рассчитать проект",
        cta_secondary: "Смотреть дома",
      },
      proof: [
        { value: "Фикс", label: "Смета до старта работ" },
        { value: "Контроль", label: "Приёмка скрытых узлов" },
        { value: "Гарантия", label: "На несущую конструкцию" },
        { value: "Отчёт", label: "Еженедельно по объекту" },
      ],
      approach: {
        eyebrow: "Подход",
        h2: "Строим так, будто сами будем жить рядом",
        prose: "Ведём объект от эскиза до сдачи одной командой.",
        steps: [
          { title: "Бриф", text: "Выезд и ограничения участка" },
          { title: "Проект", text: "Смета до старта" },
          { title: "Стройка", text: "Контроль узлов" },
          { title: "Сдача", text: "Гарантия и сервис" },
        ],
      },
      projects: {
        eyebrow: "Проекты",
        h2: "Дома, которые уже стоят",
        lead: "Каждый объект — отдельная история участка.",
        items: [
          { title: "Дом у леса", text: "Кирпич и панорама" },
          { title: "Интерьер", text: "Свет и воздух" },
          { title: "Фасад", text: "Известняк и дерево" },
        ],
      },
      materials: {
        eyebrow: "Материалы",
        h2: "То, что остаётся после картинки",
        prose: "Спецификация фиксируется до старта.",
        items: [
          "Независимый контроль скрытых работ",
          "Поставщики с прослеживаемой партией",
          "Инженерия в проекте",
        ],
      },
    },
    reuse_facts: ["Строительство частных домов", "Москва"],
    ...overrides,
  };
}

function writeLeadBundle(
  leadDir: string,
  content: Record<string, unknown>,
  opts?: { audit?: Record<string, unknown>; research?: Record<string, unknown> }
): void {
  writeFileSync(
    path.join(leadDir, "lead.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        lead_id: "t",
        name: "Тест",
        phone: "+7 495 000-00-00",
        geo: "Москва",
      },
      null,
      2
    )
  );
  writeFileSync(
    path.join(leadDir, "content.json"),
    JSON.stringify(content, null, 2)
  );
  if (opts?.audit) {
    writeFileSync(
      path.join(leadDir, "audit.json"),
      JSON.stringify(opts.audit, null, 2)
    );
  }
  if (opts?.research) {
    writeFileSync(
      path.join(leadDir, "research.json"),
      JSON.stringify(opts.research, null, 2)
    );
  }
}

describe("runGateG3", () => {
  it("passes on valid qualitative content.json", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    writeLeadBundle(leadDir, validContent());
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, true);
    assert.equal(result.gate, "G3");
  });

  it("fails when hero.cta_primary empty", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    const data = validContent();
    const sections = data.sections as Record<string, unknown>;
    sections.hero = {
      headline: "Заголовок",
      subheadline: "Подзаголовок",
      cta_primary: " ",
      cta_secondary: "Смотреть",
    };
    writeLeadBundle(leadDir, data);
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("hero.cta_primary")));
  });

  it("fails when proof length != 4", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    const data = validContent();
    const sections = data.sections as Record<string, unknown>;
    sections.proof = [
      { value: "A", label: "a" },
      { value: "B", label: "b" },
    ];
    writeLeadBundle(leadDir, data);
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(
      result.errors.some(
        (e) => e.includes("proof") || e.includes("minItems")
      )
    );
  });

  it("passes digit-primary proof when evidenced in audit", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    const data = validContent();
    const sections = data.sections as Record<string, unknown>;
    sections.proof = [
      { value: "12", label: "лет на рынке" },
      { value: "Фикс", label: "смета" },
      { value: "Отчёт", label: "еженедельно" },
      { value: "Сервис", label: "после сдачи" },
    ];
    writeLeadBundle(leadDir, data, {
      audit: {
        schema_version: "1.0",
        note: "компания работает 12 лет",
      },
    });
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, true, result.errors.join("; "));
  });

  it("fails digit-primary proof without audit/research corpus", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    const data = validContent();
    const sections = data.sections as Record<string, unknown>;
    sections.proof = [
      { value: "12", label: "лет" },
      { value: "Фикс", label: "a" },
      { value: "Отчёт", label: "b" },
      { value: "Сервис", label: "c" },
    ];
    writeLeadBundle(leadDir, data);
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(
      result.errors.some((e) => e.includes("no audit/research corpus"))
    );
  });

  it("fails digit-primary when only reuse_facts has the number", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    const data = validContent({
      reuse_facts: ["12 лет строим"],
    });
    const sections = data.sections as Record<string, unknown>;
    sections.proof = [
      { value: "12", label: "лет" },
      { value: "Фикс", label: "a" },
      { value: "Отчёт", label: "b" },
      { value: "Сервис", label: "c" },
    ];
    writeLeadBundle(leadDir, data, {
      audit: { schema_version: "1.0", note: "без цифр про срок" },
    });
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("not evidenced")));
  });

  it("fails on bad schema", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    writeLeadBundle(leadDir, { schema_version: "1.0" });
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
  });

  it("hints legacy content schema", () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-g3-"));
    writeLeadBundle(leadDir, {
      schema_version: "1.0",
      vertical: "renovation",
      sections: {
        hero: {
          headline: "Заголовок",
          subheadline: "Подзаголовок",
          cta: "Записаться",
        },
        benefits: [{ title: "A", text: "a" }],
        social_proof: { cases: ["Кейс 1"] },
        contact: { phone: "+7", cta: "Позвонить" },
      },
      reuse_facts: ["Москва"],
    });
    const result = runGateG3({ lead_id: "t", leadDir });
    assert.equal(result.pass, false);
    assert.ok(result.errors.some((e) => e.includes("legacy content schema")));
  });
});
