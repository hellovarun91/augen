"use client";
import { Button, Eyebrow } from "@/components/ui/primitives";
import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import type { CopySchema, CopyColumn } from "@/lib/copy-schema";
import { classifyLabel } from "@/lib/copy-schema";
import type { CopyRow } from "@/lib/repo";
import {
  addRowAction, updateRowAction, deleteRowAction, saveColumnsAction,
  setRowStatusAction, setRowNameAction,
} from "./actions";

// A copy cell: blends into the grid, rings on interaction, auto-grows to its
// content, and only shows a counter as you approach the limit.
function CellBox({ value, maxChars, onChange, onBlur }: { value: string; maxChars?: number; onChange: (v: string) => void; onBlur: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = ref.current; if (!t) return;
    t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`;
  }, [value]);
  const near = !!maxChars && value.length >= maxChars * 0.85;
  const over = !!maxChars && value.length > maxChars;
  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={1}
        className={"block w-full resize-none bg-transparent rounded-md px-2 py-1.5 pr-8 text-sm leading-snug text-ink-100 ring-1 ring-inset focus:ring-white/25 " + (over ? "ring-rose-500/40" : "ring-transparent hover:ring-white/10")}
        placeholder="—"
      />
      {near && <span className={"pointer-events-none absolute bottom-1 right-1.5 text-[10px] " + (over ? "text-rose-300" : "text-ink-500")}>{value.length}/{maxChars}</span>}
    </div>
  );
}

interface RowState { id: string; name: string; values: Record<string, string>; status: string }

const STATUS_TONE: Record<string, string> = {
  draft: "bg-white/5 text-ink-300 ring-white/10",
  proof: "bg-amber-400/10 text-amber-200 ring-amber-400/20",
  approved: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/20",
};

export function CopySheet({ campaignId, slug, schema, initialRows }: {
  campaignId: string; slug: string; schema: CopySchema; initialRows: CopyRow[];
}) {
  const [columns, setColumns] = useState<CopyColumn[]>(schema.columns);
  const [rows, setRows] = useState<RowState[]>(initialRows.map((r) => ({ id: r.id, name: r.name || "", values: { ...r.values }, status: r.status })));
  const [manageCols, setManageCols] = useState(false);
  const [newCol, setNewCol] = useState("");
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
    start(async () => { await deleteRowAction(campaignId, rowId); });
  }
  function setStatus(rowId: string, status: string) {
    patchRow(rowId, { status });
    start(async () => { await setRowStatusAction(campaignId, rowId, status); });
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
          {rows.length} variation{rows.length === 1 ? "" : "s"} · {columns.length} layer{columns.length === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setManageCols((v) => !v)}>Columns</Button>
          <Button size="sm" variant="secondary" onClick={addRow} disabled={pending}>+ Row</Button>
        </div>
      </div>

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
                <th className="w-10 border-l border-white/5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
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
                      <CellBox value={r.values[c.key] || ""} maxChars={c.maxChars} onChange={(val) => setCell(r.id, c.key, val)} onBlur={() => commit(r.id)} />
                    </td>
                  ))}
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
