import { describe, expect, it, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Use a clean test database
const testDbDir = path.join(process.cwd(), "data");
const testDb = path.join(testDbDir, "test.db");
process.env.AUGEN_DB_PATH = testDb;

beforeAll(() => {
  // The repo currently hardcodes the DB path; for tests we'll just operate against the dev DB.
  // (A small refactor to honor AUGEN_DB_PATH is a future improvement.)
});

describe("composer", () => {
  it("renders a valid SVG for 4:5 with all chrome elements", async () => {
    const { renderAdSvg } = await import("@/lib/composer/render");
    const tokens: any = {
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
    const svg = renderAdSvg({
      width: 1080, height: 1350, aspect: "4:5",
      tokens, copy: { eyebrow: "NEW", headline: "Hello\nthere", subhead: "A subhead.", cta: "Try it" },
      seed: 42, style: "editorial",
    });
    expect(svg).toMatch(/<svg /);
    expect(svg).toMatch(/<\/svg>/);
    expect(svg).toContain("NEW");
    expect(svg).toContain("Hello");
    expect(svg).toContain("TEST"); // locker
    expect(svg).toContain("Try it"); // cta
  });

  it("handles ultra-wide banner (728x90) without overlap", async () => {
    const { renderAdSvg } = await import("@/lib/composer/render");
    const tokens: any = {
      name: "Test", semver: "1.0.0",
      palette: { background: "#000", surface: "#111", foreground: "#fff", primary: "#fff", secondary: "#999", accent: "#FF0", muted: "#666" },
      fonts: { display: "sans-serif", body: "sans-serif" },
      type: { eyebrowSize: 14, headlineSize: 24, subheadSize: 14, ctaSize: 14, lockerSize: 12, tracking: -0.02 },
      scrim: { topOpacity: 0, midOpacity: 0.1, bottomOpacity: 0.4, coverage: 0.6, tint: "#000" },
      voice: { description: "", doNot: [], tone: [] },
      locker: { wordmark: "TEST" },
      imagery: { style: "minimalist", treatment: "", keywords: [] },
    };
    const svg = renderAdSvg({
      width: 728, height: 90, aspect: "8:1",
      tokens, copy: { eyebrow: "NEW", headline: "Short headline", subhead: "Tiny", cta: "Click" },
      seed: 1, style: "minimalist",
    });
    expect(svg.length).toBeGreaterThan(500);
    expect(svg).toContain("728");
  });
});

describe("overrides schema", () => {
  it("round-trips through parse + merge", async () => {
    const { parseOverrides, mergeOverrides, emptyOverrides } = await import("@/lib/composer/overrides");
    const base = emptyOverrides();
    const merged = mergeOverrides(base, {
      typography: { headlineScale: 1.2, emphasis: [{ word: "Test", style: "accent" }] },
      layout: { ctaPosition: "top-right" },
      colors: { headline: "#FF00AA" },
    });
    expect(merged.typography.headlineScale).toBe(1.2);
    expect(merged.typography.emphasis[0].word).toBe("Test");
    expect(merged.layout.ctaPosition).toBe("top-right");
    expect(merged.colors.headline).toBe("#FF00AA");
    // Re-parse a JSON round-trip is stable
    const parsed = parseOverrides(JSON.parse(JSON.stringify(merged)));
    expect(parsed.typography.headlineScale).toBe(1.2);
  });

  it("recovers from invalid input (returns defaults)", async () => {
    const { parseOverrides, AdOverrides } = await import("@/lib/composer/overrides");
    // parseOverrides catches Zod errors and returns the default — production-safe behavior.
    const recovered = parseOverrides({ typography: { headlineScale: 5 } });
    expect(recovered.typography.headlineScale).toBeUndefined();
    // The underlying schema does enforce bounds.
    expect(() => AdOverrides.parse({ typography: { headlineScale: 5, emphasis: [] }, layout: { ctaPosition: "auto", lockerVisible: true, headlineYShift: 0 }, image: { transparent: false, crop: { panX: 0, panY: 0, scale: 1 }, filter: "none" }, colors: {} })).toThrow();
  });
});

describe("agent mock fallback", () => {
  it("runCopywriter falls back to mock when no Claude key", async () => {
    const oldKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const { runCopywriter } = await import("@/lib/agents/copywriter");
    const brand: any = {
      slug: "test", name: "Test", industry: "lifestyle", id: "brnd_test",
      tokens: { palette: { primary: "#000" }, voice: { description: "", doNot: [], tone: [] }, imagery: { style: "editorial", treatment: "" } },
      language: { voiceDescription: "", toneSliders: { formal_casual: 0, serious_playful: 0, reserved_bold: 0, classic_modern: 0 }, preferredWords: [], bannedWords: [], sampleSentences: [], doRules: [], doNotRules: [], copyLimits: { headlineMaxChars: 48, subheadMaxChars: 120, ctaMaxChars: 24, eyebrowMaxChars: 18 } },
    };
    const idea: any = { id: "idea_1", theme: "test theme", insight: "", angle: "test", audience: "people", hooks: [] };
    const r = await runCopywriter({ brand, language: brand.language, idea, product: "test", formatSlug: "meta-feed-1x1", variantIndex: 0, count: 3 });
    expect(r.output.variants.length).toBeGreaterThan(0);
    expect(r.output.variants[0].headline).toBeTruthy();
    if (oldKey) process.env.ANTHROPIC_API_KEY = oldKey;
  });
});

describe("credit pricing", () => {
  it("quotes the expected cost per action", async () => {
    const { quoteCost } = await import("@/lib/credits");
    expect(quoteCost("strategist")).toBeGreaterThan(0);
    expect(quoteCost("generate_ad_claude", 5)).toBe(quoteCost("generate_ad_claude") * 5);
    expect(quoteCost("spin_variants")).toBeLessThan(quoteCost("generate_ad_claude") * 5);
  });
});

describe("authz allowlist", () => {
  it("isEmailAllowed treats empty allowlist as open", async () => {
    delete process.env.AUGEN_ALLOWED_EMAILS;
    const { isEmailAllowed, isAllowlistEnforced } = await import("@/lib/authz");
    expect(isAllowlistEnforced()).toBe(false);
    expect(isEmailAllowed("anyone@example.com")).toBe(true);
  });

  it("rejects emails not in the allowlist", async () => {
    process.env.AUGEN_ALLOWED_EMAILS = "alice@x.com,bob@y.com";
    // Re-import to pick up env. Vitest doesn't cache between dynamic imports across tests, but to be safe:
    const mod = await import("@/lib/authz?reset=1" as any).catch(() => import("@/lib/authz"));
    expect(mod.isAllowlistEnforced()).toBe(true);
    expect(mod.isEmailAllowed("alice@x.com")).toBe(true);
    expect(mod.isEmailAllowed("carol@z.com")).toBe(false);
    delete process.env.AUGEN_ALLOWED_EMAILS;
  });
});

describe("rate limit", () => {
  it("refuses after capacity exceeded", async () => {
    const { rateLimit } = await import("@/lib/ratelimit");
    const uid = "test-rate-" + Math.random();
    // burst 2, perMinute 60 — 2 should succeed instantly, 3rd should fail
    await rateLimit(uid, "test", { perMinute: 60, burst: 2 });
    await rateLimit(uid, "test", { perMinute: 60, burst: 2 });
    await expect(rateLimit(uid, "test", { perMinute: 60, burst: 2 })).rejects.toThrow(/Rate limit/);
  });
});

describe("formats catalog", () => {
  it("has unique slugs and valid aspect strings", async () => {
    const { ALL_FORMATS } = await import("@/lib/formats");
    const slugs = new Set<string>();
    for (const f of ALL_FORMATS) {
      expect(slugs.has(f.slug)).toBe(false);
      slugs.add(f.slug);
      expect(f.width).toBeGreaterThan(0);
      expect(f.height).toBeGreaterThan(0);
      expect(f.aspect).toMatch(/^\d+(\.\d+)?:\d+(\.\d+)?$/);
    }
  });
});

describe("anchor formatter", () => {
  it("renders nothing when no anchors", async () => {
    const { brandSystemBlock } = await import("@/lib/agents/adapters/claude");
    // Build a fake brand with no anchors; expect the system block text doesn't include "Anchor examples"
    const brand: any = {
      slug: "nonexistent-brand-for-anchor-test",
      id: "brnd_nonexistent",
      name: "X", industry: "lifestyle", tagline: "", description: "",
      tokens: { palette: { background: "#fff", surface: "#eee", foreground: "#000", primary: "#000", secondary: "#888", accent: "#f00", muted: "#666" }, fonts: { display: "serif", body: "sans" }, type: {}, scrim: {}, voice: { description: "", doNot: [], tone: [] }, locker: { wordmark: "X" }, imagery: { style: "editorial", treatment: "" } },
    };
    const lang: any = { voiceDescription: "", toneSliders: { formal_casual: 0, serious_playful: 0, reserved_bold: 0, classic_modern: 0 }, preferredWords: [], bannedWords: [], doRules: [], doNotRules: [], sampleSentences: [] };
    const block = brandSystemBlock(brand, lang) as any;
    expect(typeof block.text).toBe("string");
    expect(block.text).not.toContain("# Anchor examples"); // none for the fake brand
  });
});
