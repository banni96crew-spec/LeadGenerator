import type { Branch, Lead } from "../lib/types.js";
import { normalizeSiteUrl } from "../lib/paths.js";

export type ProbeResult = {
  ok: boolean;
  httpStatus: number;
  finalUrl: string;
  reason?: string;
};

const PARKING_HOSTS = [
  "sedo.com",
  "sedoparking.com",
  "parkingcrew.net",
  "afternic.com",
  "hugedomains.com",
  "dan.com",
  "bodis.com",
];

const TITLE_STRONG = [
  "domain for sale",
  "domain is for sale",
  "this domain is for sale",
  "this domain may be for sale",
  "parked domain",
  "parked free",
  "домен продается",
  "домен на продаже",
  "купить домен",
  "registrar parking",
];

const TITLE_AMBIGUOUS = ["coming soon", "скоро откроется"];

const MIN_HTML_LENGTH = 100;
const PROBE_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 512 * 1024;
const STRONG_HTML_SNIPPET_BYTES = 2048;

function isParkingHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return PARKING_HOSTS.some(
    (host) => lower === host || lower.endsWith(`.${host}`)
  );
}

function isParkingContent(html: string, title: string): boolean {
  if (html.trim().length < MIN_HTML_LENGTH) {
    return true;
  }

  const titleLower = title.toLowerCase();
  const htmlSnippet = html.slice(0, STRONG_HTML_SNIPPET_BYTES).toLowerCase();
  const combinedStrong = `${titleLower}\n${htmlSnippet}`;

  if (TITLE_STRONG.some((kw) => combinedStrong.includes(kw))) {
    return true;
  }

  if (
    html.length < MIN_HTML_LENGTH * 2 &&
    TITLE_AMBIGUOUS.some((kw) => titleLower.includes(kw))
  ) {
    return true;
  }

  return false;
}

export async function probeSite(url: string): Promise<ProbeResult> {
  const normalized = normalizeSiteUrl(url);
  if (!normalized) {
    return {
      ok: false,
      httpStatus: 0,
      finalUrl: normalized,
      reason: "empty url",
    };
  }

  try {
    const response = await fetch(normalized, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { "User-Agent": "LeadGenerator/1.0 (probe)" },
    });

    const finalUrl = response.url || normalized;
    const hostname = new URL(finalUrl).hostname;

    if (response.status !== 200) {
      return {
        ok: false,
        httpStatus: response.status,
        finalUrl,
        reason: `http status ${response.status}`,
      };
    }

    if (isParkingHost(hostname)) {
      return {
        ok: false,
        httpStatus: response.status,
        finalUrl,
        reason: `parking host ${hostname}`,
      };
    }

    const buffer = await response.arrayBuffer();
    const slice =
      buffer.byteLength > MAX_BODY_BYTES
        ? buffer.slice(0, MAX_BODY_BYTES)
        : buffer;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? "";

    if (isParkingContent(html, title)) {
      return {
        ok: false,
        httpStatus: response.status,
        finalUrl,
        reason: "parking or placeholder content",
      };
    }

    return {
      ok: true,
      httpStatus: response.status,
      finalUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      httpStatus: 0,
      finalUrl: normalized,
      reason: message,
    };
  }
}

export async function decideBranch(lead: Lead): Promise<Branch> {
  const site = lead.site?.trim();
  if (!site) {
    return "no_website";
  }
  const probe = await probeSite(site);
  return probe.ok ? "has_website" : "no_website";
}
