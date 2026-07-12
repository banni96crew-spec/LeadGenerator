import type { Page } from "playwright";

const CTA_KEYWORDS = [
  "заказать",
  "записаться",
  "оставить заявку",
  "получить",
  "купить",
  "связаться",
  "консультация",
  "расчет",
  "расчёт",
  "order",
  "contact",
  "buy",
  "get quote",
  "sign up",
  "call us",
];

export type CaptureSignals = {
  https: boolean;
  mobile_friendly: boolean;
  has_cta: boolean;
  has_form: boolean;
  tech?: string;
  title?: string;
  description?: string;
  lcp_ms?: number;
};

export async function extractSignals(page: Page, url: string): Promise<CaptureSignals> {
  const data = await page.evaluate((keywords) => {
    const text = document.body?.innerText ?? "";
    const lower = text.toLowerCase();
    const hasCta = keywords.some((kw: string) => lower.includes(kw));
    const hasForm = document.querySelector("form") !== null;
    const mobileFriendly =
      document.querySelector('meta[name="viewport"]') !== null;
    const generator = document
      .querySelector('meta[name="generator"]')
      ?.getAttribute("content")
      ?.toLowerCase();
    let tech = "custom";
    const html = document.documentElement.outerHTML.toLowerCase();
    if (generator?.includes("tilda") || html.includes("tilda")) tech = "tilda";
    else if (generator?.includes("wix") || html.includes("wix.com")) tech = "wix";
    else if (generator?.includes("wordpress") || html.includes("wp-content"))
      tech = "wordpress";

    return {
      hasCta,
      hasForm,
      mobileFriendly,
      tech,
      title: document.title,
      description:
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") ?? undefined,
      innerText: text,
    };
  }, CTA_KEYWORDS);

  return {
    https: url.startsWith("https://"),
    mobile_friendly: data.mobileFriendly,
    has_cta: data.hasCta,
    has_form: data.hasForm,
    tech: data.tech,
    title: data.title || undefined,
    description: data.description || undefined,
  };
}

export async function extractPageText(page: Page): Promise<string> {
  return page.evaluate(() => document.body?.innerText ?? "");
}
