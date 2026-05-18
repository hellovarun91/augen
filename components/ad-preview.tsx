"use client";
import { cn } from "@/lib/utils";

export function AdPreview({
  generationId,
  width,
  height,
  className,
  rounded = true,
  showLocker = true,
  showScrim = true,
  variant = "v0",
}: {
  generationId: string;
  width: number;
  height: number;
  className?: string;
  rounded?: boolean;
  showLocker?: boolean;
  showScrim?: boolean;
  variant?: string;
}) {
  const src = `/api/render/${generationId}.svg?v=${variant}&locker=${showLocker ? 1 : 0}&scrim=${showScrim ? 1 : 0}`;
  return (
    <div
      className={cn("relative overflow-hidden bg-ink-900 ring-1 ring-white/5", rounded && "rounded-xl", className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <img src={src} alt="Ad preview" className="block w-full h-full object-contain" />
    </div>
  );
}

export function AdPreviewPreview({
  brandId,
  formatSlug,
  copy,
  className,
}: {
  brandId: string;
  formatSlug: string;
  copy: { eyebrow?: string; headline: string; subhead?: string; cta: string };
  className?: string;
}) {
  const q = new URLSearchParams({
    brand: brandId,
    fmt: formatSlug,
    head: copy.headline,
    sub: copy.subhead || "",
    cta: copy.cta,
    eye: copy.eyebrow || "",
  });
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-ink-900 ring-1 ring-white/5", className)}>
      <img src={`/api/preview.svg?${q.toString()}`} className="block w-full h-full object-contain" alt="Preview" />
    </div>
  );
}
