# Atlas implementation demo — 23 October 2026

18 original screenshots of the running Next application, plus a four-screen mobile contact sheet.

- Desktop: 1440 × 1000; full landing capture included.
- Mobile: 390 × 844.
- Video: 60 seconds, 1440 × 1000, 25 fps, VP9/WebM, no audio.
- Vietnamese captions and nine chapter buttons in the album.
- Existing local demo records, native search/status filters, live API/database. No mocked responses or business commands; order SO-2026-1002 remains DRAFT.

Open the album at <http://127.0.0.1:8766/> while its server is running. Start it from the repository in Ubuntu WSL:

```bash
python3 docs/design-v2/serve-demo-media.py
```

The server exposes only this media folder on loopback and supports byte ranges for video seeking. `capture-report.json` records the captures and chapters; `media-qa.json` records image loading, playback, resolution and seeking checks.

To regenerate with the local API and production web build running on port 3000:

```bash
node docs/design-v2/capture-demo-media.mjs
node docs/design-v2/verify-demo-media.mjs
```
