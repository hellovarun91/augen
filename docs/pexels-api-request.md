# Pexels API — description of use

**Project:** Augen — a design-first studio for creating on-brand advertising creatives.

**How we use the Pexels API**

Augen helps small teams produce on-brand ad creatives. When a user is building an
ad, they often need high-quality, royalty-free photography for the background/hero
image or as visual reference for art direction. We use the Pexels API to let users
search the Pexels library by keyword from inside the app and choose a photo to use
in their own ad composition.

Specifically:

- **Search** — we call the `/v1/search` endpoint with the user's query and show the
  results in-app for them to choose from.
- **Use** — the selected photo becomes the imagery in that user's own ad creative.
- **Attribution** — we display the photographer's name and a link back to Pexels
  with the results, and retain attribution per the Pexels Guidelines.
- **Respectful usage** — we honor the rate limits, cache results responsibly, and do
  not scrape, redistribute, mirror, or resell the Pexels library. Photos are only
  ever used inside a user's own creative work, never re-published as a stock library.

**Volume:** modest and interactive — individual users running occasional searches.
We are currently in private beta, so traffic is low and well within standard limits.

**Where it appears in the product:** the "References" section of a brand, where a
user can pull stock imagery alongside their own uploads and AI-generated references.
