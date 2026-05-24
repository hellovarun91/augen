import { z } from "zod";

// A brand's copy structure — the columns of the Copy Sheet, learned from the
// team's doc or defined by hand. Each column optionally maps to a composer
// "layer" so sheet cells can drive what renders on the creative.
export const CopyColumn = z.object({
  key: z.string(),                 // stable id, e.g. "headline", "offer_in"
  label: z.string(),               // human label, e.g. "Headline", "Offer (India)"
  role: z.enum(["headline", "subhead", "cta", "eyebrow", "offer", "body", "image", "url", "custom"]).default("custom"),
  layer: z.enum(["headline", "subhead", "cta", "eyebrow", "none"]).default("none"),
  maxChars: z.number().int().positive().optional(),
  perRegion: z.boolean().default(false),
  example: z.string().optional(),
});
export type CopyColumn = z.infer<typeof CopyColumn>;

export const CopySchema = z.object({
  columns: z.array(CopyColumn).default([]),
  regions: z.array(z.string()).default([]),
});
export type CopySchema = z.infer<typeof CopySchema>;

export function defaultCopySchema(): CopySchema {
  return {
    columns: [
      { key: "eyebrow", label: "Eyebrow", role: "eyebrow", layer: "eyebrow", maxChars: 18, perRegion: false },
      { key: "headline", label: "Headline", role: "headline", layer: "headline", maxChars: 48, perRegion: false },
      { key: "subhead", label: "Subhead", role: "subhead", layer: "subhead", maxChars: 120, perRegion: false },
      { key: "cta", label: "CTA", role: "cta", layer: "cta", maxChars: 24, perRegion: false },
    ],
    regions: [],
  };
}

export function parseCopySchema(input: unknown): CopySchema {
  if (!input) return defaultCopySchema();
  try {
    const parsed = CopySchema.parse(input);
    return parsed.columns.length ? parsed : defaultCopySchema();
  } catch { return defaultCopySchema(); }
}

// Map a free-text label to a role + composer layer + sensible char cap.
export function classifyLabel(raw: string): { role: CopyColumn["role"]; layer: CopyColumn["layer"]; maxChars?: number } {
  const l = raw.toLowerCase();
  if (/\bcta\b|call to action|button/.test(l)) return { role: "cta", layer: "cta", maxChars: 24 };
  if (/eyebrow|kicker|label|tag\b/.test(l)) return { role: "eyebrow", layer: "eyebrow", maxChars: 18 };
  if (/sub-?head|subtitle|supporting|deck/.test(l)) return { role: "subhead", layer: "subhead", maxChars: 120 };
  if (/head(line|ing)?|title|hook/.test(l)) return { role: "headline", layer: "headline", maxChars: 48 };
  if (/offer|promo|discount|deal|price/.test(l)) return { role: "offer", layer: "none", maxChars: 60 };
  if (/image copy|on-?image|overlay|caption/.test(l)) return { role: "image", layer: "none", maxChars: 60 };
  if (/email|emailer|subject|preheader|body/.test(l)) return { role: "body", layer: "none" };
  if (/url|link|landing/.test(l)) return { role: "url", layer: "none" };
  return { role: "custom", layer: "none" };
}

function slugKey(label: string, used: Set<string>): string {
  let base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") || "field";
  let key = base, n = 2;
  while (used.has(key)) key = `${base}_${n++}`;
  used.add(key);
  return key;
}

// Short codes (used only for explicit section headers, where they're unambiguous).
const REGION_HINTS = ["us", "usa", "united states", "uk", "eu", "europe", "india", "in", "apac", "latam", "emea", "global", "canada", "ca", "au", "australia", "mena", "germany", "france", "japan", "brazil"];
// Multi-character region words — safe to match inside a label without false positives.
const REGION_WORDS = ["usa", "united states", "uk", "europe", "india", "apac", "latam", "emea", "global", "canada", "australia", "mena", "germany", "france", "japan", "brazil"];
const REGION_WORD_RE = new RegExp("\\b(" + REGION_WORDS.join("|") + ")\\b", "i");

