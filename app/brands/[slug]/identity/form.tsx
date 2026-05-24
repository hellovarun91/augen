"use client";
import { Button, Input, Label, TextArea } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { saveIdentityAction } from "./actions";

export function IdentityEditor({ brand }: {
  brand: { id: string; name: string; tagline: string; industry: string; description: string };
}) {
  const [name, setName] = useState(brand.name);
  const [tagline, setTagline] = useState(brand.tagline);
  const [industry, setIndustry] = useState(brand.industry);
  const [description, setDescription] = useState(brand.description);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      action={() => start(async () => {
        await saveIdentityAction(brand.id, { name, tagline, industry, description });
        setSaved(true); setTimeout(() => setSaved(false), 2200);
      })}
      className="space-y-5"
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Brand name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Industry</Label>
          <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="education, beauty, beverage…" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Tagline</Label>
        <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="One line that captures the brand" />
        <div className="text-xs text-ink-400">The agents read this first. Make it sound like the brand, not the category.</div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <TextArea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the brand is, who it's for, why it exists." />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save identity"}</Button>
        {saved && <span className="text-sm text-emerald-300">Saved ✓</span>}
      </div>
    </form>
  );
}
