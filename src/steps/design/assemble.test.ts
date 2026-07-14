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
import { describe, it } from "node:test";
import { assertValid } from "../../gates/validate.js";
import { assembleDesign } from "./assemble.js";
import { renderMustache } from "./mustache.js";

function writeMinimalContent(leadDir: string): void {
  writeFileSync(
    path.join(leadDir, "content.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        vertical: "renovation",
        sections: {
          hero: {
            headline: "Ремонт под ключ",
            subheadline: "Фиксированная смета",
            cta: "Рассчитать",
          },
          benefits: [
            { title: "Смета", text: "Не растёт" },
            { title: "Сроки", text: "В договоре" },
            { title: "Гарантия", text: "На работы" },
          ],
          social_proof: {
            cases: ["Объект с планом работ"],
            reviews: ["Клиент доволен сроками"],
          },
          contact: {
            phone: "+7 (495) 123-45-67",
            cta: "Оставить заявку",
          },
        },
        reuse_facts: ["Ремонт квартир", "Москва"],
      },
      null,
      2
    )
  );
}

function writeLead(leadDir: string, name = "ТестБренд"): void {
  writeFileSync(
    path.join(leadDir, "lead.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        lead_id: "test-brand",
        name,
      },
      null,
      2
    )
  );
}

function writeCaptureAssets(leadDir: string): void {
  const captureDir = path.join(leadDir, "capture");
  mkdirSync(captureDir, { recursive: true });
  writeFileSync(path.join(captureDir, "logo.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
  writeFileSync(path.join(captureDir, "photo-1.jpg"), Buffer.alloc(120, 1));
  writeFileSync(path.join(captureDir, "photo-2.jpg"), Buffer.alloc(120, 2));
  writeFileSync(
    path.join(captureDir, "meta.json"),
    JSON.stringify(
      {
        schema_version: "1.0",
        url: "https://example.com",
        final_url: "https://example.com",
        fetched_at: "2026-01-01T00:00:00.000Z",
        http_status: 200,
        screenshots: {
          desktop: "capture/desktop.png",
          mobile: "capture/mobile.png",
        },
        text_path: "capture/text.txt",
        assets: {
          logo: "capture/logo.svg",
          photos: ["capture/photo-1.jpg", "capture/photo-2.jpg"],
        },
        signals: {
          has_cta: true,
          has_phone: true,
          has_email: false,
          has_form: false,
          has_prices: false,
          has_testimonials: false,
          mobile_friendly: true,
          page_count_estimate: 1,
          tech: [],
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

describe("assembleDesign", () => {
  it("assembles dist + schema-valid build.json from content and capture", async () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-assemble-"));
    writeLead(leadDir);
    writeMinimalContent(leadDir);
    writeCaptureAssets(leadDir);

    const result = await assembleDesign(leadDir);

    assert.equal(result.template, "renovation-v1");
    assert.equal(result.build_dir, "design/dist");
    assert.ok(existsSync(path.join(leadDir, result.index_html)));
    assert.ok(existsSync(path.join(leadDir, result.build_json)));
    assert.ok(existsSync(path.join(leadDir, "design", "dist", "tokens.css")));
    assert.ok(existsSync(path.join(leadDir, "design", "dist", "base.css")));
    assert.ok(
      existsSync(path.join(leadDir, "design", "dist", "assets", "logo.svg"))
    );
    assert.ok(
      existsSync(path.join(leadDir, "design", "dist", "assets", "photo-1.jpg"))
    );

    const html = readFileSync(path.join(leadDir, result.index_html), "utf8");
    assert.ok(!html.includes("{{"));
    assert.ok(html.includes("ТестБренд"));
    assert.ok(html.includes("Ремонт под ключ"));
    assert.ok(html.includes("assets/photo-1.jpg"));
    assert.ok(html.includes("tel:74951234567"));
    assert.ok(html.includes("assets/logo.svg"));

    const build = JSON.parse(
      readFileSync(path.join(leadDir, result.build_json), "utf8")
    );
    assertValid(build, "design-build");
    assert.equal(build.template, "renovation-v1");
    assert.equal(build.brand_tokens.logo, "assets/logo.svg");
  });

  it("omits logo slots when capture has no logo", async () => {
    const leadDir = mkdtempSync(path.join(tmpdir(), "lg-assemble-nologo-"));
    writeLead(leadDir, "БезЛого");
    writeMinimalContent(leadDir);
    const captureDir = path.join(leadDir, "capture");
    mkdirSync(captureDir, { recursive: true });
    writeFileSync(
      path.join(captureDir, "meta.json"),
      JSON.stringify(
        {
          schema_version: "1.0",
          url: "https://example.com",
          final_url: "https://example.com",
          fetched_at: "2026-01-01T00:00:00.000Z",
          http_status: 200,
          screenshots: {
            desktop: "capture/desktop.png",
            mobile: "capture/mobile.png",
          },
          text_path: "capture/text.txt",
          assets: { photos: [] },
          signals: {
            has_cta: false,
            has_phone: false,
            has_email: false,
            has_form: false,
            has_prices: false,
            has_testimonials: false,
            mobile_friendly: true,
            page_count_estimate: 1,
            tech: [],
          },
        },
        null,
        2
      )
    );

    await assembleDesign(leadDir);
    const html = readFileSync(
      path.join(leadDir, "design", "dist", "index.html"),
      "utf8"
    );
    assert.ok(html.includes("hero__brand-name"));
    assert.ok(html.includes("БезЛого"));
    assert.ok(!html.includes("{{"));
  });
});
