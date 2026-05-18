import { Badge, Card, Empty, Eyebrow, Section } from "@/components/ui/primitives";
import { getBrandBySlug, listReferences } from "@/lib/repo";
import { notFound } from "next/navigation";
import { UploadRef, StockSearchForm, GenerateForm, DeleteRefButton, ToggleSelectedButton } from "./controls";
import { relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RefsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();
  const refs = listReferences(brand.id);
  const hasStockKey = !!process.env.PEXELS_API_KEY;
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div>
          <Eyebrow>{brand.name} · reference library</Eyebrow>
          <h1 className="serif text-display-lg mt-1 tracking-tight">Photos that condition the work.</h1>
          <p className="text-ink-300 mt-2 max-w-2xl">
            Upload your own. Pull from stock when the key is set. Generate with Gemini when you want a fresh subject in the brand's voice.
            The Art Director chooses from this pool.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={hasStockKey ? "ok" : "neutral"}>Stock {hasStockKey ? "ready" : "needs PEXELS_API_KEY"}</Badge>
          <Badge tone={hasGeminiKey ? "ok" : "neutral"}>Gemini {hasGeminiKey ? "ready" : "needs GEMINI_API_KEY"}</Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <Eyebrow>Upload</Eyebrow>
          <UploadRef brandId={brand.id} />
        </Card>
        <Card className="p-5">
          <Eyebrow>Stock search</Eyebrow>
          <StockSearchForm brandId={brand.id} disabled={!hasStockKey} />
          {!hasStockKey && <div className="text-[11px] text-ink-400 mt-2">Set PEXELS_API_KEY in .env.local to enable.</div>}
        </Card>
        <Card className="p-5">
          <Eyebrow>Generate</Eyebrow>
          <GenerateForm brandId={brand.id} brandSlug={brand.slug} disabled={!hasGeminiKey} />
          {!hasGeminiKey && <div className="text-[11px] text-ink-400 mt-2">Set GEMINI_API_KEY in .env.local to enable.</div>}
        </Card>
      </div>

      <Section title={`Library — ${refs.length}`} subtitle="Selected references feed the Art Director directly.">
        {refs.length === 0 ? (
          <Empty title="No references yet">Upload, search stock, or generate one to start.</Empty>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {refs.map((r) => (
              <Card key={r.id} className="overflow-hidden">
                <div className="aspect-[4/3] bg-ink-800 relative">
                  {r.file_path && (
                    // Direct img — file is served from /public/refs/
                    <img src={publicSrc(r.file_path)} alt={r.label || r.prompt || "reference"} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <Badge tone={r.kind === "upload" ? "info" : r.kind === "stock" ? "ok" : "warn"}>{r.kind}</Badge>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <div className="text-xs text-ink-200 line-clamp-1">{r.label || r.prompt || r.source}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-ink-400">{relativeDate(r.created_at)}</span>
                    <div className="flex items-center gap-2">
                      <ToggleSelectedButton refId={r.id} selected={r.selected === 1} />
                      <DeleteRefButton refId={r.id} />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function publicSrc(fp: string | null): string {
  if (!fp) return "";
  if (fp.startsWith("/api/refs/")) return fp;
  // Legacy shapes: /refs/<name> or absolute /…/public/refs/<name>
  if (fp.startsWith("/refs/")) return `/api/refs/${fp.slice("/refs/".length)}`;
  const slash = fp.lastIndexOf("/");
  return slash >= 0 ? `/api/refs/${fp.slice(slash + 1)}` : `/api/refs/${fp}`;
}
