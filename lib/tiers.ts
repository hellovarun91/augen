// Tier metadata — safe to import from client components.
// The pricing constants live here. Behavioral helpers (charging, granting) stay in credits.ts.

export type Tier = "trial" | "studio" | "pro" | "enterprise";

export interface TierDef {
  id: Tier;
  label: string;
  monthlyGrant: number;
  resetsMonthly: boolean;
  pricePerMonthUsd: number | null;
  description: string;
}

function numEnv(name: string, def: number): number {
  const v = typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (!v) return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

export const TIERS: Record<Tier, TierDef> = {
  trial: {
    id: "trial",
    label: "Trial",
    monthlyGrant: numEnv("AUGEN_TIER_TRIAL_CREDITS", 50),
    resetsMonthly: false,
    pricePerMonthUsd: 0,
    description: "Get a feel for the studio. Credits don't reset.",
  },
  studio: {
    id: "studio",
    label: "Studio",
    monthlyGrant: numEnv("AUGEN_TIER_STUDIO_CREDITS", 500),
    resetsMonthly: true,
    pricePerMonthUsd: 29,
    description: "Solo operators and small teams. ~100 ads / month.",
  },
  pro: {
    id: "pro",
    label: "Pro",
    monthlyGrant: numEnv("AUGEN_TIER_PRO_CREDITS", 2000),
    resetsMonthly: true,
    pricePerMonthUsd: 99,
    description: "Multi-brand teams. ~400 ads / month with real images.",
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    monthlyGrant: numEnv("AUGEN_TIER_ENTERPRISE_CREDITS", 20000),
    resetsMonthly: true,
    pricePerMonthUsd: null,
    description: "Custom contracts. Talk to us.",
  },
};
