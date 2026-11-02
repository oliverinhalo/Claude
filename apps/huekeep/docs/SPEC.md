# Huekeep — specification

## The sentence

**Huekeep** helps **a designer or front-end developer whose brand colour fails WCAG contrast** get **the nearest passing colour, same hue, as a hex they can paste** in **under ten seconds**, without **nudging a picker's lightness slider until the ratio turns green**.

## Why it beats the incumbents

Contrast checkers say "fail" and stop. The few that suggest a fix drift the hue or hand back a grey. Huekeep searches in OKLCH, holding hue and chroma, and moves only lightness (reducing chroma only where the sRGB gamut forces it). Everything runs locally; there is no account and no upload.

## The core loop

1. Open the page. A real failing pair is already loaded and already fixed.
2. Edit the text colour or the background (typed, pasted, or picked).
3. Read the live ratio and the pass/fail for the chosen target.
4. See two fixes: change the text, or change the background. Each shows hex, new ratio and how far it moved.
5. Copy a hex or a CSS snippet; or "Use this" to apply a fix and carry on.
6. Share the pair as a URL.

## Out of scope

- Transparency / alpha (rejected with a clear message, never silently flattened).
- APCA / WCAG 3 (the legal standard today is WCAG 2.x ratio).
- Whole-palette fixing, image sampling, colour-blindness simulation.
- Accounts, sync, analytics.
- Named colours beyond the 17 basic CSS names; `color()`, `lab()`, `oklch()` input.

## Acceptance criteria

1. On first load, with no input, a failing pair is shown with its ratio below 4.5 and at least one fix whose ratio is ≥ 4.5.
2. Contrast ratio matches WCAG 2.x: black on white = 21.00, `#777` on white ≈ 4.48 (fail), `#767676` on white ≈ 4.54 (pass).
3. Parser accepts `#rgb`, `#rrggbb`, `rgb()` (comma or space syntax), `hsl()` and basic names; rejects anything else with a message naming the problem. 8-digit hex / alpha gets a transparency-specific message.
4. Every fix returned meets the chosen target on its **8-bit rounded** value, never merely its float value.
5. A fix keeps OKLCH hue within 2° of the original wherever the original has chroma ≥ 0.04 (gamut mapping reduces chroma, not hue).
6. A pair that already passes says so and offers no fix, and shows its ratio.
7. When a role cannot reach the target (e.g. 7:1 against mid-grey by changing only text) that is stated and the other role's fix is offered.
8. Targets selectable: AA text 4.5, AA large text and UI 3, AAA text 7. Selection persists.
9. Pair and target persist across reload; corrupt storage falls back to the seed without a crash.
10. A shared URL hash restores the pair and target; a malformed hash is ignored.
11. "Copy" puts the hex on the clipboard and announces it in a live region; if the clipboard is blocked the hex stays selectable and the message says so.
12. Entire loop usable with the keyboard; no axe critical/serious violations in light and dark; no horizontal scroll at 320px.
13. 50,000 characters pasted into a field neither freezes the page nor crashes; it is rejected as too long.

## Data model

`{ fg: string, bg: string, target: 3 | 4.5 | 7 }` in `localStorage` key `huekeep:state`, via the versioned self-healing store (v1). Unknown or invalid → seed. Raw strings are stored (what the user typed), parsed on read.

## The four states

| State   | Behaviour |
| ------- | --------- |
| Empty   | A field cleared shows "Type a colour like #1a73e8, rgb(26 115 232) or hsl(217 80% 51%)" and results hold the last valid pair, dimmed and labelled stale. |
| Error   | Per-field inline message saying what was wrong and an example of a valid form; field marked `aria-invalid`. |
| Slow    | Search is synchronous and < 20 ms; no spinner exists. Typing is not debounced. |
| Offline | Nothing is fetched. The app works fully with the network off; the footer says so. |

## The one thing that must be excellent

The **lightness ribbon**: a strip showing the colour at every lightness with the passing zones marked, the original and the fix as markers. It shows *why* the fix is where it is.
