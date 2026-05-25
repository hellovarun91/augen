"use client";
import { Button, Card, Eyebrow, Input, Label } from "@/components/ui/primitives";
import type { Campaign } from "@/lib/types";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runCampaignAction, saveBriefAction, saveFormatLabelAction, signOffProjectAction, reopenProjectAction } from "./actions";
import { relativeDate } from "@/lib/utils";
import { renameProjectAction, deleteProjectAction } from "../actions";
import type { FormatSpec } from "@/lib/formats";

export function ProjectDetailActions({ campaignId, name }: { campaignId: string; name: string }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [pending, start] = useTransition();
  const router = useRouter();
  function rename() {
    const v = draft.trim();
    if (!v || v === name) { setRenaming(false); return; }
    start(async () => { await renameProjectAction(campaignId, v); setRenaming(false); router.refresh(); });
  }
  function remove() {
    if (!confirm(`Delete "${name}"? Its ideas and creatives are removed too. This can't be undone.`)) return;
    start(async () => { await deleteProjectAction(campaignId); router.push("/campaigns"); });
  }
  if (renaming) {
    return (
      <div className="flex items-center gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") setRenaming(false); }} className="text-sm h-9" autoFocus />
        <Button size="sm" onClick={rename} disabled={pending}>Save</Button>
        <button onClick={() => setRenaming(false)} className="text-xs text-ink-400 hover:text-ink-100">Cancel</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-xs text-ink-400">
      <button onClick={() => { setDraft(name); setRenaming(true); }} className="hover:text-ink-100">Rename</button>
      <button onClick={remove} className="hover:text-rose-300" disabled={pending}>Delete project</button>
    </div>
  );
}

export function ProjectSignoff({
  campaignId, total, approved, signedOffBy, signedOffAt,
}: {
  campaignId: string; total: number; approved: number;
  signedOffBy: string | null; signedOffAt: number | null;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function signOff() {
    setErr(null);
    start(async () => {
      try { await signOffProjectAction(campaignId); router.refresh(); }
      catch (e: any) { setErr(e?.message || "Could not sign off"); }
    });
  }
  function reopen() {
    setErr(null);
    start(async () => {
      try { await reopenProjectAction(campaignId); router.refresh(); }
      catch (e: any) { setErr(e?.message || "Could not reopen"); }
    });
  }

  if (signedOffBy) {
    return (
      <Card className="p-5 ring-1 ring-emerald-400/20 bg-emerald-400/[0.04]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Eyebrow>Signed off</Eyebrow>
            <div className="text-sm text-ink-100 mt-1">{signedOffBy}{signedOffAt ? ` · ${relativeDate(signedOffAt)}` : ""}</div>
            <div className="text-[11px] text-ink-400 mt-0.5">{approved} of {total} creatives approved when signed off.</div>
          </div>
          <button onClick={reopen} disabled={pending} className="text-xs text-ink-400 hover:text-ink-100 shrink-0">{pending ? "…" : "Reopen"}</button>
        </div>
        {err && <div className="text-xs text-rose-300 mt-2">{err}</div>}
      </Card>
    );
  }

  const allApproved = total > 0 && approved === total;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Eyebrow>Sign-off</Eyebrow>
          <div className="text-sm text-ink-200 mt-1">{approved} of {total} creatives approved.</div>
          <div className="text-[11px] text-ink-400 mt-0.5">
            {total === 0 ? "Generate creatives before signing off." : allApproved ? "Everything's approved — ready to sign off." : "You can sign off before every creative is approved."}
          </div>
        </div>
        <Button size="sm" onClick={signOff} disabled={pending || total === 0}>{pending ? "Signing off…" : "Sign off project"}</Button>
      </div>
      {err && <div className="text-xs text-rose-300 mt-2">{err}</div>}
    </Card>
  );
}

