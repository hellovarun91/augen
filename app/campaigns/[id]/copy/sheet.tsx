"use client";
import { Button, Eyebrow } from "@/components/ui/primitives";
import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import type { CopySchema, CopyColumn } from "@/lib/copy-schema";
import { classifyLabel } from "@/lib/copy-schema";
import type { CopyRow } from "@/lib/repo";
import {
  addRowAction, updateRowAction, deleteRowAction, saveColumnsAction,
  setRowStatusAction, setRowNameAction, generateDesignsAction, generateAllDesignsAction,
  rewriteCellAction,
} from "./actions";

type RewriteAction = "punchier" | "shorter" | "match_voice";
type RewriteResult = { proposed: string; rationale: string };

// A copy cell: blends into the grid, rings on interaction, auto-grows to its
// content, only shows a counter as you approach the limit, and — when an
// `onRewrite` handler is provided — surfaces a ✨ AI quick-rewrite menu (#54).
function CellBox({ value, maxChars, onChange, onBlur, onRewrite }: {
  value: string; maxChars?: number; onChange: (v: string) => void; onBlur: () => void;
  onRewrite?: (action: RewriteAction) => Promise<RewriteResult>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<RewriteAction | null>(null);
  const [suggestion, setSuggestion] = useState<RewriteResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = ref.current; if (!t) return;
    t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`;
  }, [value]);

  // Outside-click closes the menu — keeps the cell quiet when you move on.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const near = !!maxChars && value.length >= maxChars * 0.85;
  const over = !!maxChars && value.length > maxChars;

  async function rewrite(action: RewriteAction) {
    if (!onRewrite) return;
    setMenuOpen(false); setErr(null); setBusy(action); setSuggestion(null);
    try { setSuggestion(await onRewrite(action)); }
    catch (e: any) { setErr(e?.message || "Couldn't rewrite"); }
    finally { setBusy(null); }
  }
  function accept() {
    if (!suggestion) return;
    onChange(suggestion.proposed);
    setSuggestion(null);
    // Let state propagate before triggering commit on the new value.
    setTimeout(onBlur, 0);
  }

  return (
    <div ref={boxRef} className="relative group">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={1}
        className={"block w-full resize-none bg-transparent rounded-md px-2 py-1.5 pr-9 text-sm leading-snug text-ink-100 ring-1 ring-inset focus:ring-white/25 " + (over ? "ring-rose-500/40" : "ring-transparent hover:ring-white/10")}
        placeholder="—"
      />
      {near && !suggestion && (
        <span className={"pointer-events-none absolute bottom-1 right-1.5 text-[10px] " + (over ? "text-rose-300" : "text-ink-500")}>{value.length}/{maxChars}</span>
      )}

      {onRewrite && !busy && (
        <button type="button" title="Rewrite with AI" onClick={() => setMenuOpen((v) => !v)}
          className={"absolute top-1 right-1 text-[10px] rounded px-1.5 py-0.5 transition-opacity " +
            (menuOpen ? "opacity-100 bg-indigo-400/20 text-indigo-100 ring-1 ring-indigo-400/30" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-ink-400 hover:bg-white/10 hover:text-ink-100")}>✨</button>
      )}
      {busy && <span className="absolute top-1 right-1 text-[10px] text-indigo-200">…</span>}

      {menuOpen && (
        <div className="absolute top-7 right-0 z-20 rounded-lg ring-1 ring-white/10 bg-ink-800 shadow-xl py-1 w-44">
          {([["punchier", "Punchier"], ["shorter", "Shorter"], ["match_voice", "Match brand voice"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => rewrite(k)} className="w-full text-left text-xs px-3 py-1.5 hover:bg-white/5 text-ink-200">
              ✨ {label}
            </button>
          ))}
        </div>
      )}

      {suggestion && (
        <div className="mt-1.5 rounded-md ring-1 ring-indigo-400/30 bg-indigo-400/5 p-2 text-xs space-y-1.5">
          <div className="text-ink-100 leading-snug whitespace-pre-wrap">{suggestion.proposed || "—"}</div>
          {suggestion.rationale && <div className="text-[10px] text-ink-400 italic">{suggestion.rationale}</div>}
          <div className="flex items-center gap-2 pt-0.5">
            <button type="button" onClick={accept} className="text-[11px] rounded px-2 py-0.5 bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-400/20">Accept</button>
            <button type="button" onClick={() => setSuggestion(null)} className="text-[11px] text-ink-400 hover:text-rose-300">Reject</button>
          </div>
        </div>
      )}
      {err && <div className="text-[10px] text-rose-300 mt-1">{err}</div>}
    </div>
  );
}

interface DesignLite { id: string; aspect: string; format_slug: string; status: string; stale: number }
interface RowState { id: string; name: string; values: Record<string, string>; status: string }

const STATUS_TONE: Record<string, string> = {
  draft: "bg-white/5 text-ink-300 ring-white/10",
  proof: "bg-amber-400/10 text-amber-200 ring-amber-400/20",
  approved: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/20",
};

export function CopySheet({ campaignId, slug, schema, initialRows, initialDesigns }: {
  campaignId: string; slug: string; schema: CopySchema; initialRows: CopyRow[];
  initialDesigns: Record<string, DesignLite[]>;
}) {
  const [columns, setColumns] = useState<CopyColumn[]>(schema.columns);
  const [rows, setRows] = useState<RowState[]>(initialRows.map((r) => ({ id: r.id, name: r.name || "", values: { ...r.values }, status: r.status })));
  const [designs, setDesigns] = useState<Record<string, DesignLite[]>>(initialDesigns);
  const [manageCols, setManageCols] = useState(false);
  const [newCol, setNewCol] = useState("");
  const [busyRow, setBusyRow] = useState<string | null>(null); // rowId | "all"
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function saveSchema(nextCols: CopyColumn[]) {
    start(async () => { await saveColumnsAction(campaignId, { columns: nextCols, regions: [] }); });
  }
  function patchRow(rowId: string, patch: Partial<RowState>) {
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  function setCell(rowId: string, key: string, val: string) {
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, [key]: val } } : r)));
  }
  function commit(rowId: string) {
    const r = rows.find((x) => x.id === rowId); if (!r) return;
    start(async () => { await updateRowAction(campaignId, rowId, r.values); });
  }
  function setName(rowId: string, name: string) { patchRow(rowId, { name }); }
  function commitName(rowId: string) {
    const r = rows.find((x) => x.id === rowId); if (!r) return;
    start(async () => { await setRowNameAction(campaignId, rowId, r.name); });
  }
  function addRow() {
    start(async () => {
      const id = await addRowAction(campaignId);
      setRows((rs) => [...rs, { id, name: "", values: {}, status: "draft" }]);
    });
  }
  function removeRow(rowId: string) {
    setRows((rs) => rs.filter((r) => r.id !== rowId));
    setDesigns((m) => { const n = { ...m }; delete n[rowId]; return n; });
    start(async () => { await deleteRowAction(campaignId, rowId); });
  }
  function setStatus(rowId: string, status: string) {
    patchRow(rowId, { status });
    start(async () => { await setRowStatusAction(campaignId, rowId, status); });
  }

  function generateRow(rowId: string) {
    setErr(null); setBusyRow(rowId);
    start(async () => {
      try { const ds = await generateDesignsAction(campaignId, rowId); setDesigns((m) => ({ ...m, [rowId]: ds })); }
      catch (e: any) { setErr(e?.message || "Generation failed"); }
      finally { setBusyRow(null); }
    });
  }
  function generateAll() {
    setErr(null); setBusyRow("all");
    start(async () => {
      try { const res = await generateAllDesignsAction(campaignId); setDesigns(res.byRow); }
      catch (e: any) { setErr(e?.message || "Generation failed"); }
      finally { setBusyRow(null); }
    });
  }

  function addColumn() {
    const label = newCol.trim(); if (!label) return;
    const { role, layer, maxChars } = classifyLabel(label);
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") || `col_${columns.length}`;
    const next = [...columns, { key, label, role, layer, maxChars, perRegion: false } as CopyColumn];
    setColumns(next); setNewCol(""); saveSchema(next);
  }
  function renameColumn(i: number, label: string) {
    setColumns((cs) => cs.map((c, j) => (j === i ? { ...c, label } : c)));
  }
  function removeColumn(key: string) {
    const next = columns.filter((c) => c.key !== key);
    setColumns(next); saveSchema(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-ink-400">
          {rows.length} variation{rows.length === 1 ? "" : "s"} · {columns.length} layer{columns.length === 1 ? "" : "s"} · each renders in every project format
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={generateAll} disabled={pending}>{busyRow === "all" ? "Generating…" : "Generate all designs"}</Button>
          <Button size="sm" variant="secondary" onClick={() => setManageCols((v) => !v)}>Columns</Button>
          <Button size="sm" variant="secondary" onClick={addRow} disabled={pending}>+ Row</Button>
        </div>
      </div>

      {err && <div className="rounded-lg ring-1 ring-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{err}</div>}

      {manageCols && (
        <div className="rounded-xl ring-1 ring-white/10 p-3 space-y-3 max-w-2xl">
          <Eyebrow>Columns (layers) for this project</Eyebrow>
          <div className="text-[11px] text-ink-500">Rename or remove here — changes apply to this project. Columns mapped to a layer render on the creative; others (offer, price…) shape the copy.</div>
          <div className="space-y-1.5">
            {columns.map((c, i) => (
              <div key={c.key} className="flex items-center gap-2">
                <input value={c.label} onChange={(e) => renameColumn(i, e.target.value)} onBlur={() => saveSchema(columns)}
                  className="flex-1 rounded-md bg-ink-900/60 px-2.5 py-1.5 text-sm ring-1 ring-inset ring-white/10 focus:ring-white/25" />
                <span className="text-[11px] text-ink-500 w-28 shrink-0 text-right">{c.layer === "none" ? c.role : `→ ${c.layer}`}{c.maxChars ? ` · ≤${c.maxChars}` : ""}</span>
                <button onClick={() => removeColumn(c.key)} className="text-ink-500 hover:text-rose-300 px-1 shrink-0">×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <input value={newCol} onChange={(e) => setNewCol(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addColumn(); } }}
              placeholder="Add a column (e.g. Offer, Price)" className="flex-1 rounded-lg bg-ink-800 px-3 py-1.5 text-sm ring-1 ring-inset ring-white/10" />
            <Button size="sm" variant="secondary" onClick={addColumn}>Add</Button>
          </div>
          <div className="text-[11px] text-ink-500 border-t border-white/5 pt-2">
            Editing the brand-wide defaults? <Link href={`/brands/${slug}/copy?from=/campaigns/${campaignId}/copy`} className="text-ink-300 hover:text-white">Brand copy structure →</Link>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl ring-1 ring-white/5 p-8 text-center text-sm text-ink-400">
          Empty sheet. Add a row to start writing copy variations for this project.
          <div className="mt-3"><Button size="sm" onClick={addRow} disabled={pending}>+ Add first row</Button></div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-ink-900/60">
                <th className="text-left text-[10px] text-ink-500 font-normal px-3 py-2 w-[220px] sticky left-0 bg-ink-900/60 z-10">VARIATION</th>
                {columns.map((c) => (
                  <th key={c.key} className="text-left px-3 py-2 min-w-[170px] border-l border-white/5">
                    <div className="text-[11px] uppercase tracking-wider text-ink-300">{c.label}</div>
                    <div className="text-[10px] text-ink-500">{c.layer !== "none" ? `→ ${c.layer}` : c.role}{c.maxChars ? ` · ≤${c.maxChars}` : ""}</div>
                  </th>
                ))}
                <th className="text-left text-[10px] text-ink-500 font-normal px-3 py-2 min-w-[180px] border-l border-white/5">DESIGNS</th>
                <th className="w-10 border-l border-white/5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const ds = designs[r.id] || [];
                const rowBusy = busyRow === r.id || busyRow === "all";
                return (
                <tr key={r.id} className="border-t border-white/5 align-top">
                  <td className="px-3 py-2 sticky left-0 bg-ink-950 z-10 align-top">
                    <div className="space-y-1.5 w-[196px]">
                      <input
                        value={r.name}
                        onChange={(e) => setName(r.id, e.target.value)}
                        onBlur={() => commitName(r.id)}
                        placeholder={`Variation ${i + 1}`}
                        className="w-full bg-transparent text-sm font-medium text-ink-100 rounded-md px-2 py-1 ring-1 ring-inset ring-transparent hover:ring-white/10 focus:ring-white/25 placeholder:text-ink-600 placeholder:font-normal"
                        title="Names this variation and the designs it generates"
                      />
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[11px] text-ink-600">#{i + 1}</span>
                        <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}
                          className={"rounded-full px-2 py-0.5 text-[11px] ring-1 outline-none cursor-pointer " + (STATUS_TONE[r.status] || STATUS_TONE.draft)}>
                          <option value="draft">Draft</option>
                          <option value="proof">In proof</option>
                          <option value="approved">Approved</option>
                        </select>
                      </div>
                    </div>
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className="px-1.5 py-1.5 border-l border-white/5 align-top">
                      <CellBox
                        value={r.values[c.key] || ""}
                        maxChars={c.maxChars}
                        onChange={(val) => setCell(r.id, c.key, val)}
                        onBlur={() => commit(r.id)}
                        onRewrite={(action) => rewriteCellAction(campaignId, r.id, c.key, action)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 border-l border-white/5 align-top">
                    {ds.length ? (
                      (() => {
                        const approved = ds.filter((d) => d.status === "approved" && !d.stale).length;
                        const staleN = ds.filter((d) => d.stale).length;
                        return (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-1.5">
                              {ds.map((d) => {
                                const ring = d.stale ? "ring-amber-400/60" : d.status === "approved" ? "ring-emerald-400/60" : "ring-white/10 hover:ring-white/40";
                                const state = d.stale ? "stale — re-render" : d.status === "approved" ? "approved" : d.status.replace(/_/g, " ");
                                return (
                                  <Link key={d.id} href={`/ads/${d.id}`} title={`${d.aspect} · ${state}`} className="block shrink-0">
                                    <img src={`/api/render/${d.id}/png?w=120`} alt={d.aspect} loading="lazy"
                                      className={"h-12 w-auto max-w-[80px] object-cover rounded ring-1 transition " + ring} />
                                  </Link>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] flex-wrap">
                              {approved > 0 && <span className="text-emerald-300">{approved} approved</span>}
                              {staleN > 0 && <span className="text-amber-300">{staleN} stale</span>}
                              <button onClick={() => generateRow(r.id)} disabled={pending} className="text-ink-400 hover:text-white disabled:opacity-50">
                                {busyRow === r.id ? "Re-rendering…" : staleN ? `↻ Re-render (${staleN})` : "↻ Regenerate"}
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <button onClick={() => generateRow(r.id)} disabled={pending}
                        className="text-[11px] rounded-md px-2.5 py-1 ring-1 ring-white/15 text-ink-200 hover:bg-white/5 disabled:opacity-50">
                        {rowBusy ? "Generating…" : "Generate designs"}
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2 border-l border-white/5 text-center align-top">
                    <button onClick={() => removeRow(r.id)} className="text-ink-500 hover:text-rose-300" title="Delete row">✕</button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
