import { describe, expect, it } from "vitest";
import { BrandTokens as BT, BrandLanguage as BL } from "@/lib/types";

// A schema-valid Brand fixture; pass overrides to exercise specific signals.
function fakeBrand(o: {
  tagline?: string; description?: string; tone?: string[]; doNot?: string[];
  voiceDesc?: string; language?: any; industry?: string;
} = {}): any {
  const tokens = BT.parse({
    name: "Test",
    palette: { background: "#0a0a0b", surface: "#16161a", foreground: "#f4f4f5", primary: "#3b6ef5", secondary: "#8b5cf6", accent: "#f59e0b", muted: "#6b7280" },
    fonts: { display: "serif", body: "sans" },
    type: {}, scrim: {}, imagery: {},
    voice: { description: "", tone: o.tone ?? [], doNot: o.doNot ?? [] },
    locker: { wordmark: "TEST" },
  });
  const language = BL.parse(o.language ?? {});
  return {
    id: "brnd_test", slug: "test-brand", name: "Test", industry: o.industry ?? "saas",
    tagline: o.tagline ?? "", description: o.description ?? "", status: "active",
    refs: [], created_at: 0, updated_at: 0, tokens, language, voice: null,
  };
}

describe("copy mapping (CS3)", () => {
  it("rowToLayerCopy reads each layer from its mapped column", async () => {
    const { defaultCopySchema, rowToLayerCopy } = await import("@/lib/copy-schema");
    const schema = defaultCopySchema();
    const copy = rowToLayerCopy(schema, { eyebrow: "E", headline: "H", subhead: "S", cta: "C" });
    expect(copy).toEqual({ headline: "H", subhead: "S", cta: "C", eyebrow: "E" });
  });

  it("layerCopyToRowValues overwrites layer cells but preserves other columns", async () => {
    const { defaultCopySchema, layerCopyToRowValues } = await import("@/lib/copy-schema");
    const schema = defaultCopySchema();
    const next = layerCopyToRowValues(schema, { headline: "old", offer_in: "₹999 keep me" }, { headline: "new", subhead: "sub", cta: "go", eyebrow: "eye" });
    expect(next.headline).toBe("new");
    expect(next.cta).toBe("go");
    expect(next.offer_in).toBe("₹999 keep me"); // non-layer column untouched
  });

  it("round-trips row → layers → row for mapped cells", async () => {
    const { defaultCopySchema, rowToLayerCopy, layerCopyToRowValues } = await import("@/lib/copy-schema");
    const schema = defaultCopySchema();
    const start = { eyebrow: "E1", headline: "H1", subhead: "S1", cta: "C1" };
    const back = layerCopyToRowValues(schema, {}, rowToLayerCopy(schema, start));
    expect(back).toMatchObject(start);
  });

  it("status helpers are coherent", async () => {
    const { COPY_ROW_STATUSES, copyRowStatusLabel } = await import("@/lib/copy-schema");
    expect([...COPY_ROW_STATUSES]).toEqual(["draft", "proof", "approved"]);
    expect(copyRowStatusLabel("proof")).toBe("In proof");
    expect(copyRowStatusLabel("approved")).toBe("Approved");
    expect(copyRowStatusLabel("draft")).toBe("Draft");
  });
});

describe("per-region cells (#33)", () => {
  it("regionCellKey encodes column + region", async () => {
    const { regionCellKey } = await import("@/lib/copy-schema");
    expect(regionCellKey("headline", "India")).toBe("headline::India");
  });

  it("rowToLayerCopy reads a per-region column by region (and defaults to the first)", async () => {
    const { rowToLayerCopy, regionCellKey } = await import("@/lib/copy-schema");
    const schema = { columns: [{ key: "headline", label: "Headline", role: "headline", layer: "headline", perRegion: true }], regions: ["India", "US"] } as any;
    const values = { [regionCellKey("headline", "India")]: "नमस्ते", [regionCellKey("headline", "US")]: "Hello" };
    expect(rowToLayerCopy(schema, values, "US").headline).toBe("Hello");
    expect(rowToLayerCopy(schema, values).headline).toBe("नमस्ते"); // defaults to first region
  });

  it("layerCopyToRowValues writes to the region-suffixed key for per-region columns", async () => {
    const { layerCopyToRowValues, regionCellKey } = await import("@/lib/copy-schema");
    const schema = { columns: [{ key: "headline", label: "Headline", role: "headline", layer: "headline", perRegion: true }], regions: ["India", "US"] } as any;
    const next = layerCopyToRowValues(schema, {}, { headline: "Bonjour", subhead: "", cta: "", eyebrow: "" }, "US");
    expect(next[regionCellKey("headline", "US")]).toBe("Bonjour");
    expect(next.headline).toBeUndefined(); // bare key not used for per-region
  });
});

