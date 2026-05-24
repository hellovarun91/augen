"use client";
import { Button, Eyebrow } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CopySchema, CopyColumn } from "@/lib/copy-schema";
import { classifyLabel, regionCellKey } from "@/lib/copy-schema";
import type { CopyRow } from "@/lib/repo";
import {
  addRowAction, updateRowAction, deleteRowAction, saveColumnsAction,
  setRowStatusAction, linkRowAction, pullFromCreativeAction, pushToCreativeAction, approveAndPushAction,
} from "./actions";

function CellBox({ value, maxChars, onChange, onBlur }: { value: string; maxChars?: number; onChange: (v: string) => void; onBlur: () => void }) {
  const over = !!maxChars && value.length > maxChars;
  return (
    <>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={2}
        className={"w-full resize-y bg-transparent rounded-md px-2 py-1.5 text-sm text-ink-100 ring-1 ring-inset focus:ring-white/25 " + (over ? "ring-rose-500/40" : "ring-white/10")}
        placeholder="—"
      />
      {maxChars ? <div className={"text-[10px] mt-0.5 " + (over ? "text-rose-300" : "text-ink-500")}>{value.length}/{maxChars}</div> : null}
    </>
  );
}

interface GenOption { id: string; label: string }
interface RowState { id: string; values: Record<string, string>; status: string; generationId: string | null; note?: string }

const STATUS_TONE: Record<string, string> = {
  draft: "bg-white/5 text-ink-300 ring-white/10",
  proof: "bg-amber-400/10 text-amber-200 ring-amber-400/20",
  approved: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/20",
};

