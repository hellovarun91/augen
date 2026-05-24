// Anthropic pricing in USD per million tokens.
// Defaults match Claude Sonnet 4.6 published rates; override per-deployment via env.

export interface ClaudePricing {
  input: number;        // $ / MTok
  output: number;       // $ / MTok
  cacheWrite: number;   // $ / MTok
  cacheRead: number;    // $ / MTok
}

export function getPricing(): ClaudePricing {
  return {
    input: num(process.env.ANTHROPIC_PRICE_IN_PER_MTOK, 3.0),
    output: num(process.env.ANTHROPIC_PRICE_OUT_PER_MTOK, 15.0),
    cacheWrite: num(process.env.ANTHROPIC_PRICE_CACHE_WRITE_PER_MTOK, 3.75),
    cacheRead: num(process.env.ANTHROPIC_PRICE_CACHE_READ_PER_MTOK, 0.30),
  };
}

export interface UsageNumbers {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export function computeCostMicros(usage: UsageNumbers, pricing = getPricing()): number {
  // Cost in USD = sum of (tokens / 1e6) * pricePerMTok. We return as integer micros (USD * 1_000_000).
  const dollars =
    (usage.input_tokens / 1e6) * pricing.input +
    (usage.output_tokens / 1e6) * pricing.output +
    (usage.cache_creation_input_tokens / 1e6) * pricing.cacheWrite +
    (usage.cache_read_input_tokens / 1e6) * pricing.cacheRead;
  return Math.round(dollars * 1e6);
}

export function microsToUsd(micros: number): number {
  return micros / 1e6;
}

export function formatUsd(micros: number): string {
  const usd = microsToUsd(micros);
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(5)}`;
}

export function budgetUsd(): number | null {
  const v = process.env.ANTHROPIC_BUDGET_USD;
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// Image-generation price per image (USD). Defaults to a Gemini flash-image
// ballpark; override with AUGEN_PRICE_IMAGE_USD as real rates settle.
export function imagePriceUsd(): number {
  return num(process.env.AUGEN_PRICE_IMAGE_USD, 0.04);
}

export function imagePriceMicros(): number {
  return Math.round(imagePriceUsd() * 1e6);
}

function num(v: string | undefined, d: number): number {
  if (!v) return d;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
}
