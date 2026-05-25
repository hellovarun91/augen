import type { BrandTokens } from "@/lib/types";
import { BrandTokens as BrandTokensSchema } from "@/lib/types";
import { getClaude, claudeModel, claudeMaxTokens, extractToolUse } from "@/lib/agents/adapters/claude";

// A Figma variable as read by the plugin.
export interface FigmaVar { name: string; value: string | number; type?: string }

// The Augen token slots a mapping targets. Colors + fonts (the visually dominant
// tokens); designers map their arbitrary variables onto these.
export const TOKEN_SLOTS: { key: string; label: string; kind: "color" | "font" }[] = [
  { key: "palette.background", label: "Background", kind: "color" },
  { key: "palette.surface", label: "Surface", kind: "color" },
  { key: "palette.foreground", label: "Foreground (text)", kind: "color" },
  { key: "palette.primary", label: "Primary", kind: "color" },
  { key: "palette.secondary", label: "Secondary", kind: "color" },
  { key: "palette.accent", label: "Accent", kind: "color" },
  { key: "palette.muted", label: "Muted", kind: "color" },
  { key: "fonts.display", label: "Display font", kind: "font" },
  { key: "fonts.body", label: "Body font", kind: "font" },
];

export type TokenMapping = Record<string, string>; // slotKey -> variable name

const isHex = (v: any) => typeof v === "string" && /^#?[0-9a-f]{6}$/i.test(v.trim());
const isFontish = (v: any) => typeof v === "string" && !isHex(v) && v.trim().length > 0;

function hexToHsl(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255, g = parseInt(m.slice(2, 4), 16) / 255, b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return [h * 360, s * 100, l * 100];
}

// Deterministic mapping: name keywords first, then value-based fallback for colors.
export function heuristicMapping(vars: FigmaVar[]): TokenMapping {
  const colors = vars.filter((v) => isHex(v.value)).map((v) => ({ name: v.name, hex: String(v.value), hsl: hexToHsl(String(v.value)) }));
  const fonts = vars.filter((v) => isFontish(v.value));
  const map: TokenMapping = {};
  const nameHas = (n: string, kws: string[]) => kws.some((k) => n.toLowerCase().includes(k));

  const pickColor = (kws: string[]) => colors.find((c) => nameHas(c.name, kws));
  const byName: Record<string, string[]> = {
    "palette.background": ["background", "/bg", "bg/", "canvas", "page"],
    "palette.surface": ["surface", "card", "elevated", "container", "panel"],
    "palette.foreground": ["foreground", "text", "ink", "on-surface", "onsurface", "content", "fg"],
    "palette.primary": ["primary", "brand", "accent-primary"],
    "palette.secondary": ["secondary"],
    "palette.accent": ["accent", "highlight", "cta"],
    "palette.muted": ["muted", "neutral", "gray", "grey", "subtle", "tertiary"],
  };
  for (const [slot, kws] of Object.entries(byName)) { const c = pickColor(kws); if (c) map[slot] = c.name; }

  // Value-based fallback for any unfilled color slot.
  if (colors.length) {
    const used = () => new Set(Object.values(map));
    const free = () => colors.filter((c) => !used().has(c.name));
    const byLightDesc = [...colors].sort((a, b) => b.hsl[2] - a.hsl[2]);
    const bySatDesc = [...colors].sort((a, b) => b.hsl[1] - a.hsl[1]);
    if (!map["palette.background"]) map["palette.background"] = (free().length ? free() : colors).sort((a, b) => b.hsl[2] - a.hsl[2])[0]?.name;
    if (!map["palette.foreground"]) map["palette.foreground"] = (free().length ? free() : colors).sort((a, b) => a.hsl[2] - b.hsl[2])[0]?.name;
    if (!map["palette.primary"]) map["palette.primary"] = (free().length ? free() : colors).sort((a, b) => b.hsl[1] - a.hsl[1])[0]?.name;
    if (!map["palette.surface"]) map["palette.surface"] = (free()[0] || byLightDesc[1])?.name;
    if (!map["palette.accent"]) map["palette.accent"] = (free().find((c) => c.hsl[1] > 40) || bySatDesc[1])?.name;
    if (!map["palette.secondary"]) map["palette.secondary"] = (free()[0] || bySatDesc[2])?.name;
    if (!map["palette.muted"]) map["palette.muted"] = (free()[0] || colors.find((c) => c.hsl[1] < 20))?.name;
  }

  const displayFont = fonts.find((f) => nameHas(f.name, ["display", "heading", "head", "title", "serif"])) || fonts[0];
  const bodyFont = fonts.find((f) => nameHas(f.name, ["body", "text", "paragraph", "sans", "regular"]) && f.name !== displayFont?.name) || fonts.find((f) => f.name !== displayFont?.name) || fonts[0];
  if (displayFont) map["fonts.display"] = displayFont.name;
  if (bodyFont) map["fonts.body"] = bodyFont.name;

  // Drop any slot whose value ended up undefined.
  for (const k of Object.keys(map)) if (!map[k]) delete map[k];
  return map;
}

