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

## Setup — just connect your account

1. **Load the plugin in Figma** (desktop app):
   - Menu → **Plugins → Development → Import plugin from manifest…**
   - Pick `figma-plugin/manifest.json` from this repo.

2. **Click "Connect Augen account."** A browser tab opens Augen — you're already
   signed in with your email (or sign in if not) — and you click **Approve**. The
   plugin connects automatically. No URL, token, or brand slug to type.

3. Pick a **brand** from the dropdown → **Load creatives** → **Import** one →
   edit the `augen:*` text layers (and move the headline / CTA) → select the
   frame → **Send selection → Augen**.

The Augen URL is baked in (override it under **Advanced** for a different deploy).

## How it works / security

- "Connect" runs a **device-authorization** flow: the plugin opens `/connect?code=…`,
  you **approve inside your authenticated Augen session**, and Augen mints a personal
  token (named "Figma plugin") that the plugin receives by polling. Your email is never
  the credential — approval happens in your logged-in session.
- The plugin API (`/api/plugin/*`) resolves that token to your user and scopes every
  request to brands you're a member of — it can't touch anyone else's brands.
- Revoke access anytime in Augen → **Settings → MCP & API** (the "Figma plugin" token).
- Before sharing the plugin publicly, narrow `networkAccess.allowedDomains` in
  `manifest.json` from `["*"]` to just your Augen domain.

## Files

- `manifest.json` — plugin manifest (entry points + network access).
- `code.js` — sandbox: builds the frame, reads copy back out.
- `ui.html` — the panel: config, list, import, send-back.

## Status

Built to the Figma Plugin API spec. It hasn't been run inside Figma in this
environment (no Figma desktop here), so give it a smoke test on first load —
the API side (list + save + CORS) is verified.
