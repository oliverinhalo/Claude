# The polish ladder

Climbed in Phase 7, in order, until the session ends. Each rung is a commit.

## Rung 1 — Hostile input

- [ ] Paste 50,000 characters into every text input. Does it survive? Is it fast?
- [ ] Submit every form empty. Then with only whitespace. Then with emoji only.
- [ ] Double-click every button. Triple-click the destructive one.
- [ ] Paste HTML, a script tag, and an RTL override string into every field.
- [ ] Numbers: negative, zero, 1e308, `NaN`, a comma decimal, a leading `+`.
- [ ] Dates: 29 February, a leap second, a date in 1600, a date in 2400, DST change day.
- [ ] Resize to 320×568. Then 320px with 200% browser zoom.
- [ ] Turn the network off mid-interaction. Then on again.
- [ ] Corrupt `localStorage` by hand, reload. Does it recover or does it white-screen?
- [ ] Open two tabs, change state in both.

## Rung 2 — Copy

Every string, rewritten. The bar: it reads like one person wrote it on a good day.

- [ ] No "Oops", no "Something went wrong", no bare "Error".
- [ ] Every error says what happened, why, and what to do next.
- [ ] Button labels are verbs that name the outcome — "Save and export", not "Submit".
- [ ] Empty states teach the product, in one sentence, and offer the first action.
- [ ] No placeholder text survived. Search the repo for `lorem`, `TODO`, `Example`,
      `foo`, `test123`.
- [ ] Microcopy under the hard input, explaining the format, before they get it wrong.

## Rung 3 — Performance

- [ ] Lighthouse ≥ 95 on Performance, Accessibility, Best Practices, SEO. Measured.
- [ ] Largest Contentful Paint under 1.5s on a simulated slow 4G.
- [ ] No cumulative layout shift. Reserve space for everything that loads.
- [ ] Fonts preloaded and `font-display: swap`. No invisible-text flash.
- [ ] Route-split anything over 30KB that is not needed on first paint.
- [ ] One re-render per interaction. Profile it; do not assume.

## Rung 4 — Findability

- [ ] Title tag that matches what someone would actually search.
- [ ] Meta description written for a human reading search results.
- [ ] Open Graph image — rendered, real, with the app's own type and colour. Not a logo on white.
- [ ] `application/ld+json` structured data for the app type.
- [ ] `sitemap.xml`, `robots.txt`, canonical URL.
- [ ] Semantic landmarks: one `h1`, real `main`/`nav`/`footer`, headings in order.

## Rung 5 — First run

- [ ] The app is useful and interesting with zero input, on first load, forever.
- [ ] Seeded content is real and specific, never "Item 1". If it is a budget app,
      seed a real-looking budget. If it is a chord tool, seed a chord people want.
- [ ] A "reset to the example" affordance, so exploring is safe.
- [ ] No modal, no tour, no cookie banner, no email capture on first visit.

## Rung 6 — The second feature

The thing the user wants the instant they finish the core loop. Usually one of:
export, share-by-URL, undo, history, duplicate, keyboard shortcuts, print
stylesheet, or import from the incumbent. Pick the right one and build it properly.

## Rung 7 — Explain itself

- [ ] One screen in the app that says what it is, for whom, and why it exists.
- [ ] README: what, screenshot, live link, how to run it, how it works, licence.
- [ ] A `#how-it-works` section for the mechanism, if there is an interesting one.

## Rung 8 — Beyond

Still have budget? In order: a second real feature from the spec's out-of-scope
list, a genuinely useful offline mode, an embeddable widget version, then start
next week's app and checkpoint it.
