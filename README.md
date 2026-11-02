# Plate Check v0 (test build, unlisted)
Food-sensitivity checker. Profiles live only on the user's phone (localStorage / private link hash). This repo holds no one's results.
- `engine.js`: on-device matcher (derivatives, E-numbers, typical recipes), report parser (PDF text / OCR boxes)
- `catalog.js`: checklist of food & additive names (no levels)
- `worker/worker.js`: meal-photo analyzer for Cloudflare Workers, **not deployed**. The key goes in as a Worker secret, never in this repo.
