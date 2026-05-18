import { db, nowMs } from "./db";
import { nanoid } from "nanoid";
import { formatBySlug } from "./formats";
import { hashStr } from "./ai/rand";
import { createGeneration, getReference, listReferences } from "./repo";
import type { Brand, Idea } from "./types";

export type Strategy = "cross" | "zip" | "csv";

export interface VariationSlots {
  headline: string[];
  subhead: string[];
  cta: string[];
  eyebrow: string[];
  imageRefIds: (string | null)[]; // null = use SVG composer background
}

export interface VariationBatchRow {
  id: string;
  idea_id: string;
  campaign_id: string;
  brand_id: string;
  name: string;
  strategy: Strategy;
  slots_json: string;
  formats_json: string;
  generations_count: number;
  created_at: number;
}

export interface VariationBatch extends Omit<VariationBatchRow, "slots_json" | "formats_json"> {
  slots: VariationSlots;
  formats: string[];
}

export function emptySlots(): VariationSlots {
  return { headline: [], subhead: [], cta: [], eyebrow: [], imageRefIds: [] };
}

export function listVariationBatches(ideaId: string): VariationBatch[] {
  const rows = db().prepare("SELECT * FROM variation_batches WHERE idea_id = ? ORDER BY created_at DESC").all(ideaId) as VariationBatchRow[];
  return rows.map(hydrate);
}

export function getVariationBatch(id: string): VariationBatch | null {
  const row = db().prepare("SELECT * FROM variation_batches WHERE id = ?").get(id) as VariationBatchRow | undefined;
  return row ? hydrate(row) : null;
}

function hydrate(r: VariationBatchRow): VariationBatch {
  return { ...r, slots: JSON.parse(r.slots_json), formats: JSON.parse(r.formats_json) };
}

// Combination expansion ---------------------------------------------------

export interface Combo {
  headline: string;
  subhead: string;
  cta: string;
  eyebrow: string;
  imageRefId: string | null;
}

export function expandCombinations(slots: VariationSlots, strategy: Strategy): Combo[] {
  const H = nonEmpty(slots.headline, [""]);
  const S = nonEmpty(slots.subhead, [""]);
  const C = nonEmpty(slots.cta, [""]);
  const E = nonEmpty(slots.eyebrow, [""]);
  const I: (string | null)[] = slots.imageRefIds.length ? slots.imageRefIds : [null];

  if (strategy === "zip" || strategy === "csv") {
    const n = Math.max(H.length, S.length, C.length, E.length, I.length);
    const out: Combo[] = [];
    for (let i = 0; i < n; i++) {
      out.push({
        headline: H[i % H.length],
        subhead: S[i % S.length],
        cta: C[i % C.length],
        eyebrow: E[i % E.length],
        imageRefId: I[i % I.length],
      });
    }
    return out;
  }

  // cross-product
  const out: Combo[] = [];
  for (const h of H) for (const s of S) for (const c of C) for (const e of E) for (const i of I) {
    out.push({ headline: h, subhead: s, cta: c, eyebrow: e, imageRefId: i });
  }
  return out;
}

function nonEmpty<T>(arr: T[], fallback: T[]): T[] {
  return arr.length ? arr : fallback;
}

// CSV parser ---------------------------------------------------------------

export function parseCsvVariations(input: string, defaults: { eyebrow?: string; cta?: string } = {}): Combo[] {
  const rows = parseCsv(input.trim());
  if (rows.length < 2) throw new Error("CSV needs a header row + at least one data row");
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => h.trim().toLowerCase());

  const out: Combo[] = [];
  for (const r of dataRows) {
    const get = (name: string) => {
      const i = headers.indexOf(name);
      return i >= 0 ? (r[i] || "").trim() : "";
    };
    const headline = get("headline");
    if (!headline) continue;
    out.push({
      headline,
      subhead: get("subhead"),
      cta: get("cta") || defaults.cta || "Learn more",
      eyebrow: get("eyebrow") || defaults.eyebrow || "",
      imageRefId: get("image_ref_id") || null,
    });
  }
  return out;
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Batch creation ----------------------------------------------------------

