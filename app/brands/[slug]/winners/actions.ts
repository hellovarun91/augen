"use server";
import { createExternalWinner, deleteExternalWinner } from "@/lib/repo";
import { revalidatePath } from "next/cache";
import { requireBrandAccess } from "@/lib/authz";
import { db } from "@/lib/db";

export async function addWinnerAction(brandId: string, brandSlug: string, fd: FormData) {
  await requireBrandAccess(brandId);
  const headline = String(fd.get("headline") || "").trim();
  if (!headline) throw new Error("Headline required");
  createExternalWinner({
    brandId,
    headline,
    subhead: String(fd.get("subhead") || "").trim() || undefined,
    cta: String(fd.get("cta") || "").trim() || undefined,
    eyebrow: String(fd.get("eyebrow") || "").trim() || undefined,
    formatSlug: String(fd.get("format_slug") || "").trim() || undefined,
    source: String(fd.get("source") || "manual"),
    notes: String(fd.get("notes") || "").trim() || undefined,
    metricLabel: String(fd.get("metric_label") || "").trim() || undefined,
  });
  revalidatePath(`/brands/${brandSlug}/winners`);
}

export async function deleteWinnerAction(id: string) {
  const row = db().prepare("SELECT brand_id FROM external_winners WHERE id = ?").get(id) as { brand_id: string } | undefined;
  if (!row) throw new Error("Winner not found");
  await requireBrandAccess(row.brand_id);
  deleteExternalWinner(id);
  revalidatePath("/brands/[slug]/winners", "page");
}

export async function importCsvAction(brandId: string, brandSlug: string, fd: FormData): Promise<{ added: number }> {
  await requireBrandAccess(brandId);
  let csv = "";
  const file = fd.get("file") as File | null;
  if (file && file.size) csv = await file.text();
  if (!csv) csv = String(fd.get("paste") || "");
  csv = csv.trim();
  if (!csv) throw new Error("Provide a file or paste CSV");

  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("CSV needs a header row + at least one data row");
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => h.trim().toLowerCase());

  let added = 0;
  for (const r of dataRows) {
    const get = (name: string) => {
      const i = headers.indexOf(name);
      return i >= 0 ? (r[i] || "").trim() : "";
    };
    const headline = get("headline");
    if (!headline) continue;
    createExternalWinner({
      brandId,
      headline,
      subhead: get("subhead") || undefined,
      cta: get("cta") || undefined,
      eyebrow: get("eyebrow") || undefined,
      formatSlug: get("format_slug") || undefined,
      source: get("source") || "manual",
      notes: get("notes") || undefined,
      metricLabel: get("metric_label") || undefined,
    });
    added++;
  }
  revalidatePath(`/brands/${brandSlug}/winners`);
  return { added };
}

// Tiny CSV parser supporting double-quoted fields with commas + escaped quotes.
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