// Claude proposes a mapping; falls back to the heuristic with no key / on error.
export async function proposeTokenMapping(vars: FigmaVar[]): Promise<{ mapping: TokenMapping; viaAI: boolean }> {
  const client = getClaude();
  if (!client || !vars.length) return { mapping: heuristicMapping(vars), viaAI: false };
  try {
    const colorVars = vars.filter((v) => isHex(v.value)).map((v) => `${v.name} = ${v.value}`);
    const fontVars = vars.filter((v) => isFontish(v.value)).map((v) => `${v.name} = ${v.value}`);
    const resp = await client.messages.create({
      model: claudeModel(),
      max_tokens: claudeMaxTokens(),
      system: `You map a brand's Figma Variables onto a fixed set of ad-design token slots. Choose the single best-fitting variable for each slot. Use the variable NAMES and hex/values: backgrounds are the lightest (or page/canvas) color, foreground is the main text color (usually darkest), primary is the dominant brand color, accent is a bright highlight, muted is a neutral/gray. Display = heading/title font; body = paragraph font. Only assign a slot if there's a sensible match; omit otherwise. Return variable names EXACTLY as given.`,
      messages: [{ role: "user", content: `Color variables:\n${colorVars.join("\n") || "(none)"}\n\nFont/text variables:\n${fontVars.join("\n") || "(none)"}\n\nMap to slots: background, surface, foreground, primary, secondary, accent, muted, displayFont, bodyFont.` }],
      tools: [{
        name: "emit_mapping",
        description: "Return the chosen variable name for each slot (omit slots with no good match).",
        input_schema: {
          type: "object",
          properties: {
            background: { type: "string" }, surface: { type: "string" }, foreground: { type: "string" },
            primary: { type: "string" }, secondary: { type: "string" }, accent: { type: "string" }, muted: { type: "string" },
            displayFont: { type: "string" }, bodyFont: { type: "string" },
          },
        },
      }],
      tool_choice: { type: "tool", name: "emit_mapping" },
    });
    const out = extractToolUse<any>(resp, "emit_mapping");
    const names = new Set(vars.map((v) => v.name));
    const map: TokenMapping = {};
    const put = (slot: string, val: any) => { if (typeof val === "string" && names.has(val)) map[slot] = val; };
    put("palette.background", out.background); put("palette.surface", out.surface); put("palette.foreground", out.foreground);
    put("palette.primary", out.primary); put("palette.secondary", out.secondary); put("palette.accent", out.accent); put("palette.muted", out.muted);
    put("fonts.display", out.displayFont); put("fonts.body", out.bodyFont);
    // Fill any gaps the model left with the heuristic.
    const h = heuristicMapping(vars);
    for (const k of Object.keys(h)) if (!map[k]) map[k] = h[k];
    return { mapping: map, viaAI: true };
  } catch {
    return { mapping: heuristicMapping(vars), viaAI: false };
  }
}

function normHex(v: string): string { const h = v.trim().replace(/^#?/, "#"); return h.length === 7 ? h : v; }

// Build a full BrandTokens by applying a slot->variableName mapping against the
// current file's variable values.
export function applyMapping(current: BrandTokens, mapping: TokenMapping, vars: FigmaVar[]): BrandTokens {
  const byName: Record<string, string | number> = {};
  for (const v of vars) byName[v.name] = v.value;
  const next: any = JSON.parse(JSON.stringify(current));
  for (const slot of TOKEN_SLOTS) {
    const varName = mapping[slot.key];
    if (!varName || !(varName in byName)) continue;
    const val = byName[varName];
    const [group, key] = slot.key.split(".");
    if (slot.kind === "color" && isHex(val)) next[group][key] = normHex(String(val));
    else if (slot.kind === "font" && typeof val === "string") next[group][key] = val;
  }
  return BrandTokensSchema.parse(next);
}
