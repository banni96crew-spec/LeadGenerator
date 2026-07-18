import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { assertValid } from "../../gates/validate.js";
import { assembleDesign } from "./assemble.js";
import { renderMustache } from "./mustache.js";

const FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "construction-lead"
);

/** Copy JSON fixtures only (avoid cpSync crash on some Windows path setups). */
function copyConstructionFixture(leadDir: string): void {
  mkdirSync(path.join(leadDir, "capture"), { recursive: true });
  for (const rel of ["lead.json", "content.json", "capture/meta.json"] as const) {
    writeFileSync(
      path.join(leadDir, rel),
      readFileSync(path.join(FIXTURE_DIR, rel))
    );
  }
}

function writeCaptureWithLogo(leadDir: string): void {
  const captureDir = path.join(leadDir, "capture");
  mkdirSync(captureDir, { recursive: true });
  writeFileSync(path.join(captureDir, "logo.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
  writeFileSync(path.join(captureDir, "photo-1.jpg"), Buffer.alloc(120, 1));
  writeFileSync(
    path.join(captureDir, "meta.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        url: "https://atrium-dom.example",
        http_status: 200,
        screenshots: {
          desktop: "capture/desktop.png",
          mobile: "capture/mobile.png",
        },
        extracted_text: "capture/text.txt",
        assets: {
          logo: "capture/logo.svg",
          photos: ["capture/photo-1.jpg"],
        },
        signals: {
          https: true,
          mobile_friendly: true,
          has_cta: true,
          has_form: false,
        },
      },
      null,
      2
    )
  );
}

describe("renderMustache", () => {
  it("fills dotted paths, sections, inverted, and photos.0 string", () => {
    const html = renderMustache(
      "{{brand.name}}|{{#photos.0}}{{photos.0}}{{/photos.0}}|{{#photos}}{{src}};{{/photos}}|{{^brand.logo}}no-logo{{/brand.logo}}|{{#items}}{{.}}{{/items}}",
      {
        brand: { name: "Acme" },
        photos: [{ src: "assets/a.jpg" }, { src: "assets/b.jpg" }],
        items: ["x", "y"],
      }
    );
    assert.equal(html, "Acme|assets/a.jpg|assets/a.jpg;assets/b.jpg;|no-logo|xy");
  });
});

describe("construction-lead fixture contracts", () => {
  it("validates lead, content, and capture meta against schemas", () => {
    assertValid(
      JSON.parse(readFileSync(path.join(FIXTURE_DIR, "lead.json"), "utf8")),
      "lead"
    );
    assertValid(
      JSON.parse(readFileSync(path.join(FIXTURE_DIR, "content.json"), "utf8")),
      "content"
    );
    assertValid(
      JSON.parse(
        readFileSync(path.join(FIXTURE_DIR, "capture", "meta.json"), "utf8")
      ),
      "capture-meta"
    );
  });
});

describe("assembleDesign", () => {
  it("assembles atrium-v1 dist from construction-lead fixture with personalized slots", async () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-assemble-fixture-"));
    copyConstructionFixture(leadDir);

    const result = await assembleDesign(leadDir);

    assert.equal(result.template, "atrium-v1");
    assert.equal(result.build_dir, "design/dist");
    assert.ok(existsSync(path.join(leadDir, result.index_html)));
    assert.ok(existsSync(path.join(leadDir, result.build_json)));
    assert.ok(existsSync(path.join(leadDir, "design", "dist", "main.js")));
    assert.ok(existsSync(path.join(leadDir, "design", "dist", "tokens.css")));
    assert.ok(existsSync(path.join(leadDir, "design", "dist", "base.css")));
    assert.ok(
      existsSync(
        path.join(leadDir, "design", "dist", "assets", "hero-house.png")
      )
    );

    const html = readFileSync(path.join(leadDir, result.index_html), "utf8");
    assert.ok(!html.includes("{{"));
    assert.ok(!html.includes('id="faq"'));
    assert.ok(!html.includes("fonts.googleapis.com"));
    assert.ok(!html.includes('src=""'));
    assert.ok(html.includes("АТРИУМ"));
    assert.ok(html.includes("Свой дом без сюрпризов в смете"));
    assert.ok(html.includes("Обсудить участок"));
    assert.ok(html.includes("Смотреть объекты"));
    assert.ok(html.includes("Фикс"));
    assert.ok(html.includes("смета до старта работ"));
    assert.ok(html.includes("Один контур от эскиза до ключей"));
    assert.ok(html.includes("Дом у кромки леса"));
    assert.ok(html.includes("Узлы фиксируем до старта"));
    assert.ok(html.includes("Запросить консультацию"));
    assert.ok(html.includes("Москва · ежедневно 10:00–20:00"));
    assert.ok(html.includes("+7 (495) 123-45-67"));
    assert.ok(html.includes("Частные дома с инженерной дисциплиной."));
    assert.ok(html.includes("Одна смета. Один график. Один ответственный."));
    assert.ok(html.includes("--ink:"));
    assert.ok(html.includes("--accent:"));
    assert.ok(!html.includes("архитектура держит слово"));
    assert.ok(!html.includes("Четыре шага до приёма"));

    const build = JSON.parse(
      readFileSync(path.join(leadDir, result.build_json), "utf8")
    );
    assertValid(build, "design-build");
    assert.equal(build.template, "atrium-v1");
    assert.equal(build.brand_tokens.logo, undefined);
  });

  it("fails when lead.phone missing", async () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-assemble-nophone-"));
    copyConstructionFixture(leadDir);
    const lead = JSON.parse(
      readFileSync(path.join(leadDir, "lead.json"), "utf8")
    ) as Record<string, unknown>;
    delete lead.phone;
    writeFileSync(path.join(leadDir, "lead.json"), JSON.stringify(lead, null, 2));

    await assert.rejects(
      () => assembleDesign(leadDir),
      /lead\.phone required for atrium contact/
    );
  });

  it("copies capture logo into dist assets and uses capture photo in hero", async () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-assemble-logo-"));
    copyConstructionFixture(leadDir);
    writeCaptureWithLogo(leadDir);

    const result = await assembleDesign(leadDir);
    const html = readFileSync(path.join(leadDir, result.index_html), "utf8");

    assert.equal(result.template, "atrium-v1");
    assert.ok(
      existsSync(path.join(leadDir, "design", "dist", "assets", "logo.svg"))
    );
    assert.ok(
      existsSync(path.join(leadDir, "design", "dist", "assets", "photo-1.jpg"))
    );
    assert.ok(html.includes("assets/photo-1.jpg"));
    assert.ok(!html.includes("{{"));

    const build = JSON.parse(
      readFileSync(path.join(leadDir, result.build_json), "utf8")
    );
    assertValid(build, "design-build");
    assert.equal(build.brand_tokens.logo, "assets/logo.svg");
  });
});
