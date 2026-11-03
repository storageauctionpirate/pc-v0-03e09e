# Plate Check v0 (test build, unlisted)
Food-sensitivity checker. Profiles live only on the user's phone (localStorage / private link hash). This repo holds no one's results.
- `engine.js`: on-device matcher (derivatives, E-numbers, typical recipes), report parser (PDF text / OCR boxes)
- `catalog.js`: checklist of food & additive names (no levels)
- `worker/worker.js`: meal-photo analyzer for Cloudflare Workers, **not deployed**. The key goes in as a Worker secret, never in this repo.

## v1 (label-first)
- Home = one big "Snap ingredients" button (camera opens straight away; "Pick a photo" fallback).
- `ocr.js`: on-device label reader (Tesseract.js) with EXIF orientation, auto-rotate search, two looks per photo (as shot + contrast/glare-flattened), crop-to-text-block + zoom, label-word spell fix, retake prompt when too little is read.
- Result: big AVOID / CAUTION / OK, problem ingredients with levels, "Snap another"; details collapsed.
