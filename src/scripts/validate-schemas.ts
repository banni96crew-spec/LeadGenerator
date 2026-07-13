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
    name: "audit",
    data: {
      schema_version: "1.0",
      lead_id: "domeo",
      business_facts: {
        services: ["Ремонт квартир", "Дизайн интерьера"],
        usp_existing: ["Фиксированная цена за м²", "Гарантия 5 лет"],
        audience: "Владельцы квартир в Москве и МО",
      },
      findings: [
        {
          id: "trust-01",
          category: "доверие",
          claim: "На главной слишком много наград без фото реальных объектов рядом.",
          evidence: "capture/desktop.png",
          impact:
            "Клиент не видит доказательств качества работ — уходит к конкуренту с портфолио.",
          severity: "high",
        },
        {
          id: "content-01",
          category: "контент",
          claim: "Заголовок перегружен превосходными степенями без конкретики для сегмента.",
          evidence: "capture/text.txt#L16-L18",
          impact: "Снижается доверие к обещаниям — часть трафика закрывает сайт.",
          severity: "medium",
        },
        {
          id: "conversion-01",
          category: "конверсия",
          claim: "Основной CTA теряется среди блоков с рейтингами.",
          evidence: "capture/mobile.png",
          impact: "Меньше заявок с мобильного — основной канал для локального бизнеса.",
          severity: "high",
        },
      ],
      money_loss_summary:
        "Сайт выглядит перегруженным доказательствами «лучшести», но не показывает путь клиента к заявке. Владелец теряет часть обращений из-за шума на первом экране и того, что следующий шаг не считывается сразу.",
      tone: "дружелюбно-деловой",
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
