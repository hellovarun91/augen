// Session helpers — light cookie-based auth + brand scoping.
import { cookies } from "next/headers";
import { getCurrentUser, listMembershipsForUser, UserRow } from "./users";
import { Brand } from "./types";
import { getBrand, listBrandsForUser } from "./repo";

const BRAND_COOKIE = "augen_bid";

export async function getSession(): Promise<{
  user: UserRow | null;
  brands: Brand[];
  activeBrand: Brand | null;
}> {
  const user = await getCurrentUser();
  if (!user) return { user: null, brands: [], activeBrand: null };
  const brands = listBrandsForUser(user.id);
  const c = await cookies();
  const explicit = c.get(BRAND_COOKIE)?.value;
  const active = explicit && brands.find((b) => b.id === explicit)
    ? brands.find((b) => b.id === explicit)!
    : brands[0] || null;
  return { user, brands, activeBrand: active };
}

export async function setActiveBrand(brandId: string) {
  const c = await cookies();
  c.set(BRAND_COOKIE, brandId, { httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function getActiveBrandId(): Promise<string | null> {
  const { activeBrand } = await getSession();
  return activeBrand?.id || null;
}
