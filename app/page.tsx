import { Card, Eyebrow, LinkButton, Section, Empty } from "@/components/ui/primitives";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Brand Board — the home after sign-in. Pick a brand to manage it and open its
// Studio, or onboard a new one. Nothing brand-specific until you choose one.
export default async function BrandBoard() {
  const { user, brands } = await getSession();
  if (!user) redirect("/signin");

  if (brands.length === 0) {
    return (
      <div className="px-8 py-16 max-w-3xl mx-auto space-y-8 text-center">
        <Eyebrow>Welcome</Eyebrow>
        <h1 className="serif text-display-xl tracking-tight">A studio without a brand is just an empty room.</h1>
        <p className="text-ink-300 text-base md:text-lg">
          Onboard a brand and Augen synthesizes a full token system — palette, type, voice — ready to design against.
        </p>
        <div className="flex justify-center">
          <LinkButton href="/brands/new" size="lg">Onboard your first brand →</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-10">
      <Section
        title="Your brands"
        subtitle="Each brand is a complete design system. Pick one to manage it and open its Studio."
        action={<LinkButton href="/brands/new">Onboard new brand →</LinkButton>}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {brands.map((b) => (
            <Link key={b.id} href={`/brands/${b.slug}`}>
              <Card className="overflow-hidden transition-colors hover:bg-ink-800 h-full">
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

          <Link href="/brands/new">
            <Card className="h-full min-h-[220px] flex flex-col items-center justify-center gap-3 border-dashed border border-white/10 bg-transparent hover:bg-white/[0.02] transition-colors">
              <span className="w-10 h-10 rounded-full ring-1 ring-white/15 flex items-center justify-center text-xl text-ink-200">+</span>
              <span className="text-sm text-ink-300">Onboard new brand</span>
            </Card>
          </Link>
        </div>
      </Section>
    </div>
  );
}
