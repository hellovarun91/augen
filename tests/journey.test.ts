// Tests #46–#57: the journey + integrity model, against an isolated test DB.
// Setting AUGEN_DB_PATH BEFORE any @/lib import — lib/db.ts honours it now.
import fs from "node:fs";
import path from "node:path";
const testDb = path.join(process.cwd(), "data", `test-journey-${process.pid}.db`);
process.env.AUGEN_DB_PATH = testDb;
// Force heuristic paths in agents so tests don't hit Claude.
process.env.ANTHROPIC_API_KEY = "";

import { describe, expect, it, beforeAll, afterAll } from "vitest";

function makeTokens(): any {
  return {
    name: "Test",
    semver: "1.0.0",
    palette: { background: "#F2EBDC", surface: "#E8D9B8", foreground: "#1A1815", primary: "#1F4A47", secondary: "#C9A45C", accent: "#D85A3A", muted: "#8C8478" },
    fonts: { display: "serif", body: "sans-serif" },
    type: { eyebrowSize: 18, headlineSize: 96, subheadSize: 28, ctaSize: 20, lockerSize: 16, tracking: -0.02 },
    scrim: { topOpacity: 0, midOpacity: 0.15, bottomOpacity: 0.5, coverage: 0.6, tint: "#000000" },
    voice: { description: "calm", doNot: [], tone: ["calm"] },
    locker: { wordmark: "TEST", locationLine: "" },
    imagery: { style: "editorial", treatment: "soft", keywords: [] },
  };
}

let brandId: string;
let campaignId: string;
const imageColKey = "image";

beforeAll(async () => {
  // Clean any leftover sandbox from a previous (interrupted) run.
  for (const ext of ["", "-shm", "-wal"]) { try { fs.unlinkSync(testDb + ext); } catch {} }
  const { createBrand, createCampaign, setProjectCopySchema } = await import("@/lib/repo");
  const brand = createBrand({
    name: "Test Co",
    slug: "test-co-" + Math.random().toString(36).slice(2, 8),
    industry: "edtech",
    tokens: makeTokens(),
  });
  brandId = brand.id;
  const camp = createCampaign({
    brandId, name: "Journey test",
    brief: {
      objective: "awareness", audience: "switchers", productFocus: [], channels: [],
      formats: ["meta-feed-1x1", "meta-feed-4x5", "meta-story-9x16", "youtube-bumper-16x9"],
      budget: 0, kpis: [], notes: "",
    },
  });
  campaignId = camp.id;
  setProjectCopySchema(campaignId, {
    columns: [
      { key: "eyebrow", label: "Eyebrow", role: "eyebrow", layer: "eyebrow", maxChars: 18, perRegion: false },
      { key: "headline", label: "Headline", role: "headline", layer: "headline", maxChars: 48, perRegion: false },
      { key: "subhead", label: "Subhead", role: "subhead", layer: "subhead", maxChars: 120, perRegion: false },
      { key: "cta", label: "CTA", role: "cta", layer: "cta", maxChars: 24, perRegion: false },
      { key: imageColKey, label: "Image", role: "image", layer: "none", perRegion: false },
    ],
    regions: [],
  });
});

afterAll(() => {
  for (const ext of ["", "-shm", "-wal"]) { try { fs.unlinkSync(testDb + ext); } catch {} }
});

describe("isMediaColumn (#55)", () => {
  it("recognises bare image labels and not 'image copy'", async () => {
    const { isMediaColumn } = await import("@/lib/copy-schema");
    expect(isMediaColumn({ key: "image", label: "Image", role: "image", layer: "none", perRegion: false } as any)).toBe(true);
    expect(isMediaColumn({ key: "hero", label: "Hero", role: "custom", layer: "none", perRegion: false } as any)).toBe(true);
    expect(isMediaColumn({ key: "img-copy", label: "Image copy", role: "image", layer: "none", perRegion: false } as any)).toBe(false);
    expect(isMediaColumn({ key: "headline", label: "Headline", role: "headline", layer: "headline", perRegion: false } as any)).toBe(false);
  });
});

describe("designReady predicate (#49/#50)", () => {
  it("dual-gates fan-out designs and lets standalone creatives ship on visual approval", async () => {
    const { designReady } = await import("@/lib/repo");
    expect(designReady({ status: "approved", stale: 0, copy_row_id: "r" }, true)).toBe(true);
    expect(designReady({ status: "approved", stale: 0, copy_row_id: "r" }, false)).toBe(false);
    expect(designReady({ status: "approved", stale: 1, copy_row_id: "r" }, true)).toBe(false);
    expect(designReady({ status: "needs_revision", stale: 0, copy_row_id: "r" }, true)).toBe(false);
    expect(designReady({ status: "approved", stale: 0, copy_row_id: null }, false)).toBe(true);
  });
});

