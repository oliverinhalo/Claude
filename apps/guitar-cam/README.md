# Guitar Cam

Live note and chord detection from your guitar, on a fretboard, with tab export.

**[Open the app →](https://guitar-cam.pages.dev)**

No account. No tracking. Audio is analysed in your browser and never uploaded.

---

## What it does

Press **Listen** and play. Guitar Cam names the note (with how many cents sharp or flat),
lights the string and fret on a fretboard, and names chords when you strum. Press **Record**
to capture a phrase as tab, then export it as **MusicXML** (opens in Guitar Pro, MuseScore and
TuxGuitar), **MIDI**, **text tab** or **JSON**. A **fretboard drill** names a note and a string
and checks your playing by ear and by eye. **Try the demo** runs a built-in performance through
the real analyser, no microphone needed.

## Why it exists

Working out a part means stopping, guessing a note, finding it on the neck, and typing tab by
hand. Guitar Cam shortens that to play, look, export.

## Running it locally

```bash
npm install
npm run dev
```

| Command             | What it does                       |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Development server                 |
| `npm run build`     | Production build into `dist/`      |
| `npm test`          | Unit tests                         |
| `npm run test:e2e`  | End-to-end and accessibility tests |
| `npm run typecheck` | Type checking                      |
| `npm run lint`      | Lint                               |
| `npm run budget`    | Bundle size budget                 |

Microphone access needs `https://` or `localhost`.

## How it works

- **Single notes** use the McLeod pitch method on the latest 4096 samples
  (`src/lib/pitch.ts`), accurate to a few cents across the guitar's range.
- **Chords** fold a 16384-sample spectrum into twelve pitch classes, subtract the overtones a
  string produces on its own, and match against eight chord qualities (`src/lib/chord.ts`).
  A chord needs three genuinely sounding pitch classes, so a power chord reads as its root
  note. A chord is only believed once its pitch content has stopped changing
  (`src/lib/analyzer.ts`): right after a melody moves, the long window holds two notes at
  once, and that blend looks exactly like a chord.
- **The tracker** (`src/lib/tracker.ts`) turns per-frame guesses into played events: it needs
  three agreeing frames to start one, and rides out the flicker of a decaying string.
- **Export** quantises to a sixteenth-note grid at your tempo (`src/lib/export.ts`). MusicXML
  carries string and fret for every note; notes crossing a bar line are tied.

### Honest limits

- **Not native Guitar Pro.** `.gp` files are a proprietary binary format. MusicXML is the open
  format Guitar Pro imports.
- **Chord fingerings are inferred**, not heard. A microphone hears pitches, not which string
  made them; Guitar Cam picks the lowest playable voicing and labels it as inferred.
- **One instrument, one source.** Played notes are placed on the neck near your previous note.
  Bends, slides and rhythm detail beyond the tempo grid are not captured.
- Use a quiet room or an audio interface. Browser voice processing is switched off for you.

## Roadmap

Per-string pitch tracking for real voicings, swing and triplet grids, bass and ukulele tunings,
import of saved takes.

## Licence

MIT — see [LICENSE](./LICENSE).
