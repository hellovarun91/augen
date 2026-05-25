import type { BrandTokens } from "@/lib/types";

export interface FigmaPullResult {
  fileKey: string;
  collectionName: string;
  tokens: Partial<BrandTokens>;
  variables: Array<{ name: string; type: string; value: any; resolved: any }>;
  warnings: string[];
}

const FIGMA_BASE = "https://api.figma.com/v1";

export function figmaToken(): string | null {
  return process.env.FIGMA_PERSONAL_ACCESS_TOKEN || null;
}

export function parseFileKey(input: string): string | null {
  // Accept file URL or raw key
  const m = input.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9]{10,}$/.test(input)) return input;
  return null;
}

export async function pullVariables(fileUrlOrKey: string): Promise<FigmaPullResult> {
  const token = figmaToken();
  if (!token) throw new Error("FIGMA_PERSONAL_ACCESS_TOKEN not set");
  const key = parseFileKey(fileUrlOrKey);
  if (!key) throw new Error("Could not parse a Figma file key from the URL");

  const headers = { "X-FIGMA-TOKEN": token };
  const resp = await fetch(`${FIGMA_BASE}/files/${key}/variables/local`, { headers });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Figma ${resp.status}: ${body.slice(0, 200)}`);
  }
  const j: any = await resp.json();
  const variables = j?.meta?.variables ? Object.values<any>(j.meta.variables) : [];
  const collections = j?.meta?.variableCollections ? Object.values<any>(j.meta.variableCollections) : [];
  if (!variables.length) {
    return { fileKey: key, collectionName: collections[0]?.name || "(none)", tokens: {}, variables: [], warnings: ["No variables in the file."] };
  }
  const collection = collections[0];
  const modeId: string = collection?.defaultModeId || Object.keys(collection?.valuesByMode || {})[0];

  // Flatten variables into name -> resolved value
  const flat = new Map<string, { type: string; raw: any; resolved: any }>();
  for (const v of variables) {
    const valuesByMode = v.valuesByMode || {};
    const raw = valuesByMode[modeId];
    const resolved = resolveValue(raw, j.meta.variables);
    flat.set(v.name, { type: v.resolvedType, raw, resolved });
  }

  const warnings: string[] = [];
  const tokens: Partial<BrandTokens> = mapToTokens(flat, warnings);

  return {
    fileKey: key,
    collectionName: collection?.name || "(default)",
    tokens,
    variables: Array.from(flat.entries()).map(([name, v]) => ({ name, type: v.type, value: v.raw, resolved: v.resolved })),
    warnings,
  };
}

function resolveValue(raw: any, allVars: any): any {
  if (raw == null) return null;
  if (typeof raw === "object" && raw.type === "VARIABLE_ALIAS") {
    const target = allVars[raw.id];
    if (!target) return null;
    const collectionId = target.variableCollectionId;
    // Best-effort: walk one level
    const valuesByMode = target.valuesByMode || {};
    const firstMode = Object.keys(valuesByMode)[0];
    return resolveValue(valuesByMode[firstMode], allVars);
  }
  if (typeof raw === "object" && raw.r != null && raw.g != null && raw.b != null) {
    return rgbToHex(raw.r, raw.g, raw.b);
  }
  return raw;
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

// Maps Figma Variable names (slash-namespaced) into BrandTokens.
// Conventions:
//   color/background, color/surface, color/foreground, color/primary, color/secondary, color/accent, color/muted
//   font/display, font/body
//   type/headlineSize, type/subheadSize, type/eyebrowSize, type/ctaSize, type/lockerSize, type/tracking
//   scrim/topOpacity, scrim/midOpacity, scrim/bottomOpacity, scrim/coverage, scrim/tint
//   locker/wordmark, locker/locationLine
//   imagery/style, imagery/treatment
function mapToTokens(flat: Map<string, { type: string; raw: any; resolved: any }>, warnings: string[]): Partial<BrandTokens> {
  function pick(name: string): any | undefined {
    return flat.get(name)?.resolved;
  }
  const palette: any = {};
  for (const k of ["background", "surface", "foreground", "primary", "secondary", "accent", "muted"]) {
    const v = pick(`color/${k}`);
    if (typeof v === "string") palette[k] = v;
  }
  const fonts: any = {};
  for (const k of ["display", "body"]) {
    const v = pick(`font/${k}`);
    if (typeof v === "string") fonts[k] = v;
  }
  const type: any = {};
  for (const k of ["headlineSize", "subheadSize", "eyebrowSize", "ctaSize", "lockerSize", "tracking"]) {
    const v = pick(`type/${k}`);
    if (typeof v === "number") type[k] = v;
  }
  const scrim: any = {};
  for (const k of ["topOpacity", "midOpacity", "bottomOpacity", "coverage"]) {
    const v = pick(`scrim/${k}`);
    if (typeof v === "number") scrim[k] = v;
  }
  const scrimTint = pick("scrim/tint");
  if (typeof scrimTint === "string") scrim.tint = scrimTint;

  const locker: any = {};
  const wordmark = pick("locker/wordmark");
  if (typeof wordmark === "string") locker.wordmark = wordmark;
  const locationLine = pick("locker/locationLine");
  if (typeof locationLine === "string") locker.locationLine = locationLine;

  const imagery: any = {};
  const style = pick("imagery/style");
  if (typeof style === "string") imagery.style = style;
  const treatment = pick("imagery/treatment");
  if (typeof treatment === "string") imagery.treatment = treatment;

  if (Object.keys(palette).length === 0) warnings.push("No `color/*` variables found. Add `color/background`, `color/primary`, etc. in Figma Variables.");
  if (Object.keys(fonts).length === 0) warnings.push("No `font/*` variables found.");

  const out: Partial<BrandTokens> = {};
  if (Object.keys(palette).length) out.palette = palette;
  if (Object.keys(fonts).length) out.fonts = fonts;
  if (Object.keys(type).length) out.type = type;
  if (Object.keys(scrim).length) out.scrim = scrim;
  if (Object.keys(locker).length) out.locker = locker;
  if (Object.keys(imagery).length) out.imagery = imagery;
  return out;
}

// Push selected tokens back to a Figma file as Variables. Best-effort.
export async function pushVariables(fileUrlOrKey: string, tokens: BrandTokens): Promise<{ created: number; updated: number; collection: string }> {
  const token = figmaToken();
  if (!token) throw new Error("FIGMA_PERSONAL_ACCESS_TOKEN not set");
  const key = parseFileKey(fileUrlOrKey);
  if (!key) throw new Error("Could not parse a Figma file key");

  // Fetch existing collections + variables to find target.
  const headers: any = { "X-FIGMA-TOKEN": token };
  const meta = await (await fetch(`${FIGMA_BASE}/files/${key}/variables/local`, { headers })).json();
  const collections = meta?.meta?.variableCollections ? Object.values<any>(meta.meta.variableCollections) : [];
  const variables = meta?.meta?.variables ? Object.values<any>(meta.meta.variables) : [];
  let collection = collections.find((c: any) => /augen|brand|tokens/i.test(c.name));
  const variableCollectionIds: any[] = [];
  if (!collection) {
    variableCollectionIds.push({
      action: "CREATE",
      id: "tempCollection:augen",
      name: "Augen Tokens",
      initialModeId: "tempMode:default",
    });
    collection = { id: "tempCollection:augen", name: "Augen Tokens", defaultModeId: "tempMode:default" };
  }
  const modeId = collection.defaultModeId || Object.keys(collection.modes?.[0] || {})[0] || "tempMode:default";

  const desired: Array<{ name: string; type: "COLOR" | "FLOAT" | "STRING"; value: any }> = [];
  for (const [k, v] of Object.entries(tokens.palette)) desired.push({ name: `color/${k}`, type: "COLOR", value: hexToRgb(v) });
  for (const [k, v] of Object.entries(tokens.fonts)) if (v) desired.push({ name: `font/${k}`, type: "STRING", value: v });
  for (const [k, v] of Object.entries(tokens.type)) desired.push({ name: `type/${k}`, type: "FLOAT", value: v });
  for (const [k, v] of Object.entries(tokens.scrim)) {
    if (typeof v === "number") desired.push({ name: `scrim/${k}`, type: "FLOAT", value: v });
    if (typeof v === "string") desired.push({ name: `scrim/${k}`, type: "STRING", value: v });
  }
  desired.push({ name: "locker/wordmark", type: "STRING", value: tokens.locker.wordmark });
  if (tokens.locker.locationLine) desired.push({ name: "locker/locationLine", type: "STRING", value: tokens.locker.locationLine });
  desired.push({ name: "imagery/style", type: "STRING", value: tokens.imagery.style });
  desired.push({ name: "imagery/treatment", type: "STRING", value: tokens.imagery.treatment });

  const variableOps: any[] = [];
  const valueOps: any[] = [];
  let created = 0, updated = 0;

  for (const d of desired) {
    const existing = variables.find((v: any) => v.name === d.name && v.variableCollectionId === collection.id);
    let id = existing?.id;
    if (!id) {
      id = `tempVar:${d.name}`;
      variableOps.push({ action: "CREATE", id, name: d.name, variableCollectionId: collection.id, resolvedType: d.type });
      created++;
    } else {
      updated++;
    }
    valueOps.push({ action: "UPDATE", variableId: id, modeId, value: d.value });
  }

  const body: any = {
    variableCollections: variableCollectionIds,
    variables: variableOps,
    variableModeValues: valueOps,
  };

  const r = await fetch(`${FIGMA_BASE}/files/${key}/variables`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Figma push failed: ${r.status} ${body.slice(0, 300)}`);
  }

  return { created, updated, collection: collection.name };
}

// ---------- Live sync (webhooks v2) ----------

export interface RegisteredWebhook { id: string; teamId: string; endpoint: string }

// Create a FILE_UPDATE webhook for a team. Figma will POST `endpoint` (and echo
// `passcode` in every event) when any file in the team changes.
export async function registerWebhook(teamId: string, endpoint: string, passcode: string, description = "Augen live token sync"): Promise<RegisteredWebhook> {
  const token = figmaToken();
  if (!token) throw new Error("FIGMA_PERSONAL_ACCESS_TOKEN not set");
  if (!/^https:\/\//.test(endpoint)) throw new Error("Figma webhooks require a public HTTPS endpoint (deploy first, or use a tunnel).");
  const r = await fetch(`${FIGMA_BASE.replace("/v1", "")}/v2/webhooks`, {
    method: "POST",
    headers: { "X-FIGMA-TOKEN": token, "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: "FILE_UPDATE", team_id: teamId, endpoint, passcode, description }),
  });
  if (!r.ok) throw new Error(`Figma webhook create failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j: any = await r.json();
  return { id: String(j.id), teamId, endpoint };
}

export async function deleteWebhookRemote(webhookId: string): Promise<void> {
  const token = figmaToken();
  if (!token) return;
  await fetch(`${FIGMA_BASE.replace("/v1", "")}/v2/webhooks/${webhookId}`, { method: "DELETE", headers: { "X-FIGMA-TOKEN": token } });
}

// Merge a pulled token subset onto the brand's current tokens (only overwrite the
// keys Figma actually provided). Returns a full token object ready to persist.
export function mergeTokens(current: BrandTokens, partial: Partial<BrandTokens>): BrandTokens {
  return {
    ...current,
    palette: { ...current.palette, ...(partial.palette || {}) },
    fonts: { ...current.fonts, ...(partial.fonts || {}) },
    type: { ...current.type, ...(partial.type || {}) },
    scrim: { ...current.scrim, ...(partial.scrim || {}) },
    locker: { ...current.locker, ...(partial.locker || {}) },
    imagery: { ...current.imagery, ...(partial.imagery || {}) },
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  };
}
