// Fetches a public web page and reduces it to a compact text brief the brand
// synthesizer can read: <title>, meta description, and a slice of visible body
// text with tags/scripts/styles stripped. Best-effort — returns null on any
// failure so onboarding can fall back to the typed brief.

export interface SiteText {
  url: string;
  title: string;
  description: string;
  text: string;
}

const MAX_TEXT = 2400; // chars of body text fed to the model — enough signal, bounded cost
const FETCH_TIMEOUT_MS = 8000;

function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    // Block obvious internal/loopback targets (SSRF hygiene).
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function stripHtml(html: string): { title: string; description: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
  const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").trim();

  // Drop non-content elements, then strip remaining tags.
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: titleMatch ? decode(titleMatch[1]) : "",
    description: descMatch ? decode(descMatch[1]) : "",
    text: decode(body).slice(0, MAX_TEXT),
  };
}

export async function fetchSiteText(raw: string): Promise<SiteText | null> {
  const url = normalizeUrl(raw);
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "AugenBot/1.0 (+brand onboarding)", accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(ctype)) return null;
    const html = (await res.text()).slice(0, 500_000); // cap the parse window
    const { title, description, text } = stripHtml(html);
    if (!title && !description && text.length < 40) return null;
    return { url, title, description, text };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Folds fetched site text into the typed brief so the synthesizer reads both.
export function mergeBriefWithSite(brief: string, site: SiteText | null): string {
  if (!site) return brief;
  const parts = [brief.trim()];
  parts.push(`\n\n— Pulled from ${site.url} —`);
  if (site.title) parts.push(`Title: ${site.title}`);
  if (site.description) parts.push(`Description: ${site.description}`);
  if (site.text) parts.push(`Page text: ${site.text}`);
  return parts.filter(Boolean).join("\n").trim();
}
