# Trainyard — specification

## The sentence

**Trainyard** helps **a curious maker, teacher or student** **teach a webcam to tell
their own things apart (their pets, their desk objects, thumbs up vs. down)** in **about
two minutes**, without **writing code, uploading photos to a server, or making an account**.

## Scope cut (from the owner's issue #2)

The issue asked for images "and the same for audio", modular and fun. One run can finish
the image half properly, so audio is explicitly deferred. The "modular" ask is honoured
architecturally: the embedder (`src/lib/embedder.ts`) is an interface, so an audio
embedder can be added later without touching the dataset, the head or the UI.

## The core loop

1. Open the page. Two empty classes are waiting, ready to be renamed.
2. Press **Start camera** (the MobileNet feature extractor downloads once, with progress).
3. Select a class and press **Record**; frames are captured as fast as the device can embed them (about 4–8 per second) until
   Record is pressed again, or the class reaches 150 examples.
4. Repeat for at least two classes. Add or remove classes freely (2–8).
5. Press **Train**. A small softmax head trains on-device in a second or two; a loss line
   and the final accuracy on the training set are shown.
6. The live view predicts continuously: a ranked list of classes with confidence bars.
7. Everything survives a reload. **Export** writes a model file; **Import** reads one back.

Alternative input: **Add images** from files (for people without a webcam).

## Out of scope

- Audio (deferred, see above).
- Accounts, cloud sync, sharing links, server of any kind.
- Fine-tuning MobileNet itself, convolutional training, data augmentation.
- Persisting thumbnails (only feature vectors persist; counts show after reload).
- Object detection, bounding boxes, multi-label output.
- Exporting to TensorFlow SavedModel / TFLite (the export is our own JSON).
- Training-time hyperparameter UI.

## Acceptance criteria

1. The page loads with exactly two classes, each with 0 examples, and an h1 and a main.
2. A class can be renamed, added (up to 8) and removed (down to 2).
3. Train is disabled, with an explanation, until at least two classes have ≥ 5 examples.
4. `trainHead` on linearly separable synthetic embeddings reaches ≥ 95 % accuracy, and is
   deterministic for a fixed seed.
5. `predict` returns probabilities that are ≥ 0 and sum to 1 (±1e-6), sorted descending.
6. Embeddings round-trip through the stored 8-bit encoding with max error ≤ 1 % of range.
7. Corrupt, truncated or wrong-shape stored data yields the empty default, never a crash.
8. Exported model files re-import to an identical dataset and head; invalid files are
   rejected with a readable message and change nothing.
9. Adding image files from the file picker creates examples for the selected class (e2e,
   with a stub embedder) and Train then produces a working predictor.
10. The whole core loop is reachable by keyboard; no axe critical/serious violations in light
    and dark; no horizontal scroll at 320 px.
11. Heavy dependencies (TensorFlow.js, MobileNet) never load until the user asks for the camera
    or adds images, so first paint stays inside the bundle budget.

## Data model

```
Dataset  = { classes: { id, name, samples: Sample[] }[], selectedId }
Sample   = Float32 embedding of length D (L2-normalised), stored as base64 Int8 (×127)
Head     = { dim, labels: string[], weights: number[][] (K×D), bias: number[] }
Persisted: key "trainyard:state", versioned envelope (src/lib/storage.ts).
```

Absent or corrupt → two empty classes, no head, and a one-line notice when data was
recovered. A stored head is discarded if its dim/labels no longer match the dataset.
Adding or clearing examples after training marks the model "out of date" but keeps predicting. Adding or removing a class discards the model (its outputs are per-class), as does a class change while training.

## The four states

| State   | Behaviour                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Empty   | Two named-by-you classes, a three-step "how this works" panel, Record disabled until the camera is on.                                                             |
| Error   | Camera denied/missing → plain explanation plus the Add-images path. Model download failure → retry button. Storage full → inline notice, work continues in memory. |
| Slow    | Model download shows a determinate or indeterminate progress bar with size note (~5 MB, once). Training shows a live epoch counter.                                |
| Offline | Everything except the first model download works; if the model is not cached the error state explains that it needs one online visit.                              |

## The one thing that must be excellent

The moment of Train → the live predictor snapping to the right label as you move an object
in front of the camera. Confidence bars must feel immediate (as many predictions per second as the device can manage, ~8 on a laptop).
