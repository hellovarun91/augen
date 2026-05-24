"use server";
import { getBrand, setCopySchema } from "@/lib/repo";
import { inferCopySchema } from "@/lib/ai/copy-schema-infer";
import { CopySchema } from "@/lib/copy-schema";
import { requireBrandAccess } from "@/lib/authz";
import { revalidatePath } from "next/cache";

export async function inferSchemaAction(brandId: string, docText: string) {
  await requireBrandAccess(brandId);
  const brand = getBrand(brandId);
  if (!docText.trim()) throw new Error("Paste your copy doc first.");
  const r = await inferCopySchema(docText, brand?.name);
  return { schema: r.schema, rationale: r.rationale, provider: r.provider };
}

export async function saveSchemaAction(brandId: string, slug: string, schema: unknown) {
  await requireBrandAccess(brandId);
  const parsed = CopySchema.parse(schema);
  setCopySchema(brandId, parsed);
  revalidatePath(`/brands/${slug}/copy`);
  revalidatePath(`/brands/${slug}`);
}
