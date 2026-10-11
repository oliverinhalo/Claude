# Trainyard

**Teach your webcam what things are.** Record examples, name them, and train an image classifier in seconds — entirely in your browser.

**[Open the app →](https://trainyard.pages.dev)**

No account. No upload. No server. Your pictures never leave the tab.

---

## What it does

1. Name two or more classes (your cat vs. your dog, thumbs up vs. thumbs down, three mugs).
2. Start the camera and record examples into each class — or add image files.
3. Press **Train**. A small classifier learns on your device in a second or two.
4. Hold something up: live confidence bars show what it thinks it sees.

Work is saved in your browser. **Export** writes a model file you can keep or move to another browser; **Import** loads it back. **Test with an image** classifies a single picture, handy without a camera.

## Why it exists

Browser-based "teachable machine" demos are great but tie you to an account or a cloud. Trainyard is a no-account, installable-nowhere version you can use on a classroom laptop, and it works as a way to _see_ how few-shot learning works.

## How it works

- **Features:** [MobileNet v1 (α = 0.5)](https://github.com/tensorflow/tfjs-models/tree/master/mobilenet) via TensorFlow.js turns each frame into a 512-number embedding. TensorFlow.js and the weights (~5 MB) are fetched from jsDelivr / Google Cloud Storage the first time you start the camera or add images, then cached by the browser — which keeps the app itself tiny.
- **Learning:** the trainable part is a softmax-regression head written in plain TypeScript (`src/lib/head.ts`): 200 steps of full-batch gradient descent with class-balanced weights. It never touches the network.
- **Storage:** embeddings (not pictures) are saved to `localStorage` as 8-bit vectors (`src/lib/dataset.ts`), through a versioned store that recovers from corrupt data (`src/lib/storage.ts`).
- **Modular:** the app only knows the `Embedder` interface (`src/lib/embedder.ts`). An audio embedder would be a second implementation; the dataset, head and persistence would not change.

Limits: 2–8 classes, 150 examples each. The first use needs a connection to download the model.

## Running it locally

```bash
npm install
npm run dev
```

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Development server                                    |
| `npm run build`     | Production build into `dist/`                         |
| `npm test`          | Unit tests (trainer, dataset, storage)                |
| `npm run test:e2e`  | End-to-end and accessibility tests (model is stubbed) |
| `npm run typecheck` | Type checking                                         |
| `npm run lint`      | Lint                                                  |
| `npm run budget`    | Bundle size budget                                    |

## Roadmap

- Audio classes (record and label sounds) via a second `Embedder`.
- Bundle the model for fully offline first use.
- Export to a TensorFlow.js layers model.

## Licence

MIT — see [LICENSE](./LICENSE).

---

Built by the [weekly app factory](https://github.com/oliverinhalo/Claude).
