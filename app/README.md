# app/ (PWA)

Farmer view (`/`, works offline) and lender view (`/verify#r=…&h=…`, opened from the QR).

```bash
cd app && npm install && npm run dev      # http://localhost:5173
npm run typecheck                         # TypeScript, strict. Run before every commit
npm run build && npm run preview          # typecheck + production build with the service worker (offline test)
npm run types                             # regenerate src/types/report.ts after changing docs/schema.json
npm run test:engine                       # report engine: schema-valid output + every rule in docs/RULES.md
```

Vercel: Root Directory = `app`, project name `agrifarm-evidence`.

## Who owns which file

**TypeScript, strict.** Shared contracts live in `src/types/index.ts`; report types are generated from `docs/schema.json`. The whole farmer flow already runs end to end on **fakes**. To plug in real work, replace the inside of *your* file and keep the function signatures. Contracts are written at the top of each file.

| File | Owner | Status |
|---|---|---|
| `src/capture/*`, `src/offline/*`, `src/lib/*`, `src/types/index.ts` | Nick | Real: consent, record, tap-confirm, map/walk, camera + geofence + turn-around, review, share/QR |
| `src/engine.ts` → `backend/engine/` | Farah | **Real (v1)**: builds the report from the farmer's confirmed answers, plot, photos and evidence card per `docs/RULES.md`; seals with SHA-256 on the phone. Extend the rules in `backend/engine/index.ts`; `npm run test:engine` must stay green. |
| `src/lender/Verify.tsx` | Farah | **Placeholder** |
| `src/ai/asr.ts` | Sakeet | **Fake** (whisper-tiny pending): demo transcript in demo mode, silence otherwise, so the farmer taps |
| `src/ai/extract.ts` | Sakeet | **Real**: rule-based Swahili extraction |
| `src/data/cards.ts` | Sakeet | **Fake**: evidence cards from mocks (real: `public/cards/{plot_id}.json`) |
| `src/data/reports.ts` | Nick | **Real**: Supabase upload/fetch/site-visit; queues offline and sends when back online. Needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (repo-root `.env`, and in Vercel env vars) |
| `public/audio/{sw,en}/{PHRASE_ID}.mp3` | Farah | Missing, so the app shows text and a "🔇 text only" badge |

## Demo mode

**Off by default**: real farmers get real GPS, camera and microphone. Turn it on in "Demo settings" or open the app with `?demo=1` (`?demo=0` turns it off). **DEMO GPS** then simulates positions inside the chosen demo plot (we are not in Mbozi) and is shown as a badge on every screen. Without a camera or microphone (desktop), frames are generated and the fake transcript is used.
