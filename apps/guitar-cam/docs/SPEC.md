# Guitar Cam — specification

Source of truth: owner brief, issue #4 on the factory repo (dictated; interpretation recorded there).

## The sentence

**Guitar Cam** helps **a guitarist practising or working out a part** see **which note or chord
they are playing, on which fret** in **real time**, and turn it into a **tab they can export**,
without **guessing by ear or retyping tab by hand**.

## Must have (contract)

1. Track the fretboard: a live fretboard that lights the string and fret being played.
2. Tell the player the note or chord playing right now, from the microphone.
3. Export the performance as files for tab software: MusicXML (opens in Guitar Pro, MuseScore,
   TuxGuitar), standard MIDI, ASCII tab, JSON. Native `.gp` is not produced (proprietary binary).

## Nice to have

Drill mode (name a target, check by ear and by eye). Alternate tunings.

## Do not include

Anything basic, anything unprofessional: no accounts, no ads, no fake data, no unfinished panels.

## The core loop

1. Open the page. **Try the demo** plays a performance through the real analyser, no microphone needed.
2. Press **Listen**; allow the microphone.
3. Play. The readout shows note, octave, cents sharp/flat; the fretboard lights the position.
4. Strum. The readout shows the chord name; chord tones light on the fretboard.
5. Press **Record**; play a phrase; press **Stop**. Events appear as tab.
6. Set tempo, choose a format, **Export**.

## Out of scope

Native `.gp`/`.gpx`; cloud storage; accounts; backing tracks; polyphonic per-string pitch
separation (chord voicings are inferred, and labelled as inferred); rhythm detection beyond
quantising to a sixteenth grid at the chosen tempo; bends, slides, hammer-ons; bass or other
instruments; native app.

## Acceptance criteria

1. `detectPitch` returns the right frequency within 3 cents for every open string in standard
   tuning, for sine and harmonic-rich input.
2. `detectPitch` returns null for silence and for noise.
3. `identifyChord` names E, Em, A, Am, D, Dm, G, C, E7, A7, D7 from synthesised strums.
4. `positionsFor` lists every string/fret for a pitch in the current tuning; open low E is
   string 6 fret 0 only; E4 has 5 positions in standard tuning up to fret 24.
5. The tracker emits a note only after it is stable, and closes it on silence or a new pitch.
6. A recorded take exports to MusicXML (well-formed XML, one `<fret>`/`<string>` per note),
   a Type-0 MIDI file with correct header and note numbers, ASCII tab with six aligned lines,
   and JSON that re-imports to an equal take.
7. The demo runs without microphone access and drives the readout and the fretboard.
8. Denied or missing microphone shows a specific message and leaves the demo available.
9. No console errors; no horizontal scroll at 320px; no serious axe violations in light or dark.
10. Every control reachable and operable by keyboard.

## Data model

`localStorage` key `guitar-cam:state`, versioned by `createStore`:
`{ tuning: TuningId, bpm: number (40–240), take: Take | null }`.
`Take = { id, createdAt, tuning, events: TabEvent[] }`,
`TabEvent = { t0, t1 (ms), label, notes: { string (1–6), fret (0–24) }[] }`.
Anything that fails validation is replaced by the default and the user is told.

## The four states

| State   | Behaviour                                                                                 |
| ------- | ----------------------------------------------------------------------------------------- |
| Empty   | Readout says "Play a note" with the demo offered; Take panel says "Nothing recorded yet". |
| Error   | Mic denied / absent / no secure context: named cause and what to do; demo still works.    |
| Slow    | Mic permission pending shows "Waiting for microphone permission…"; Listen disabled.       |
| Offline | Everything is client-side; the page works offline once loaded. Stated in the footer.      |
