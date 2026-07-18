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
          claim: "Основной призыв к действию теряется среди блоков с рейтингами.",
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
  {
    name: "content",
    data: {
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
            { title: "Бриф", text: "Выезд и ограничения" },
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
    },
  },
  {
    name: "design-build",
    data: {
      schema_version: "1.0",
      template: "atrium-v1",
      brand_tokens: {
        primary: "#1C2B24",
        font: "Manrope, system-ui, sans-serif",
        logo: "assets/logo.png",
      },
      build_dir: "design/dist",
      screens: ["design/preview-desktop.png", "design/preview-mobile.png"],
      console_errors_count: 0,
      overflow_mobile: false,
    },
  },
  {
    name: "critic",
    data: {
      schema_version: "1.0",
      pass: true,
      gate: "G4",
      scores: { trust: 4, modern: 5, sellable: 4, readable: 5 },
      notes: ["Герой читается сразу", "Логотип клиента на месте"],
    },
  },
  {
    name: "deploy-empty-checks",
    data: {
      schema_version: "1.0",
      demo_url: "https://domeo.leadgenerator-demos.pages.dev",
      checks: {},
    },
  },
  {
    name: "deploy",
    data: {
      schema_version: "1.0",
      demo_url: "https://domeo.leadgenerator-demos.pages.dev",
      checks: {
        http_200: true,
        no_console_errors: true,
        lighthouse_perf: 92,
      },
    },
  },
  {
    name: "offer",
    data: {
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
    },
  },
];

function schemaNameForFixture(name: string): string {
  if (name === "state-has-website") return "state";
  if (name === "deploy-empty-checks") return "deploy";
  return name;
}

let failed = 0;
for (const example of examples) {
  try {
    assertValid(example.data, schemaNameForFixture(example.name));
    console.log(`OK ${example.name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${example.name}:`, err instanceof Error ? err.message : err);
  }
}

process.exit(failed > 0 ? 1 : 0);