export function RunCampaignButton({ campaignId, ideaCount }: { campaignId: string; ideaCount: number }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [prog, setProg] = useState<{ elapsed: number; runs: number; ads: number } | null>(null);
  const router = useRouter();

  function run() {
    setErr(null);
    const t0 = Date.now();
    setProg({ elapsed: 0, runs: 0, ads: 0 });
    const iv = setInterval(async () => {
      const elapsed = Math.floor((Date.now() - t0) / 1000);
      try {
        const r = await fetch(`/api/campaigns/${campaignId}/genstatus?since=${t0}`, { cache: "no-store" });
        if (r.ok) { const d = await r.json(); setProg({ elapsed, runs: d.runs, ads: d.ads }); }
        else setProg((p) => (p ? { ...p, elapsed } : p));
      } catch { setProg((p) => (p ? { ...p, elapsed } : p)); }
    }, 2000);
    start(async () => {
      try { await runCampaignAction(campaignId); }
      catch (e: any) { if (!e?.digest?.startsWith?.("NEXT_REDIRECT")) setErr(e?.message || "Run failed"); }
      finally { clearInterval(iv); setProg(null); router.refresh(); }
    });
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <form action={() => run()}>
      <Button type="submit" size="md" disabled={pending || ideaCount === 0}>
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            Generating…
          </span>
        ) : "Generate ads →"}
      </Button>
      {pending && (
        <div className="text-[11px] text-ink-400 mt-1.5 tabular-nums">
          {prog ? `${mmss(prog.elapsed)} · ${prog.runs} agent step${prog.runs === 1 ? "" : "s"} · ${prog.ads} ad${prog.ads === 1 ? "" : "s"} rendered` : "starting…"}
          <div className="text-ink-500">Real AI — usually 1–3 min. Ads land when the chain finishes.</div>
        </div>
      )}
      {err && <div className="text-xs text-rose-300 mt-1">{err}</div>}
    </form>
  );
}

export function BriefEditor({
  campaign,
  groupedFormats,
  labels,
}: {
  campaign: Campaign;
  groupedFormats: Record<string, FormatSpec[]>;
  labels: Record<string, string>;
}) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(campaign.brief.formats));
  const [audience, setAudience] = useState(campaign.audience || "");
  const [notes, setNotes] = useState(campaign.brief.notes || "");
  const [variants, setVariants] = useState(1);
  const [labelMap, setLabelMap] = useState<Record<string, string>>(labels || {});
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function patchLabel(slug: string, label: string) {
    const next = { ...labelMap, [slug]: label };
    setLabelMap(next);
    // Debounce via fire-and-forget; backend writes immediately on blur via input onBlur below.
  }

  function toggle(slug: string) {
    const next = new Set(enabled);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    setEnabled(next);
  }
  function toggleAllPlatform(platform: string) {
    const list = groupedFormats[platform];
    const allOn = list.every((f) => enabled.has(f.slug));
    const next = new Set(enabled);
    if (allOn) list.forEach((f) => next.delete(f.slug));
    else list.forEach((f) => next.add(f.slug));
    setEnabled(next);
  }

  function onSave() {
    start(async () => {
      await saveBriefAction(campaign.id, {
        audience,
        notes,
        formats: Array.from(enabled),
        variantsPerFormat: variants,
      });
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Audience</Label>
          <input value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10" />
        </div>
        <div className="space-y-1.5">
          <Label>Variants per format</Label>
          <select value={variants} onChange={(e) => setVariants(parseInt(e.target.value, 10))} className="w-full rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10">
            {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div>
        <Eyebrow>Notes</Eyebrow>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-2 w-full rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10" />
      </div>

      <div className="space-y-4">
        <Eyebrow>Format coverage</Eyebrow>
        {Object.entries(groupedFormats).map(([platform, list]) => (
          <div key={platform} className="rounded-xl ring-1 ring-white/5 bg-ink-900/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-ink-100 font-medium">{platform}</div>
              <button onClick={() => toggleAllPlatform(platform)} className="text-xs text-ink-400 hover:text-ink-100">Toggle all</button>
            </div>
            <div className="space-y-2">
              {list.map((f) => {
                const on = enabled.has(f.slug);
                return (
                  <div key={f.slug} className="flex items-center gap-2">
                    <button
                      onClick={() => toggle(f.slug)}
                      className={
                        "text-xs rounded-full px-3 py-1.5 ring-1 transition-colors whitespace-nowrap " +
                        (on ? "bg-ink-50 text-ink-950 ring-ink-50" : "bg-ink-800 text-ink-200 ring-white/10 hover:bg-ink-700")
                      }
                    >
                      {f.name} · {f.width}×{f.height}
                    </button>
                    {on && (
                      <input
                        defaultValue={labelMap[f.slug] || ""}
                        placeholder={`Rename for this campaign (default: ${f.name})`}
                        onBlur={async (e) => {
                          patchLabel(f.slug, e.target.value);
                          await saveFormatLabelAction(campaign.id, f.slug, e.target.value || null);
                        }}
                        className="flex-1 rounded-lg bg-ink-800 px-2 py-1 text-xs text-ink-100 ring-1 ring-inset ring-white/10"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={pending}>{pending ? "Saving…" : "Save brief"}</Button>
        {saved && <span className="text-xs text-emerald-300">Saved.</span>}
        <div className="text-xs text-ink-400 ml-auto">Enabled: {enabled.size} formats × {variants} variants per idea seed</div>
      </div>
    </Card>
  );
}
