import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { generateAuditPdf } from "./auditPdf.js";

function writeFixtures(leadDir: string): void {
  mkdirSync(path.join(leadDir, "capture"), { recursive: true });
  writeFileSync(
    path.join(leadDir, "lead.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        lead_id: "pdf-test-co",
        name: "Тест Строй",
      },
      null,
      2
    )
  );
  writeFileSync(
    path.join(leadDir, "audit.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        lead_id: "pdf-test-co",
        business_facts: {
          services: ["Строительство домов"],
          usp_existing: ["Опыт 10 лет"],
          audience: "Частные заказчики",
        },
        findings: [
          {
            id: "a-01",
            category: "доверие",
            claim: "Нет отзывов на главной",
            evidence: "capture/desktop.png",
            impact: "Снижает доверие к компании",
            severity: "high",
          },
          {
            id: "a-02",
            category: "контент",
            claim: "Слабый оффер в первом экране",
            evidence: "capture/text.txt#L1-L3",
            impact: "Посетитель не понимает ценность",
            severity: "medium",
          },
          {
            id: "a-03",
            category: "конверсия",
            claim: "CTA неочевиден",
            evidence: "capture/desktop.png",
            impact: "Меньше заявок с сайта",
            severity: "low",
          },
        ],
        money_loss_summary:
          "Сайт не дожимает доверие и заявку — теряются обращения.",
        tone: "деловой",
      },
      null,
      2
    )
  );
}

describe("generateAuditPdf", () => {
  it("writes offer/audit.pdf with size > 0 and returns relative path", async () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-audit-pdf-"));
    writeFixtures(leadDir);

    const relative = await generateAuditPdf(leadDir);
    assert.equal(relative, "offer/audit.pdf");

    const abs = path.join(leadDir, relative);
    const size = statSync(abs).size;
    assert.ok(size > 0, `expected PDF size > 0, got ${size}`);
  });
});