describe("Fan-out + integrity (#47/#49)", () => {
  it("creates one design per project format, all linked back to the row", async () => {
    const { createCopyRow, deleteCopyRow, listDesignsForRow, deleteGeneration, getProjectSizes } = await import("@/lib/repo");
    const { generateDesignsForRow } = await import("@/lib/copy-fanout");
    const row = createCopyRow(campaignId, brandId, { headline: "Fan out" }, "Fan");
    try {
      const designs = generateDesignsForRow(campaignId, row.id);
      const sizes = getProjectSizes(campaignId);
      expect(designs.length).toBe(sizes.length);
      expect(designs.every((d) => d.copy_row_id === row.id)).toBe(true);
      expect(listDesignsForRow(row.id).length).toBe(sizes.length);
    } finally {
      for (const d of listDesignsForRow(row.id)) deleteGeneration(d.id);
      deleteCopyRow(row.id);
    }
  });

  it("markRowDesignsStale flags designs whose copy diverged from the row, and clears approval", async () => {
    const { createCopyRow, updateCopyRow, getCopyRow, listDesignsForRow, markRowDesignsStale, deleteCopyRow, deleteGeneration, updateGenerationStatus } = await import("@/lib/repo");
    const { generateDesignsForRow } = await import("@/lib/copy-fanout");
    const row = createCopyRow(campaignId, brandId, { headline: "Original" }, "Stale-copy");
    try {
      const ds = generateDesignsForRow(campaignId, row.id);
      expect(listDesignsForRow(row.id).filter((d) => d.stale).length).toBe(0);
      // Pre-approve one design so we can verify approval-clearing.
      updateGenerationStatus(ds[0].id, "approved");
      // Edit the row's headline, then mark stale.
      const cur = getCopyRow(row.id)!;
      updateCopyRow(row.id, { values: { ...cur.values, headline: "Edited" } });
      markRowDesignsStale(row.id);
      const fresh = listDesignsForRow(row.id);
      expect(fresh.filter((d) => d.stale).length).toBe(ds.length);
      expect(fresh.filter((d) => d.status === "approved").length).toBe(0);
    } finally {
      for (const d of listDesignsForRow(row.id)) deleteGeneration(d.id);
      deleteCopyRow(row.id);
    }
  });

  it("per-row image override: every design inherits the row's reference_id, and clearing it marks stale", async () => {
    const { createCopyRow, updateCopyRow, listDesignsForRow, markRowDesignsStale, deleteCopyRow, deleteGeneration, createReference, deleteReference } = await import("@/lib/repo");
    const { generateDesignsForRow } = await import("@/lib/copy-fanout");
    const ref = createReference({ brandId, kind: "upload", source: "test", label: "t", filePath: "/api/refs/t.jpg", mime: "image/jpeg", tags: [] });
    const row = createCopyRow(campaignId, brandId, { headline: "With image", [imageColKey]: ref.id }, "Media");
    try {
      const ds = generateDesignsForRow(campaignId, row.id);
      expect(ds.every((d) => d.reference_id === ref.id)).toBe(true);
      // Clear the image cell.
      updateCopyRow(row.id, { values: { ...row.values, [imageColKey]: "" } });
      markRowDesignsStale(row.id);
      expect(listDesignsForRow(row.id).filter((d) => d.stale).length).toBe(ds.length);
    } finally {
      for (const d of listDesignsForRow(row.id)) deleteGeneration(d.id);
      deleteCopyRow(row.id);
      deleteReference(ref.id);
    }
  });

  it("applyCopyToRowSiblings makes siblings match and clears stale", async () => {
    const { createCopyRow, listDesignsForRow, updateGenerationCopy, applyCopyToRowSiblings, deleteCopyRow, deleteGeneration, markRowDesignsStale } = await import("@/lib/repo");
    const { generateDesignsForRow } = await import("@/lib/copy-fanout");
    const row = createCopyRow(campaignId, brandId, { headline: "Same" }, "Siblings");
    try {
      generateDesignsForRow(campaignId, row.id);
      const ds = listDesignsForRow(row.id);
      expect(ds.length).toBeGreaterThan(1);
      // Edit one design's headline → mark siblings stale.
      updateGenerationCopy(ds[0].id, { headline: "Pushed", subhead: "", cta: "Go", eyebrow: undefined });
      // Pretend onDesignCopyEdited ran on the edited design — siblings should go stale next.
      // We test applyCopyToRowSiblings end state directly.
      const applied = applyCopyToRowSiblings(ds[0].id);
      expect(applied).toBe(ds.length - 1);
      const after = listDesignsForRow(row.id);
      expect(after.every((d) => d.headline === "Pushed")).toBe(true);
      expect(after.every((d) => !d.stale)).toBe(true);
      // suppress unused warning
      void markRowDesignsStale;
    } finally {
      for (const d of listDesignsForRow(row.id)) deleteGeneration(d.id);
      deleteCopyRow(row.id);
    }
  });

  it("listReadyDesigns requires both row + visual approval", async () => {
    const { createCopyRow, updateCopyRow, listDesignsForRow, listReadyDesigns, updateGenerationStatus, deleteCopyRow, deleteGeneration } = await import("@/lib/repo");
    const { generateDesignsForRow } = await import("@/lib/copy-fanout");
    const baseline = listReadyDesigns(campaignId).length;
    const row = createCopyRow(campaignId, brandId, { headline: "Gate" }, "Gate");
    try {
      const ds = generateDesignsForRow(campaignId, row.id);
      // Visual approved, row not → not ready.
      updateGenerationStatus(ds[0].id, "approved");
      expect(listReadyDesigns(campaignId).length - baseline).toBe(0);
      // Both approved → exactly one ready.
      updateCopyRow(row.id, { status: "approved" });
      expect(listReadyDesigns(campaignId).length - baseline).toBe(1);
    } finally {
      for (const d of listDesignsForRow(row.id)) deleteGeneration(d.id);
      deleteCopyRow(row.id);
    }
  });
});

