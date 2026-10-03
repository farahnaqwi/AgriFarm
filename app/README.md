# app/ (PWA)

Farmer view (`/`, works offline) and lender view (`/verify#r=…&h=…`, opened from the QR).

```bash
cd app && npm install && npm run dev      # http://localhost:5173
npm run typecheck                         # TypeScript, strict. Run before every commit
npm run build && npm run preview          # typecheck + production build with the service worker (offline test)
npm run types                             # regenerate src/types/report.ts after changing docs/schema.json
```

Vercel: Root Directory = `app`, project name `agrifarm-evidence`.

## Who owns which file

**TypeScript, strict.** Shared contracts live in `src/types/index.ts`; report types are generated from `docs/schema.json`. The whole farmer flow already runs end to end on **fakes**. To plug in real work, replace the inside of *your* file and keep the function signatures. Contracts are written at the top of each file.

| File | Owner | Status |
|---|---|---|
| `src/capture/*`, `src/offline/*`, `src/lib/*`, `src/types/index.ts` | Nick | Real: consent, record, tap-confirm, map/walk, camera + geofence + turn-around, review, share/QR |
| `src/engine.ts` | Farah | **Fake**: returns the mock report. Replace with `export { buildReport, seal } from "@engine";` |
| `src/lender/Verify.tsx` | Farah | **Placeholder** |
| `src/ai/asr.ts`, `src/ai/extract.ts` | Sakeet | **Fake**: demo transcripts |
| `src/data/cards.ts` | Sakeet | **Fake**: evidence cards from mocks (real: `public/cards/{plot_id}.json`) |
| `src/data/reports.ts` | Sakeet | **Fake**: queues on the phone (real: Supabase) |
| `public/audio/{sw,en}/{PHRASE_ID}.mp3` | Farah | Missing, so the app shows text and a "🔇 text only" badge |

## Demo mode

"Demo settings" on the home screen. **DEMO GPS** simulates positions inside the chosen demo plot (we are not in Mbozi) and is shown as a badge on every screen. Without a camera or microphone (desktop), frames are generated and the fake transcript is used.
