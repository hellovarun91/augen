"use client";
import { useState, useEffect, useRef, useTransition } from "react";
import { Button } from "@/components/ui/primitives";
import { saveCopy, applyCopyToSiblingsAction } from "./actions";

interface CopyFields { eyebrow: string; headline: string; subhead: string; cta: string }

// A textarea that blends into the design — no border until focus, auto-grows to
// content, styled in brand typography. The "editing-on-the-creative" feel.
function Line({ value, onChange, onCommit, font, className, placeholder, ariaLabel }: {
  value: string; onChange: (v: string) => void; onCommit: () => void;
  font: string; className: string; placeholder: string; ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = ref.current; if (!t) return;
    t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      rows={1}
      aria-label={ariaLabel}
      placeholder={placeholder}
      style={{ fontFamily: font }}
      className={"block w-full resize-none bg-transparent rounded-md px-2 py-1.5 ring-1 ring-inset ring-transparent hover:ring-white/10 focus:ring-white/25 placeholder:text-ink-600 " + className}
    />
  );
}

// Live copy editor (#51): the rendered creative sits above; this sits below in
// brand typography, so editing reads as editing the design. Autosaves on blur,
// flows back to the row (#49), and offers to apply to the row's other sizes.
export function LiveCopyEditor({ generationId, initial, fonts, onReload }: {
  generationId: string;
  initial: CopyFields;
  fonts: { display: string; body: string };
  onReload: () => void;
}) {
  const [copy, setCopy] = useState<CopyFields>(initial);
  const last = useRef<CopyFields>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [siblings, setSiblings] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  // Re-sync from props when the underlying ad changes (e.g., after refresh).
  useEffect(() => { setCopy(initial); last.current = initial; }, [generationId, initial.headline, initial.subhead, initial.cta, initial.eyebrow]);

  function set(field: keyof CopyFields, v: string) { setCopy((c) => ({ ...c, [field]: v })); }

  function commit() {
    const dirty = (Object.keys(copy) as (keyof CopyFields)[]).some((k) => copy[k] !== last.current[k]);
    if (!dirty || pending) return;
    setErr(null);
    start(async () => {
      try {
        const res = await saveCopy(generationId, copy);
        last.current = copy;
        setSiblings(res.siblingCount);
        setSaved(true); setTimeout(() => setSaved(false), 1500);
        onReload();
      } catch (e: any) { setErr(e?.message || "Save failed"); }
    });
  }

  function applyToSiblings() {
    start(async () => {
      try { await applyCopyToSiblingsAction(generationId); setSiblings(0); onReload(); }
      catch (e: any) { setErr(e?.message || "Couldn't apply"); }
    });
  }

  return (
    <div className="rounded-xl ring-1 ring-white/10 bg-ink-900/40 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-ink-500">Copy · click any line to edit</div>
        <div className="text-[11px] h-4">
          {saved && <span className="text-emerald-300">Saved to the row ✓</span>}
          {pending && !saved && <span className="text-ink-400">Saving…</span>}
          {err && <span className="text-rose-300">{err}</span>}
        </div>
      </div>

      <div className="space-y-1">
        <Line value={copy.eyebrow} onChange={(v) => set("eyebrow", v)} onCommit={commit}
          font={fonts.body}
          className="text-[11px] uppercase tracking-[0.18em] text-ink-300"
          ariaLabel="Eyebrow" placeholder="Eyebrow (optional)" />
        <Line value={copy.headline} onChange={(v) => set("headline", v)} onCommit={commit}
          font={fonts.display}
          className="serif text-3xl md:text-4xl leading-tight tracking-tight text-ink-100"
          ariaLabel="Headline" placeholder="Your headline" />
        <Line value={copy.subhead} onChange={(v) => set("subhead", v)} onCommit={commit}
          font={fonts.body}
          className="text-base leading-relaxed text-ink-200"
          ariaLabel="Subhead" placeholder="Subhead" />
        <div className="flex items-center gap-1.5 pt-1">
          <Line value={copy.cta} onChange={(v) => set("cta", v)} onCommit={commit}
            font={fonts.body}
            className="text-sm font-medium text-ink-100 max-w-[18ch]"
            ariaLabel="CTA" placeholder="Call to action" />
          <span className="text-ink-400 text-sm select-none">→</span>
        </div>
      </div>

      {siblings > 0 && (
        <div className="rounded-lg ring-1 ring-amber-400/20 bg-amber-400/5 p-2.5 text-xs text-amber-100 flex items-center justify-between gap-3">
          <span>The other {siblings} size{siblings === 1 ? "" : "s"} of this variation now lag this copy.</span>
          <Button size="sm" variant="secondary" disabled={pending} onClick={applyToSiblings}>Apply to all sizes</Button>
        </div>
      )}
    </div>
  );
}
