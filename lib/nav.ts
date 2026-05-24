// App wayfinding — breadcrumbs (move up) + contextual tabs (move sideways),
// derived from the current URL so they're consistent on every page automatically.
import { headers } from "next/headers";
import { getSession } from "./session";
import { getBrandBySlug, getCampaign, getBrand, getGeneration, getIdea } from "./repo";

export interface Crumb { label: string; href?: string }   // last crumb has no href (current page)
export interface NavTab { label: string; href: string; active: boolean }
export interface AppNav { crumbs: Crumb[]; tabs: NavTab[] | null }

const BRAND_SECTIONS: Array<{ seg: string; label: string }> = [
  { seg: "", label: "Overview" },
  { seg: "identity", label: "Identity" },
  { seg: "language", label: "Voice" },
  { seg: "tokens", label: "Design tokens" },
  { seg: "assets", label: "Assets" },
  { seg: "references", label: "References" },
  { seg: "winners", label: "Winners" },
  { seg: "plan", label: "Planner" },
];

export async function getAppNav(): Promise<AppNav> {
  const h = await headers();
  const pathname = h.get("x-pathname") || "/";

  // No chrome on the board (home) or sign-in.
  if (pathname === "/" || pathname.startsWith("/signin")) return { crumbs: [], tabs: null };

  const crumbs: Crumb[] = [];
  let tabs: NavTab[] | null = null;

  // Admin
  if (pathname.startsWith("/admin")) {
    crumbs.push({ label: "Admin", href: "/admin" });
    const sub: Record<string, string> = { "/admin/costs": "Cost dashboard", "/admin/testers": "Testers", "/admin/users": "Users", "/admin/features": "Feature flags" };
    if (pathname !== "/admin") crumbs.push({ label: sub[pathname] || "Detail" });
    return { crumbs, tabs };
  }

  // Settings-ish global pages
  const settings: Record<string, string> = { "/formats": "Format catalog", "/providers": "AI providers", "/usage": "Token detail", "/credits": "Credits" };
  if (settings[pathname]) return { crumbs: [{ label: settings[pathname] }], tabs };

  // New brand
  if (pathname === "/brands/new") return { crumbs: [{ label: "Brands", href: "/" }, { label: "Onboard brand" }], tabs };

  // Project (and everything under it)
  const camp = pathname.match(/^\/campaigns\/([^/]+)/);
  if (camp) {
    const c = getCampaign(camp[1]);
    const b = c ? getBrand(c.brand_id) : null;
    crumbs.push({ label: "Brands", href: "/" });
    if (b) crumbs.push({ label: b.name, href: `/brands/${b.slug}` });
    crumbs.push({ label: "Projects", href: "/campaigns" });
    if (c) crumbs.push({ label: c.name, href: `/campaigns/${c.id}` });

    const ideaM = pathname.match(/\/ideas\/([^/]+)\/(lab|variations)/);
    if (ideaM) {
      const idea = getIdea(ideaM[1]);
      crumbs.push({ label: idea?.theme || "Idea" });
      crumbs.push({ label: ideaM[2] === "lab" ? "Copy Lab" : "Variations" });
    } else if (pathname.endsWith("/agents")) {
      crumbs.push({ label: "Agent chain" });
    } else if (pathname.includes("/deliverables")) {
      crumbs.push({ label: "Deliverables" });
    } else if (pathname.includes("/copy")) {
      crumbs.push({ label: "Copy" });
    }
    // Mark the project crumb (second-to-last when deeper) non-current; last crumb stays current.
    if (crumbs.length) delete crumbs[crumbs.length - 1].href;
    return { crumbs, tabs };
  }

  // Projects index + Review are brand-scoped via the active brand
  if (pathname === "/campaigns" || pathname.startsWith("/review")) {
    const { activeBrand } = await getSession();
    crumbs.push({ label: "Brands", href: "/" });
    if (activeBrand) crumbs.push({ label: activeBrand.name, href: `/brands/${activeBrand.slug}` });
    crumbs.push({ label: pathname === "/campaigns" ? "Projects" : "Review" });
    return { crumbs, tabs };
  }

  // Ad detail
  const ad = pathname.match(/^\/ads\/([^/]+)/);
  if (ad) {
    const g = getGeneration(ad[1]);
    const b = g ? getBrand(g.brand_id) : null;
    const c = g ? getCampaign(g.campaign_id) : null;
    crumbs.push({ label: "Brands", href: "/" });
    if (b) crumbs.push({ label: b.name, href: `/brands/${b.slug}` });
    if (c) crumbs.push({ label: c.name, href: `/campaigns/${c.id}` });
    crumbs.push({ label: "Creative" });
    return { crumbs, tabs };
  }

  // Brand foundation pages
  const brandM = pathname.match(/^\/brands\/([^/]+)/);
  if (brandM) {
    const slug = brandM[1];
    const b = getBrandBySlug(slug);
    crumbs.push({ label: "Brands", href: "/" });
    crumbs.push({ label: b?.name || slug, href: `/brands/${slug}` });
    const rest = pathname.slice(`/brands/${slug}`.length).replace(/^\//, "");
    if (rest) {
      const top = rest.split("/")[0];
      if (top === "tokens") {
        crumbs.push({ label: "Design tokens", href: `/brands/${slug}/tokens` });
        if (rest.includes("/extract")) crumbs.push({ label: "Extract from artwork" });
      } else if (top === "figma") {
        crumbs.push({ label: "Design tokens", href: `/brands/${slug}/tokens` });
        crumbs.push({ label: "Figma sync" });
      } else if (top === "copy") {
        crumbs.push({ label: "Default copy structure" });
      } else {
        const match = BRAND_SECTIONS.find((s) => s.seg === top);
        crumbs.push({ label: match?.label || top });
      }
    }
    if (crumbs.length) delete crumbs[crumbs.length - 1].href;
    return { crumbs, tabs };
  }

  return { crumbs, tabs };
}