describe("foundation strength (M-D)", () => {
  it("scores a sparse brand low with actionable gaps", async () => {
    const { foundationStrength } = await import("@/lib/brand-strength");
    const s = foundationStrength(fakeBrand(), { assets: 0, references: 0, winners: 0 });
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThan(35);
    expect(s.band).toBe("thin");
    expect(s.items.filter((i) => !i.done).length).toBeGreaterThan(8);
    // gaps deep-link somewhere on the brand
    for (const i of s.items) expect(i.href).toContain("/brands/test-brand");
  });

  it("a fully-filled brand reaches 100 / strong with no gaps", async () => {
    const { foundationStrength } = await import("@/lib/brand-strength");
    const brand = fakeBrand({
      tagline: "A real promise.",
      description: "A clinically-dosed skincare line for sensitive skin.",
      tone: ["calm", "bold"],
      language: {
        voiceDescription: "Calm, precise, and quietly confident — never shouty or hypey at all.",
        toneSliders: { formal_casual: 0, serious_playful: 0, reserved_bold: 1, classic_modern: 0 },
        doRules: ["Lead with the benefit"],
        doNotRules: ["No exclamation marks"],
        preferredWords: ["precise", "considered"],
        bannedWords: ["revolutionary"],
        sampleSentences: ["Built for skin that reacts."],
        exemplars: { eyebrow: [], headline: ["An honest upgrade."], subhead: [], cta: [] },
      },
    });
    const s = foundationStrength(brand, { assets: 1, references: 1, winners: 1 });
    expect(s.score).toBe(100);
    expect(s.band).toBe("strong");
    expect(s.items.every((i) => i.done)).toBe(true);
  });
});

describe("brand refine heuristic (M-D, no AI key)", () => {
  it("warms the brand colors", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { refineBrandAI } = await import("@/lib/ai/brand-refine");
    const brand = fakeBrand();
    const r = await refineBrandAI(brand, "make the palette warmer");
    expect(r.viaAI).toBe(false);
    expect(r.tokens.palette.primary.toLowerCase()).not.toBe(brand.tokens.palette.primary.toLowerCase());
    expect(r.summary.toLowerCase()).toContain("warm");
  });

  it("darkens surfaces and adds a tone for 'bolder'", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { refineBrandAI } = await import("@/lib/ai/brand-refine");
    const brand = fakeBrand({ tone: ["calm"] });
    const dark = await refineBrandAI(brand, "make it darker and moodier");
    // foreground is near-white, so darkening visibly moves it (background is already near-black)
    expect(dark.tokens.palette.foreground.toLowerCase()).not.toBe(brand.tokens.palette.foreground.toLowerCase());
    expect(dark.tokens.scrim.bottomOpacity).toBeGreaterThan(brand.tokens.scrim.bottomOpacity); // "moodier" deepens scrim
    const bold = await refineBrandAI(brand, "bolder voice");
    expect(bold.tokens.voice.tone).toContain("bold");
  });

  it("is honest when it finds no recognizable intent (and leaves tokens valid)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { refineBrandAI } = await import("@/lib/ai/brand-refine");
    const brand = fakeBrand();
    const r = await refineBrandAI(brand, "zzz qqq nonsense");
    expect(r.viaAI).toBe(false);
    expect(r.summary.toLowerCase()).toContain("no clear change");
    expect(r.tokens.palette).toEqual(brand.tokens.palette); // unchanged
  });
});

describe("vision QC critic (heuristic fallback)", () => {
  it("returns a well-formed critique without pixels or a key, and is honest about it", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { runVisionCritic } = await import("@/lib/agents/vision-critic");
    const brand = fakeBrand();
    const { output } = await runVisionCritic({
      brand, language: brand.language, formatSlug: "meta-feed-1x1",
      copy: { headline: "An honest upgrade", subhead: "A subhead.", cta: "See more", eyebrow: "NEW" },
    });
    expect(output.viaVision).toBe(false);
    expect(["ship", "revise", "kill"]).toContain(output.verdict);
    for (const k of ["legibility", "contrast", "composition", "safeArea", "brandFit", "overallScore"] as const) {
      expect(output[k]).toBeGreaterThanOrEqual(0);
      expect(output[k]).toBeLessThanOrEqual(1);
    }
    expect(output.notes.join(" ").toLowerCase()).toContain("heuristic");
  });

  it("flags overflow risk for a long headline on a wide banner", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { runVisionCritic } = await import("@/lib/agents/vision-critic");
    const brand = fakeBrand();
    const short = await runVisionCritic({ brand, language: brand.language, formatSlug: "google-display-728x90", copy: { headline: "Short and sweet", subhead: "", cta: "Go" } });
    const long = await runVisionCritic({ brand, language: brand.language, formatSlug: "google-display-728x90", copy: { headline: "A dramatically overlong headline that will never fit a leaderboard banner crop", subhead: "", cta: "Go" } });
    expect(long.output.legibility).toBeLessThan(short.output.legibility);
    expect(long.output.fixes.join(" ").toLowerCase()).toContain("shorten");
  });
});

