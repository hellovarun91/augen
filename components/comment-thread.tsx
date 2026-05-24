"use client";
import { useRef, useState, useTransition } from "react";
import { Button, Eyebrow } from "@/components/ui/primitives";
import { relativeDate } from "@/lib/utils";
import { addCommentAction, deleteCommentAction } from "@/app/comments-actions";
import type { CommentRow } from "@/lib/repo";

interface Member { id: string; name: string; color: string }

export function CommentThread({
  brandId, targetType, targetId, members, currentUserId, initial,
}: {
  brandId: string; targetType: string; targetId: string;
  members: Member[]; currentUserId: string | null; initial: CommentRow[];
}) {
  const [comments, setComments] = useState<CommentRow[]>(initial);
  const [value, setValue] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);
    const caret = e.target.selectionStart ?? v.length;
    const m = v.slice(0, caret).match(/@(\w*)$/);
    setQuery(m ? m[1].toLowerCase() : null);
  }
  function pick(member: Member) {
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@(\w*)$/, `@${member.name} `);
    setValue(before + value.slice(caret));
    setMentionIds((ids) => Array.from(new Set([...ids, member.id])));
    setQuery(null);
    ta?.focus();
  }
  function submit() {
    if (!value.trim()) return;
    setError(null);
    start(async () => {
      try {
        const c = await addCommentAction(brandId, targetType, targetId, value, mentionIds);
        setComments((cs) => [...cs, c]);
        setValue(""); setMentionIds([]); setQuery(null);
      } catch (e: any) { setError(e?.message || "Could not post"); }
    });
  }
  function remove(id: string) {
    setComments((cs) => cs.filter((c) => c.id !== id));
    start(async () => { try { await deleteCommentAction(id); } catch {} });
  }

  const matches = query !== null ? members.filter((m) => m.name.toLowerCase().includes(query)).slice(0, 5) : [];

  return (
    <div className="space-y-4">
      <Eyebrow>Discussion · {comments.length}</Eyebrow>

      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5" style={{ background: c.author.color, color: "#0A0A0B" }}>
                {c.author.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-ink-100">{c.author.name}</span>
                  <span className="text-ink-500">{relativeDate(c.created_at)}</span>
                  {c.author_id === currentUserId && <button onClick={() => remove(c.id)} className="ml-auto text-ink-500 hover:text-rose-300">delete</button>}
                </div>
                <p className="text-sm text-ink-200 mt-0.5 whitespace-pre-wrap leading-relaxed">
                  {c.body.split(/(@\S+)/).map((part, i) => part.startsWith("@") ? <span key={i} className="text-indigo-300">{part}</span> : part)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <textarea
          ref={taRef}
          value={value}
          onChange={onChange}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}
          rows={2}
          placeholder="Add a comment… use @ to mention a teammate"
          className="w-full resize-y rounded-lg bg-ink-900/60 ring-1 ring-inset ring-white/10 focus:ring-white/25 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500"
        />
        {matches.length > 0 && (
          <div className="absolute left-3 bottom-full mb-1 z-10 w-56 rounded-lg bg-ink-800 ring-1 ring-white/10 shadow-xl overflow-hidden">
            {matches.map((m) => (
              <button key={m.id} onClick={() => pick(m)} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-ink-200 hover:bg-white/5 text-left">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: m.color, color: "#0A0A0B" }}>{m.name.slice(0, 1).toUpperCase()}</span>
                {m.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-ink-500">⌘↵ to post</span>
          <Button size="sm" onClick={submit} disabled={pending || !value.trim()}>{pending ? "Posting…" : "Post"}</Button>
        </div>
        {error && <div className="text-xs text-rose-300 mt-1">{error}</div>}
      </div>
    </div>
  );
}
