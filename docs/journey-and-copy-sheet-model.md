# Project journey & Copy Sheet model

Source of truth for the journey redesign (tasks #46–#51). Locked with Varun on 2026-05-26 through a round of model-refinement questions. Build to this; flag deviations explicitly.

The principle behind every decision: **automate the boring, keep the instinct.** Offload the repetitive production (fanning one idea across regions and sizes, proofing, QC, packaging). Leave the concept, the edits, and the approvals with the designer.

## The journey (the loop)

A project is walked, not browsed. The order is:

```
Overview → Ideate → Copy Sheet → Design → Review → Deliverables
```

1. **Ideate** (the reframed Agentic Chain) — debate direction with the AI. It proposes a few angles *with draft copy already written into the layer fields* and explains its rationale. You push back / pick / refine. The chosen angles become **rows**; the chosen concept sets the project's **master** direction. Re-runnable — come back later to add angles, which append rows.
2. **Copy Sheet** — refine the words. Approve copy per row.
3. **Design** — render and approve **one** master look, then "generate all" fans the copy across rows × sizes.
4. **Review** — visually approve each design; edit-on-design syncs back to its row and offers to push to siblings.
5. **Deliverables** — only fully-approved designs land here → download or send to Figma.

### Gating: natural gates, not walls
No hard locks on opening a step. But you **can't fan out without a master**, and **can't render without rows** — and Ideate is the easiest place to get both. Ideate earns its place by being the path of least resistance, not a tollbooth. (This is the answer to "make sure Ideate isn't bypassed.")

## The Copy Sheet model

The mental model is a **Figma component with text overrides**: one master artwork, many copy variations, each rendered at several sizes.

- **Columns = layers.** Rendered layers (eyebrow, headline, subhead, CTA) + copy-shaping inputs (offer, price, …) + a **Name** column + an optional **Image** column. The schema = brand-default columns + per-project additions.
  - *Rendered layers* are the slots the composer actually draws.
  - *Copy-shaping inputs* (offer, price) are folded into the rendered copy by the AI — they are **not** separately positioned elements yet. True positioned layers (price as its own badge) come later.
- **Rows = copy variations.** e.g. "India · festive offer", "US · awareness". Each row holds: a Name, the per-layer copy, an optional image override, and a **copy-approval status**.
- **Sizes = a project-wide set** (1:1, 4:5, 9:16, 16:9), applied to every row. Per-row size opt-out deferred.
- **The Name column** labels each row and names the designs it generates.

A row with name "India" × 4 sizes = 4 designs, all sharing India's copy. 8 rows × 4 sizes = 32 organized designs.

## Concept & master

- A project carries **exactly one master design**: a locked layout + style + imagery treatment, sitting on top of the brand's tokens.
- The master is realized by rendering **one reference creative** and approving its *look*. Fan-out reuses that look and swaps copy + size.
- **Imagery travels with the master** (shared by default for brand consistency). A row may override it via the optional **Image** column when a region needs its own shot.
- Want a different look? **Duplicate the project** (rows come along). Multi-look A/B within one project is a deliberate future extension, not v1.

## Designs (row × size)

- A **design = row × size**. It inherits the master look, takes the row's copy, and carries its own **visual-approval status**.
- **Sizes reflow, not crop.** A 9:16 story and a 16:9 bumper re-lay-out the same copy + style — they are not crops of each other. So approving one master at one size means trusting the per-size adaptation, then catching per-size issues in Review. (This is *why* visual approval is per design, not per row.)

## Approval & sync (the integrity rules)

- **Row owns the copy** — single source of truth. Approve **copy at the row level**.
- **Each design (per size) is approved visually on its own.**
- **A design ships to Deliverables only when its row's copy is approved AND its own visual is approved.**
- **Edit-on-design → row → siblings.** Editing copy directly on a design updates the row and offers to push the change to that row's other sizes (no retyping across crops).
- **Edits invalidate downstream approvals, never auto-spend:**
  - Edit a row's copy → that row's designs go **stale** and lose their visual approval → "Re-render N?" (you decide).
  - Edit the master look → **all** designs go stale → "Re-render all?".
  - Re-rendering is always deliberate. No silent credit spend, approvals stay honest.

## Build order (maps to tasks)

| # | Task | Depends on |
|---|------|-----------|
| 46 | Re-model the Copy Sheet (rows = variations, columns = layers, Name column, project size set, retire per-region cells) | — |
| 47 | Row→designs fan-out engine (one concept, scaled; render+approve master, then generate all) | 46 |
| 48 | Reframe Agentic Chain → Ideate (angles with draft copy → rows; concept → master; re-runnable) | 46 |
| 49 | Approval + sync model (row owns copy; visual per design; edit→row→siblings; stale-on-edit) | 46 |
| 50 | Sequence the guided journey + gate Deliverables (fully-approved only; download / Figma) | 47, 49 |
| 51 | Live copy editing on the creative (Review) | 49 |

Critical path: **46 → 47/49 → 50.** 48 (Ideate) and the independent quality/security items (#52 imagery gap, #53 Figma plugin networkAccess) can run in parallel.

## Deliberately deferred (not in this pass)

- Per-row size opt-out (start project-wide).
- Custom columns as *true positioned layers* (start as copy-shaping inputs only).
- Multiple masters / A/B looks within one project (duplicate the project instead).
- Migration of legacy "one row per creative" sheets — old projects untouched; new model applies going forward, with an optional one-time "regroup."