// Heuristic schema extraction for clearly-labelled docs (the common case for a
// team that already organizes copy). Looks for "Label: value" lines and region
// headers. The Claude path (copy-schema-infer) handles messier docs.
export function parseSchemaFromDoc(text: string): CopySchema {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const used = new Set<string>();
  const cols: CopyColumn[] = [];
  const regions = new Set<string>();
  const seenLabels = new Set<string>();

  for (const line of lines) {
    // Region section headers, e.g. "## India", "Region: APAC", "[US]"
    const regionHeader = line.match(/^#{0,3}\s*(?:region\s*[:-]\s*)?\[?([A-Za-z ]{2,20})\]?\s*$/i);
    if (regionHeader) {
      const cand = regionHeader[1].trim().toLowerCase();
      if (REGION_HINTS.includes(cand)) { regions.add(regionHeader[1].trim()); continue; }
    }
    // "Label: value" or "Label — value"
    const m = line.match(/^[-*•\d.\s]*([A-Za-z][A-Za-z /&()'-]{1,40}?)\s*[:–—-]\s+(.{2,})$/);
    if (!m) continue;
    const label = m[1].trim().replace(/\s+/g, " ");
    const value = m[2].trim();
    const norm = label.toLowerCase();
    if (seenLabels.has(norm)) {
      // already have this column — keep the first example
      continue;
    }
    // Skip obviously non-copy labels
    if (/^(note|notes|status|owner|date|version|link to|figma)$/i.test(label)) continue;
    seenLabels.add(norm);
    const { role, layer, maxChars } = classifyLabel(label);
    // Region from a parenthetical (e.g. "Offer (India)") or a full region word.
    let perRegion = false;
    const paren = label.match(/\(([^)]+)\)/);
    if (paren) { regions.add(paren[1].trim()); perRegion = true; }
    else if (REGION_WORD_RE.test(label)) perRegion = true;
    cols.push({ key: slugKey(label, used), label, role, layer, maxChars, perRegion, example: value.slice(0, 120) });
  }

  if (!cols.length) return defaultCopySchema();
  return { columns: cols.slice(0, 16), regions: Array.from(regions).slice(0, 8) };
}

// ---------- Row <-> creative mapping (CS3) ----------
// The composer renders four copy layers. These helpers translate between a
// sheet row's free-form cells and those layers via each column's `layer`.

export type LayerCopy = { headline: string; subhead: string; cta: string; eyebrow: string };

// A per-region column stores one value per region under a suffixed key; a normal
// column stores a single value under its bare key. These two helpers are the only
// place that encoding lives.
export function regionCellKey(colKey: string, region: string): string {
  return `${colKey}::${region}`;
}
export function cellValue(col: CopyColumn, values: Record<string, string>, region?: string): string {
  if (col.perRegion && region) return values[regionCellKey(col.key, region)] || "";
  return values[col.key] || "";
}

// First column mapped to each layer wins. Lets a row drive a creative's copy.
// For a per-region layer column, uses the given region (or the first region).
export function rowToLayerCopy(schema: CopySchema, values: Record<string, string>, region?: string): LayerCopy {
  const pick = (layer: CopyColumn["layer"]) => {
    const col = schema.columns.find((c) => c.layer === layer);
    if (!col) return "";
    const reg = region || schema.regions[0];
    if (col.perRegion && reg) return (values[regionCellKey(col.key, reg)] || "").trim();
    return (values[col.key] || "").trim();
  };
  return { headline: pick("headline"), subhead: pick("subhead"), cta: pick("cta"), eyebrow: pick("eyebrow") };
}

// Writes a creative's current copy back into the layer-mapped cells of a row,
// preserving any non-layer columns (offers, notes, other regions' variants).
export function layerCopyToRowValues(schema: CopySchema, current: Record<string, string>, copy: LayerCopy, region?: string): Record<string, string> {
  const next = { ...current };
  const reg = region || schema.regions[0];
  const set = (layer: CopyColumn["layer"], val: string) => {
    for (const c of schema.columns.filter((c) => c.layer === layer)) {
      if (c.perRegion && reg) next[regionCellKey(c.key, reg)] = val;
      else next[c.key] = val;
    }
  };
  set("headline", copy.headline);
  set("subhead", copy.subhead);
  set("cta", copy.cta);
  set("eyebrow", copy.eyebrow);
  return next;
}

export const COPY_ROW_STATUSES = ["draft", "proof", "approved"] as const;
export type CopyRowStatus = (typeof COPY_ROW_STATUSES)[number];
export const copyRowStatusLabel = (s: string) => s === "proof" ? "In proof" : s === "approved" ? "Approved" : "Draft";