export interface CreateBatchArgs {
  brand: Brand;
  idea: Idea;
  campaignId: string;
  name: string;
  strategy: Strategy;
  slots: VariationSlots;
  formats: string[];
}

export interface CreateBatchResult {
  batchId: string;
  generationsCount: number;
  combos: number;
}

const PER_BATCH_GENERATION_CAP = 200; // safety: cap each batch at 200 ads

export function createVariationBatch(args: CreateBatchArgs): CreateBatchResult {
  const id = `vb_${nanoid(10)}`;
  const now = nowMs();
  const combos = expandCombinations(args.slots, args.strategy);
  if (combos.length === 0) throw new Error("No combinations to generate (every slot is empty).");
  if (args.formats.length === 0) throw new Error("Pick at least one format.");
  const totalAds = combos.length * args.formats.length;
  if (totalAds > PER_BATCH_GENERATION_CAP) {
    throw new Error(`Batch would produce ${totalAds} ads; cap is ${PER_BATCH_GENERATION_CAP}. Reduce slots or formats.`);
  }

  db().prepare(`
    INSERT INTO variation_batches (id, idea_id, campaign_id, brand_id, name, strategy, slots_json, formats_json, generations_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, args.idea.id, args.campaignId, args.brand.id, args.name,
    args.strategy, JSON.stringify(args.slots), JSON.stringify(args.formats),
    totalAds, now,
  );

  let count = 0;
  for (const combo of combos) {
    for (const formatSlug of args.formats) {
      const fmt = formatBySlug(formatSlug);
      if (!fmt) continue;
      const seedKey = `${args.brand.slug}|${args.idea.id}|${id}|${count}`;
      const seed = hashStr(seedKey);
      const refId = combo.imageRefId || null;
      // Validate the ref belongs to this brand if provided
      if (refId) {
        const ref = getReference(refId);
        if (!ref || ref.brand_id !== args.brand.id) {
          // Skip invalid ref; treat as no image
        }
      }
      const gen = createGeneration({
        campaignId: args.campaignId,
        ideaId: args.idea.id,
        brandId: args.brand.id,
        formatSlug,
        aspect: fmt.aspect,
        width: fmt.width,
        height: fmt.height,
        headline: combo.headline,
        subhead: combo.subhead,
        cta: combo.cta,
        eyebrow: combo.eyebrow || undefined,
        copy: [{ headline: combo.headline, subhead: combo.subhead, cta: combo.cta, eyebrow: combo.eyebrow || undefined }],
        imagePrompt: `Variation batch ${args.name}`,
        imageSeed: seed,
        imageStyle: args.brand.tokens.imagery.style,
        palette: [
          args.brand.tokens.palette.background,
          args.brand.tokens.palette.surface,
          args.brand.tokens.palette.foreground,
          args.brand.tokens.palette.primary,
          args.brand.tokens.palette.secondary,
          args.brand.tokens.palette.accent,
        ],
        confidence: 0.8, // neutral default — Critic doesn't run on variations
        costCents: 0,
      });
      // Persist variation linkage
      db().prepare("UPDATE generations SET variation_batch_id = ?, variation_row_json = ? WHERE id = ?").run(
        id,
        JSON.stringify(combo),
        gen.id,
      );
      // If a valid ref was provided, link it
      if (refId) {
        const ref = getReference(refId);
        if (ref && ref.brand_id === args.brand.id) {
          db().prepare("UPDATE generations SET reference_id = ? WHERE id = ?").run(refId, gen.id);
        }
      }
      count++;
    }
  }

  return { batchId: id, generationsCount: count, combos: combos.length };
}

export function listBatchGenerations(batchId: string) {
  return db().prepare("SELECT * FROM generations WHERE variation_batch_id = ? ORDER BY created_at ASC").all(batchId) as any[];
}

export function deleteVariationBatch(id: string) {
  // Cascade: delete generations belonging to this batch, then the batch itself.
  db().prepare("DELETE FROM generations WHERE variation_batch_id = ?").run(id);
  db().prepare("DELETE FROM variation_batches WHERE id = ?").run(id);
}