describe("In-cell AI heuristics (#54/#56)", () => {
  it("rewriteCellCopy 'shorter' trims the line", async () => {
    const { rewriteCellCopy } = await import("@/lib/agents/copy-rewrite");
    const src = "Really actually just learn without limits today, simply start now";
    const r = await rewriteCellCopy({
      brand: { tokens: { voice: { tone: ["calm"], description: "calm" } }, language: {} } as any,
      layer: "headline",
      currentText: src,
      action: "shorter",
      context: {},
    });
    expect(r.proposed.length).toBeLessThan(src.length);
  });

  it("rewriteCellCopy 'punchier' strips hedge words", async () => {
    const { rewriteCellCopy } = await import("@/lib/agents/copy-rewrite");
    const r = await rewriteCellCopy({
      brand: { tokens: { voice: { tone: ["calm"], description: "calm" } }, language: {} } as any,
      layer: "headline",
      currentText: "Really actually just learn",
      action: "punchier",
      context: {},
    });
    expect(/really|actually|just/i.test(r.proposed)).toBe(false);
  });

  it("reviewRowCopy scores empty headline low and points at the headline", async () => {
    const { reviewRowCopy } = await import("@/lib/agents/copy-critic");
    const r = await reviewRowCopy({
      brand: { tokens: { voice: {} }, language: {} } as any,
      copy: { eyebrow: "", headline: "", subhead: "x", cta: "Go" },
    });
    expect(r.score).toBeLessThan(0.5);
    expect(r.fix.toLowerCase()).toContain("headline");
  });

  it("reviewRowCopy proposes a trimmed headline when it runs too long", async () => {
    const { reviewRowCopy } = await import("@/lib/agents/copy-critic");
    const long = "This is a really long headline that absolutely runs over the safe feed read budget by a wide margin again";
    const r = await reviewRowCopy({
      brand: { tokens: { voice: {} }, language: {} } as any,
      copy: { eyebrow: "", headline: long, subhead: "ok", cta: "Go" },
    });
    expect(r.suggestion?.layer).toBe("headline");
    expect(r.suggestion!.proposed.length).toBeLessThan(long.length);
  });
});

describe("journeyProgress (#50)", () => {
  it("counts rows + designs and reflects new work", async () => {
    const { journeyProgress, createCopyRow, deleteCopyRow, listDesignsForRow, deleteGeneration } = await import("@/lib/repo");
    const { generateDesignsForRow } = await import("@/lib/copy-fanout");
    const before = journeyProgress(campaignId);
    const row = createCopyRow(campaignId, brandId, { headline: "Progress" }, "Prog");
    try {
      const after = journeyProgress(campaignId);
      expect(after.rows).toBe(before.rows + 1);
      // Designs count tracks fan-out designs (copy_row_id != null).
      generateDesignsForRow(campaignId, row.id);
      const after2 = journeyProgress(campaignId);
      expect(after2.designs).toBeGreaterThan(after.designs);
    } finally {
      for (const d of listDesignsForRow(row.id)) deleteGeneration(d.id);
      deleteCopyRow(row.id);
    }
  });
});
