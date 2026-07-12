import { assertValid } from "../gates/validate.js";

const examples: Array<{ name: string; data: unknown }> = [
  {
    name: "lead",
    data: {
      schema_version: "1.0",
      lead_id: "domeo",
      name: "Domeo",
      site: "https://domeo.ru",
      geo: "Москва",
      source: "inline",
    },
  },
  {
    name: "state-has-website",
    data: {
      schema_version: "1.0",
      lead_id: "domeo",
      branch: "has_website",
      stages: {
        capture: { status: "pending" },
        research: { status: "skipped" },
        audit: { status: "pending" },
        copy: { status: "pending" },
        design: { status: "pending" },
        publish: { status: "pending" },
        offer: { status: "pending" },
      },
      updated_at: new Date().toISOString(),
    },
  },
  {
    name: "capture-meta",
    data: {
      schema_version: "1.0",
      url: "https://domeo.ru",
      http_status: 200,
      screenshots: {
        desktop: "capture/desktop.png",
        mobile: "capture/mobile.png",
      },
      extracted_text: "capture/text.txt",
      assets: { logo: "capture/logo.png", photos: [] },
      signals: {
        https: true,
        mobile_friendly: true,
        has_cta: true,
        has_form: true,
        tech: "custom",
      },
    },
  },
];

let failed = 0;
for (const example of examples) {
  try {
    assertValid(example.data, example.name === "state-has-website" ? "state" : example.name);
    console.log(`OK ${example.name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${example.name}:`, err instanceof Error ? err.message : err);
  }
}

process.exit(failed > 0 ? 1 : 0);