describe("MCP tool contract", () => {
  it("exposes well-formed, uniquely-named tools", async () => {
    const { TOOL_DEFS } = await import("@/lib/mcp/tools");
    expect(TOOL_DEFS.length).toBeGreaterThanOrEqual(8);
    const names = TOOL_DEFS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length); // unique
    for (const t of TOOL_DEFS) {
      expect(t.name).toMatch(/^[a-z_]+$/);
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.inputSchema.type).toBe("object");
    }
    // core workflow tools are present
    for (const n of ["list_brands", "create_brand", "brainstorm_projects", "generate_ads", "set_creative_status"]) {
      expect(names).toContain(n);
    }
  });
});

describe("figma token merge (live sync)", () => {
  it("overwrites only the keys Figma provided", async () => {
    const { mergeTokens } = await import("@/lib/figma/sync");
    const brand = fakeBrand();
    const merged = mergeTokens(brand.tokens, { palette: { primary: "#ffffff" } as any, fonts: { display: "Custom Serif" } as any });
    expect(merged.palette.primary).toBe("#ffffff");           // changed
    expect(merged.palette.background).toBe(brand.tokens.palette.background); // untouched
    expect(merged.fonts.display).toBe("Custom Serif");        // changed
    expect(merged.fonts.body).toBe(brand.tokens.fonts.body);  // untouched
    expect(merged.scrim).toEqual(brand.tokens.scrim);         // whole group untouched
  });
});

describe("url ingest (M-C)", () => {
  it("blocks internal and malformed URLs without network", async () => {
    const { fetchSiteText } = await import("@/lib/ingest/url");
    expect(await fetchSiteText("http://localhost:3000")).toBeNull();
    expect(await fetchSiteText("http://127.0.0.1/admin")).toBeNull();
    expect(await fetchSiteText("not a url")).toBeNull();
    expect(await fetchSiteText("")).toBeNull();
  });

  it("mergeBriefWithSite folds site text into the brief", async () => {
    const { mergeBriefWithSite } = await import("@/lib/ingest/url");
    expect(mergeBriefWithSite("brief only", null)).toBe("brief only");
    const merged = mergeBriefWithSite("Our brand.", { url: "https://x.com", title: "X Title", description: "desc", text: "body text" });
    expect(merged).toContain("Our brand.");
    expect(merged).toContain("https://x.com");
    expect(merged).toContain("X Title");
  });
});

describe("planner count control (#31)", () => {
  it("returns exactly the requested draft count, clamped to 1..6", async () => {
    const { planQuarter } = await import("@/lib/ai/planner");
    const brand = fakeBrand({ tone: ["considered"] });
    expect(planQuarter(brand, 2026, "Q3", 1)).toHaveLength(1);
    expect(planQuarter(brand, 2026, "Q3", 3)).toHaveLength(3);
    expect(planQuarter(brand, 2026, "Q3", 6)).toHaveLength(6);
    expect(planQuarter(brand, 2026, "Q3", 99)).toHaveLength(6); // clamped high
    expect(planQuarter(brand, 2026, "Q3", 0)).toHaveLength(1);  // clamped low
    expect(planQuarter(brand, 2026, "Q3")).toHaveLength(3);     // default
  });

  it("cycles objectives for extra drafts", async () => {
    const { planQuarter } = await import("@/lib/ai/planner");
    const objs = planQuarter(fakeBrand(), 2026, "Q3", 6).map((p) => p.objective);
    expect(objs).toEqual(["awareness", "consideration", "conversion", "awareness", "consideration", "conversion"]);
  });
});

describe("intent-first brainstorm (planner redesign)", () => {
  it("shapes the objective arc to the goal's intent", async () => {
    const { brainstormProjects } = await import("@/lib/ai/planner");
    const brand = fakeBrand();
    const launch = brainstormProjects(brand, { goal: "Launch our new citrus line", count: 3 }).map((p) => p.objective);
    const sale = brainstormProjects(brand, { goal: "End of season sale, 30% off", count: 3 }).map((p) => p.objective);
    expect(launch[0]).toBe("awareness");          // a launch opens by getting noticed
    expect(sale[0]).toBe("conversion");           // a sale opens by pushing the close
    expect(launch).not.toEqual(sale);
  });

  it("weaves the goal into names + rationale and respects count", async () => {
    const { brainstormProjects } = await import("@/lib/ai/planner");
    const out = brainstormProjects(fakeBrand(), { goal: "Spring citrus launch", count: 4 });
    expect(out).toHaveLength(4);
    expect(out[0].name.toLowerCase()).toContain("citrus");
    expect(out[0].rationale.toLowerCase()).toContain("citrus");
    // names within a batch are distinct (no duplicate "Close It" collisions)
    expect(new Set(out.map((p) => p.name)).size).toBe(out.length);
  });

  it("nonce varies the output (give me different ones)", async () => {
    const { brainstormProjects } = await import("@/lib/ai/planner");
    const a = brainstormProjects(fakeBrand(), { goal: "Grow awareness", count: 3, nonce: 0 }).map((p) => p.name).join("|");
    const b = brainstormProjects(fakeBrand(), { goal: "Grow awareness", count: 3, nonce: 1 }).map((p) => p.name).join("|");
    expect(a).not.toBe(b);
  });
});
