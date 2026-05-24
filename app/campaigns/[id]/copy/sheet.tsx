"use client";
import { Button, Eyebrow } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CopySchema, CopyColumn } from "@/lib/copy-schema";
import { classifyLabel } from "@/lib/copy-schema";
import type { CopyRow } from "@/lib/repo";
import { addRowAction, updateRowAction, deleteRowAction, saveColumnsAction } from "./actions";

export function CopySheet({ campaignId, slug, schema, initialRows }: {
  campaignId: string; slug: string; schema: CopySchema; initialRows: CopyRow[];
}) {
  const [columns, setColumns] = useState<CopyColumn[]>(schema.columns);
  const [rows, setRows] = useState(initialRows.map((r) => ({ id: r.id, values: { ...r.values }, status: r.status })));
  const [manageCols, setManageCols] = useState(false);
  const [newCol, setNewCol] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function setCell(rowId: string, key: string, val: string) {
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, [key]: val } } : r)));
  }
  function commit(rowId: string) {
    const r = rows.find((x) => x.id === rowId); if (!r) return;
    start(async () => { await updateRowAction(campaignId, rowId, r.values); });
  }
  function addRow() {
    start(async () => { await addRowAction(campaignId); router.refresh(); });
  }
  function removeRow(rowId: string) {
    setRows((rs) => rs.filter((r) => r.id !== rowId));
    start(async () => { await deleteRowAction(campaignId, rowId); });
  }
  function addColumn() {
    const label = newCol.trim(); if (!label) return;
    const { role, layer, maxChars } = classifyLabel(label);
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") || `col_${columns.length}`;
    const next = [...columns, { key, label, role, layer, maxChars, perRegion: false } as CopyColumn];
    setColumns(next); setNewCol("");
    start(async () => { await saveColumnsAction(campaignId, { columns: next, regions: schema.regions }); });
  }
  function removeColumn(key: string) {
    const next = columns.filter((c) => c.key !== key);
    setColumns(next);
    start(async () => { await saveColumnsAction(campaignId, { columns: next, regions: schema.regions }); });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-ink-400">{rows.length} row{rows.length === 1 ? "" : "s"} · {columns.length} columns · inherited from the brand default, tweak here</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setManageCols((v) => !v)}>Columns</Button>
          <Button size="sm" onClick={addRow} disabled={pending}>+ Row</Button>
        </div>
      </div>

      {manageCols && (
        <div className="rounded-xl ring-1 ring-white/10 p-3 space-y-2">
          <Eyebrow>Columns for this project</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {columns.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-white/10 bg-white/5">
                {c.label}<span className="text-ink-500">· {c.layer === "none" ? c.role : c.layer}</span>
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
                <th className="w-8 text-[10px] text-ink-500 font-normal px-2 py-2 sticky left-0 bg-ink-900/60">#</th>
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
                  <td className="text-[11px] text-ink-500 px-2 py-2 sticky left-0 bg-ink-950">{i + 1}</td>
                  {columns.map((c) => {
                    const v = r.values[c.key] || "";
                    const over = c.maxChars && v.length > c.maxChars;
                    return (
                      <td key={c.key} className="px-1.5 py-1.5 border-l border-white/5">
                        <textarea
                          value={v}
                          onChange={(e) => setCell(r.id, c.key, e.target.value)}
                          onBlur={() => commit(r.id)}
                          rows={2}
                          className={"w-full resize-y bg-transparent rounded-md px-2 py-1.5 text-sm text-ink-100 ring-1 ring-inset focus:ring-white/25 " + (over ? "ring-rose-500/40" : "ring-white/10")}
                          placeholder="—"
                        />
                        {c.maxChars && <div className={"text-[10px] mt-0.5 " + (over ? "text-rose-300" : "text-ink-500")}>{v.length}/{c.maxChars}</div>}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 border-l border-white/5 text-center">
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
