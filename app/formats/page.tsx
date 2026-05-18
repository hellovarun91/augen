import { Card, Eyebrow, Section, Badge } from "@/components/ui/primitives";
import { formatsByPlatform } from "@/lib/formats";

export default function FormatsPage() {
  const groups = formatsByPlatform();
  return (
    <div className="px-8 py-10 max-w-7xl mx-auto space-y-10">
      <div>
        <Eyebrow>Spec library</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Format catalog</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Augen ships ad-platform sizes for Meta, Google, LinkedIn, Pinterest, TikTok, X, Snap, and Reddit. Toggle any of these on per
          campaign — the engine renders to spec.
        </p>
      </div>

      {Object.entries(groups).map(([platform, list]) => (
        <Section key={platform} title={platform}>
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
            {list.map((f) => (
              <Card key={f.slug} className="p-5 space-y-3">
                <div className="aspect-[4/3] rounded-lg bg-ink-800 ring-1 ring-white/5 flex items-center justify-center relative overflow-hidden">
                  <div
                    className="bg-ink-100 ring-1 ring-white/30"
                    style={{
                      width: `${(f.width / Math.max(f.width, f.height)) * 70}%`,
                      height: `${(f.height / Math.max(f.width, f.height)) * 70}%`,
                    }}
                  />
                </div>
                <div>
                  <div className="serif text-base">{f.name}</div>
                  <div className="text-xs text-ink-400 mt-1">{f.aspect} · {f.width}×{f.height}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{f.channel}</Badge>
                  <span className="text-[11px] text-ink-400">{f.placement}</span>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}
