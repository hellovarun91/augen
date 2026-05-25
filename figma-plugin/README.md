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

1. **Set a plugin token on the server.** Add an env var on your Augen deploy:
   ```
   PLUGIN_API_TOKEN=<a long random string>
   ```
   (On Railway: `railway variables --set "PLUGIN_API_TOKEN=…" --service web`.)
   Without it, the plugin API returns 503 by design.

2. **Load the plugin in Figma** (desktop app):
   - Menu → **Plugins → Development → Import plugin from manifest…**
   - Pick `figma-plugin/manifest.json` from this repo.

3. **Open the plugin** and fill in:
   - **Augen URL** — e.g. `https://web-production-9666a.up.railway.app`
   - **Plugin token** — the same `PLUGIN_API_TOKEN` value
   - **Brand slug** — e.g. `tanda`

## Security notes

- The plugin API (`/api/plugin/*`) authenticates with `PLUGIN_API_TOKEN` (sent as the
  `x-augen-token` header), not your session — so it works from Figma's sandbox.
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