export function CopySheet({ campaignId, slug, schema, initialRows, generations }: {
  campaignId: string; slug: string; schema: CopySchema; initialRows: CopyRow[]; generations: GenOption[];
}) {
  const [columns, setColumns] = useState<CopyColumn[]>(schema.columns);
  const [regions, setRegions] = useState<string[]>(schema.regions);
  const [rows, setRows] = useState<RowState[]>(initialRows.map((r) => ({ id: r.id, values: { ...r.values }, status: r.status, generationId: r.generation_id })));
  const [manageCols, setManageCols] = useState(false);
  const [newCol, setNewCol] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function saveSchema(nextCols: CopyColumn[], nextRegions: string[]) {
    start(async () => { await saveColumnsAction(campaignId, { columns: nextCols, regions: nextRegions }); });
  }

  const genLabel = (id: string | null) => generations.find((g) => g.id === id)?.label;
  function patchRow(rowId: string, patch: Partial<RowState>) {
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }
  function flash(rowId: string, note: string) {
    patchRow(rowId, { note });
    setTimeout(() => patchRow(rowId, { note: undefined }), 2200);
  }

  // `key` is the storage key — a bare column key, or a region-suffixed key.
  function setCell(rowId: string, key: string, val: string) {
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, [key]: val } } : r)));
  }
  function commit(rowId: string) {
    const r = rows.find((x) => x.id === rowId); if (!r) return;
    start(async () => { await updateRowAction(campaignId, rowId, r.values); });
  }
  function addRow() {
    start(async () => {
      const id = await addRowAction(campaignId);
      setRows((rs) => [...rs, { id, values: {}, status: "draft", generationId: null }]);
    });
  }
  function removeRow(rowId: string) {
    setRows((rs) => rs.filter((r) => r.id !== rowId));
    start(async () => { await deleteRowAction(campaignId, rowId); });
  }
  function setStatus(rowId: string, status: string) {
    patchRow(rowId, { status });
    start(async () => { await setRowStatusAction(campaignId, rowId, status); });
  }
  function link(rowId: string, genId: string) {
    const g = genId || null;
    patchRow(rowId, { generationId: g });
    start(async () => { await linkRowAction(campaignId, rowId, g); });
  }
  function pull(rowId: string) {
    start(async () => {
      try { const values = await pullFromCreativeAction(campaignId, rowId); patchRow(rowId, { values }); flash(rowId, "Pulled from creative"); }
      catch (e: any) { flash(rowId, e?.message || "Pull failed"); }
    });
  }
  function push(rowId: string) {
    start(async () => {
      try { await pushToCreativeAction(campaignId, rowId); flash(rowId, "Pushed to creative ✓"); }
      catch (e: any) { flash(rowId, e?.message || "Push failed"); }
    });
  }
  function approvePush(rowId: string) {
    patchRow(rowId, { status: "approved" });
    start(async () => {
      try { await approveAndPushAction(campaignId, rowId); flash(rowId, "Approved → sent to design ✓"); }
      catch (e: any) { flash(rowId, e?.message || "Failed"); }
    });
  }

  function addColumn() {
    const label = newCol.trim(); if (!label) return;
    const { role, layer, maxChars } = classifyLabel(label);
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") || `col_${columns.length}`;
    const next = [...columns, { key, label, role, layer, maxChars, perRegion: false } as CopyColumn];
    setColumns(next); setNewCol(""); saveSchema(next, regions);
  }
  function removeColumn(key: string) {
    const next = columns.filter((c) => c.key !== key);
    setColumns(next); saveSchema(next, regions);
  }
  function toggleColumnRegion(key: string) {
    const next = columns.map((c) => (c.key === key ? { ...c, perRegion: !c.perRegion } : c));
    setColumns(next); saveSchema(next, regions);
  }
  function addRegion() {
    const name = newRegion.trim(); if (!name || regions.includes(name)) { setNewRegion(""); return; }
    const next = [...regions, name];
    setRegions(next); setNewRegion(""); saveSchema(columns, next);
  }
  function removeRegion(name: string) {
    const next = regions.filter((r) => r !== name);
    setRegions(next); saveSchema(columns, next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-ink-400">{rows.length} row{rows.length === 1 ? "" : "s"} · {columns.length} columns · link a row to a creative, write & proof, then send approved copy to design</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setManageCols((v) => !v)}>Columns</Button>
          <Button size="sm" onClick={addRow} disabled={pending}>+ Row</Button>
        </div>
      </div>

      {manageCols && (
        <div className="rounded-xl ring-1 ring-white/10 p-3 space-y-4">
          <div className="space-y-2">
            <Eyebrow>Columns for this project</Eyebrow>
            <div className="flex flex-wrap gap-1.5">
              {columns.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-white/10 bg-white/5">
                  {c.label}<span className="text-ink-500">· {c.layer === "none" ? c.role : c.layer}</span>
                  <button onClick={() => toggleColumnRegion(c.key)} title="Vary this column per region"
                    className={"rounded px-1.5 py-0.5 text-[10px] " + (c.perRegion ? "bg-indigo-400/20 text-indigo-200" : "text-ink-500 hover:text-ink-200")}>
                    per-region
                  </button>
                  <button onClick={() => removeColumn(c.key)} className="text-ink-400 hover:text-rose-300">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <input value={newCol} onChange={(e) => setNewCol(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addColumn(); } }}
                placeholder="Add a column (e.g. Webinar CTA)" className="flex-1 rounded-lg bg-ink-800 px-3 py-1.5 text-sm ring-1 ring-inset ring-white/10" />
              <Button size="sm" variant="secondary" onClick={addColumn}>Add</Button>
            </div>
          </div>

          <div className="space-y-2 border-t border-white/5 pt-3">
            <Eyebrow>Regions / locales</Eyebrow>
            <div className="text-[11px] text-ink-500">Columns marked “per-region” split into one cell per locale below.</div>
            <div className="flex flex-wrap gap-1.5">
              {regions.length === 0 && <span className="text-xs text-ink-500">No regions yet.</span>}
              {regions.map((rg) => (
                <span key={rg} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-indigo-400/20 bg-indigo-400/10 text-indigo-100">
                  {rg}<button onClick={() => removeRegion(rg)} className="text-indigo-200/70 hover:text-rose-300">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <input value={newRegion} onChange={(e) => setNewRegion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRegion(); } }}
                placeholder="Add a region (e.g. India, US, UK)" className="flex-1 rounded-lg bg-ink-800 px-3 py-1.5 text-sm ring-1 ring-inset ring-white/10" />
              <Button size="sm" variant="secondary" onClick={addRegion}>Add</Button>
            </div>
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
                <th className="text-left text-[10px] text-ink-500 font-normal px-3 py-2 min-w-[240px] sticky left-0 bg-ink-900/60 z-10">ROW · STATUS · CREATIVE</th>
                {columns.map((c) => (
                  <th key={c.key} className="text-left px-3 py-2 min-w-[180px] border-l border-white/5">
                    <div className="text-[11px] uppercase tracking-wider text-ink-300">{c.label}</div>
                    <div className="text-[10px] text-ink-500">{c.layer !== "none" ? `→ ${c.layer}` : c.role}{c.maxChars ? ` · ≤${c.maxChars}` : ""}{c.perRegion ? " · per region" : ""}</div>
                  </th>
                ))}
                <th className="w-10 border-l border-white/5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t border-white/5 align-top">
                  <td className="px-3 py-2 sticky left-0 bg-ink-950 z-10 align-top">
                    <div className="space-y-1.5 min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-ink-500">#{i + 1}</span>
                        <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}
                          className={"rounded-full px-2 py-0.5 text-[11px] ring-1 outline-none cursor-pointer " + (STATUS_TONE[r.status] || STATUS_TONE.draft)}>
                          <option value="draft">Draft</option>
                          <option value="proof">In proof</option>
                          <option value="approved">Approved</option>
                        </select>
                      </div>
                      <select value={r.generationId || ""} onChange={(e) => link(r.id, e.target.value)}
                        className="w-full rounded-md bg-ink-800 px-2 py-1 text-[11px] text-ink-200 ring-1 ring-inset ring-white/10">
                        <option value="">— link a creative —</option>
                        {generations.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </select>
                      {r.generationId && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button onClick={() => pull(r.id)} disabled={pending} className="text-[11px] rounded-md px-2 py-0.5 ring-1 ring-white/10 text-ink-300 hover:bg-white/5" title="Creative → row">↓ Pull</button>
                          <button onClick={() => push(r.id)} disabled={pending} className="text-[11px] rounded-md px-2 py-0.5 ring-1 ring-white/10 text-ink-300 hover:bg-white/5" title="Row → creative">↑ Push</button>
                          <Link href={`/ads/${r.generationId}`} className="text-[11px] text-ink-400 hover:text-white">open ↗</Link>
                        </div>
                      )}
                      {r.status !== "approved" && (
                        <button onClick={() => approvePush(r.id)} disabled={pending}
                          className="text-[11px] rounded-md px-2 py-0.5 bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/20 hover:bg-emerald-400/15">
                          {r.generationId ? "Approve → design" : "Approve"}
                        </button>
                      )}
                      {r.note && <div className="text-[10px] text-ink-400">{r.note}</div>}
                    </div>
                  </td>
                  {columns.map((c) => {
                    const perRegion = c.perRegion && regions.length > 0;
                    return (
                      <td key={c.key} className="px-1.5 py-1.5 border-l border-white/5 align-top">
                        {perRegion ? (
                          <div className="space-y-2">
                            {regions.map((rg) => {
                              const key = regionCellKey(c.key, rg);
                              return (
                                <div key={rg}>
                                  <div className="text-[10px] uppercase tracking-wider text-indigo-300/80 mb-0.5">{rg}</div>
                                  <CellBox value={r.values[key] || ""} maxChars={c.maxChars} onChange={(val) => setCell(r.id, key, val)} onBlur={() => commit(r.id)} />
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <CellBox value={r.values[c.key] || ""} maxChars={c.maxChars} onChange={(val) => setCell(r.id, c.key, val)} onBlur={() => commit(r.id)} />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 border-l border-white/5 text-center align-top">
                    <button onClick={() => removeRow(r.id)} className="text-ink-500 hover:text-rose-300" title="Delete row">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
