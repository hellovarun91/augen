# Augen ↔ Figma plugin

Brings Augen creatives into Figma as editable frames, and sends copy edits back
to Augen — the round-trip half of the Figma integration (the other half, Variables
token sync, lives in the app under **Manage Brand → Design tokens → Figma**).

## What it does

- **Load creatives** for a brand from your Augen instance.
- **Import** a creative onto the canvas: the rendered preview as a locked backdrop,
  plus editable text layers named `augen:headline`, `augen:subhead`, `augen:cta`,
  `augen:eyebrow`.
- Edit the copy in Figma, select the frame, **Send selection → Augen**. Augen
  updates that creative's copy; re-render in Augen to see it.

> Round-trips **copy + layout**. Editing the `augen:*` text and **moving** them is
> picked up: the headline's vertical position maps to the `headlineYShift` override,
> and the CTA's position maps to the nearest CTA placement preset. Finer layout
> (per-element free positioning) still lives in Figma.

## One-time setup

1. **Generate a token in Augen.** Open **Settings → MCP & API** and click
   **Generate token** (the same personal tokens MCP uses). Copy it.

2. **Load the plugin in Figma** (desktop app):
   - Menu → **Plugins → Development → Import plugin from manifest…**
   - Pick `figma-plugin/manifest.json` from this repo.

3. **Open the plugin** and fill in:
   - **Augen URL** — e.g. `https://web-production-9666a.up.railway.app` (pre-filled)
   - **Access token** — the token you generated in step 1 (`augen_…`)
   - **Brand slug** — the part after `/brands/` in the brand's URL, e.g. `tanda`

No server env var needed — it works against any Augen deploy as soon as you have a token.

## Security notes

- The plugin API (`/api/plugin/*`) authenticates with a **personal token** (the same
  tokens as MCP, sent as `x-augen-token`), resolves it to your user, and scopes every
  request to brands you're a member of — so it works from Figma's sandbox and can't
  touch other people's brands.
- Before sharing the plugin, narrow `networkAccess.allowedDomains` in `manifest.json`
  from `["*"]` to just your Augen domain.

## Files

- `manifest.json` — plugin manifest (entry points + network access).
- `code.js` — sandbox: builds the frame, reads copy back out.
- `ui.html` — the panel: config, list, import, send-back.

## Status

Built to the Figma Plugin API spec. It hasn't been run inside Figma in this
environment (no Figma desktop here), so give it a smoke test on first load —
the API side (list + save + CORS) is verified.
