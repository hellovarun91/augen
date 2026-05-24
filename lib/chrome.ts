// Chrome context — resolves which brand the app shell (sidebar / mobile nav)
// should be scoped to, based on the URL the user is actually viewing rather
// than only the persisted cookie. This keeps the Manage/Studio nav correct even
// on a deep link or bookmark.
import { headers } from "next/headers";
import { getSession } from "./session";
import { getBrandBySlug, getCampaign, getBrand, getGeneration } from "./repo";
import type { Brand } from "./types";

export type ChromeSection = "board" | "brand" | "studio" | "settings";

export interface ChromeContext {
  user: Awaited<ReturnType<typeof getSession>>["user"];
  brands: Brand[];
  activeBrand: Brand | null;   // cookie-persisted "last used" brand
  contextBrand: Brand | null;  // brand implied by the current URL (what the nav scopes to)
  section: ChromeSection;
  pathname: string;
}

const SETTINGS_PATHS = ["/formats", "/credits", "/providers", "/usage"];

export async function getChromeContext(): Promise<ChromeContext> {
  const session = await getSession();
  const h = await headers();
  const pathname = h.get("x-pathname") || "/";

  let contextBrand: Brand | null = null;
  let section: ChromeSection = "board";

  const brandMatch = pathname.match(/^\/brands\/([^/]+)/);
  const campaignMatch = pathname.match(/^\/campaigns\/([^/]+)/);
  const adMatch = pathname.match(/^\/ads\/([^/]+)/);

  if (brandMatch && brandMatch[1] !== "new") {
    contextBrand = getBrandBySlug(brandMatch[1]);
    section = "brand";
  } else if (campaignMatch) {
    const camp = getCampaign(campaignMatch[1]);
    if (camp) contextBrand = getBrand(camp.brand_id);
    section = "studio";
  } else if (adMatch) {
    const gen = getGeneration(adMatch[1]);
    if (gen) contextBrand = getBrand(gen.brand_id);
    section = "studio";
  } else if (pathname === "/campaigns" || pathname.startsWith("/review")) {
    // Brand-scoped studio surfaces that have no brand id in the URL.
    contextBrand = session.activeBrand;
    section = "studio";
  } else if (SETTINGS_PATHS.some((p) => pathname.startsWith(p))) {
    section = "settings";
  }

  return { ...session, contextBrand, section, pathname };
}
