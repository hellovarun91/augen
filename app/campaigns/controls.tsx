"use client";
import { Button, Card, Eyebrow, Input, Label, LinkButton } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction, renameProjectAction, deleteProjectAction } from "./actions";

export function ProjectsHeaderActions({ brandId, slug }: { brandId: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [audience, setAudience] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create() {
    setError(null);
    start(async () => {
      try { await createProjectAction(brandId, { name, objective, audience }); }
      catch (e: any) {
        // redirect() throws NEXT_REDIRECT — let it propagate.
        if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
        setError(e?.message || "Could not create project");
      }
    });
  }

  return (
    <>
      <div className="flex gap-2">
        <LinkButton href={`/brands/${slug}/plan`} variant="secondary">✨ Draft with AI</LinkButton>
        <Button onClick={() => setOpen(true)}>+ New project</Button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <Card className="relative w-full max-w-md p-6 space-y-4">
            <Eyebrow>New project</Eyebrow>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring launch" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Intent <span className="text-ink-500">(optional)</span></Label>
              <Input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="e.g. drive course sign-ups" />
            </div>
            <div className="space-y-1.5">
              <Label>Audience <span className="text-ink-500">(optional)</span></Label>
              <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. career switchers, 25–40" />
            </div>
            {error && <div className="text-xs text-rose-300">{error}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button onClick={create} disabled={pending || !name.trim()}>{pending ? "Creating…" : "Create project"}</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export function ProjectCardActions({ campaignId, name }: { campaignId: string; name: string }) {
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
    start(async () => { await deleteProjectAction(campaignId); router.refresh(); });
  }

  if (renaming) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") setRenaming(false); }} className="text-sm h-8" autoFocus />
        <Button size="sm" onClick={rename} disabled={pending}>Save</Button>
        <button onClick={() => setRenaming(false)} className="text-xs text-ink-400 hover:text-ink-100">Cancel</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-[11px] text-ink-400">
      <button onClick={() => { setDraft(name); setRenaming(true); }} className="hover:text-ink-100" disabled={pending}>Rename</button>
      <button onClick={remove} className="hover:text-rose-300" disabled={pending}>Delete</button>
    </div>
  );
}
