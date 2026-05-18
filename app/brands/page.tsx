import { Card, Eyebrow, LinkButton, Section, Empty } from "@/components/ui/primitives";
import { listBrands } from "@/lib/repo";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function BrandsPage() {
  const brands = listBrands();
  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-10">
      <Section
        title="Brands"
        subtitle="Each brand is a complete token system. Quarterly plans and ads are generated against this system."
        action={<LinkButton href="/brands/new">Onboard new brand →</LinkButton>}
      >
        {brands.length === 0 ? (
          <Empty title="No brands yet">
            Augen needs at least one brand. Onboard one and the planner will draft a quarterly plan automatically.
            <div className="mt-6"><LinkButton href="/brands/new">Onboard your first brand →</LinkButton></div>
          </Empty>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {brands.map((b) => (
              <Link key={b.id} href={`/brands/${b.slug}`}>
                <Card className="overflow-hidden transition-colors hover:bg-ink-800">
                  <div
                    className="aspect-[16/9] flex flex-col justify-end p-6 relative"
                    style={{ background: `linear-gradient(135deg, ${b.tokens.palette.primary}, ${b.tokens.palette.accent})` }}
                  >
                    <div className="absolute top-4 right-4 flex gap-1.5">
                      {[b.tokens.palette.background, b.tokens.palette.foreground, b.tokens.palette.secondary].map((c, i) => (
                        <span key={i} className="w-3 h-3 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                      ))}
                    </div>
                    <Eyebrow className="!text-white/80">{b.industry || "brand"} · v{b.tokens.semver}</Eyebrow>
                    <div className="serif text-3xl mt-1 tracking-tight" style={{ color: b.tokens.palette.background }}>
                      {b.name}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="text-sm text-ink-200 line-clamp-2">{b.tagline || b.description || "—"}</div>
                    <div className="text-xs text-ink-400 mt-3">
                      Voice: <span className="text-ink-200">{b.tokens.voice.tone.slice(0, 2).join(", ")}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
