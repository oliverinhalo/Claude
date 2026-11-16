# Roomwise — specification

## The sentence

Roomwise helps **a housemate who has just been handed a lease** do **the rent split by room** in **under a minute**, without **the spreadsheet argument that ends with someone paying more than they think is fair**.

Chosen from the idea bank ("Rent split by room"), category `calculator`, scored 71/90 (ten-second value 5, one-run 5, repeat use 2, zero cost 5, findable 4, sellable 2, underserved 3, shareable 5, technical core 3).

## The core loop

1. Open the page: a worked example (3 rooms, 2,100/month) already shows the split.
2. Change the total rent.
3. Edit a room: name, size in m² (or ft²), perks ticked.
4. Add / remove a room.
5. Read each person's share and _why_ ("18 m² + ensuite = 41%").
6. Copy a share link or a plain-text summary to send to the house chat.

## Method

weight(room) = (area + sharedArea / rooms) × (1 + Σ adjustments). share = rent × weight / Σ weights.
Adjustments are percentages, editable. Amounts are rounded to whole currency units (or cents) using the largest-remainder method so shares always sum to the rent exactly.

## Out of scope

- Utilities, bills, deposits, per-night occupancy, move-in dates (pro-rating).
- Accounts, syncing, server storage, voting.
- Auto-detecting currency or area from listings.
- Multiple saved scenarios.

## Acceptance criteria

1. On first load, with no input, three rooms and their shares are visible and sum to the rent.
2. Shares always sum exactly to the total rent (property-tested).
3. A larger room never pays less than a smaller one with identical perks.
4. Ticking a positive perk raises that room's share and lowers the others'.
5. Zero rooms, zero/negative/non-numeric rent or area never produce NaN; the UI shows a message instead.
6. The state round-trips through the URL hash; opening the link reproduces the split.
7. Corrupt localStorage or a corrupt hash falls back to the example with a visible notice.
8. The entire loop is operable by keyboard; every field has a label.
9. No horizontal scroll at 320px; no axe serious/critical violations in light and dark.
10. "Copy summary" produces text with each name and amount and the total.
11. Max 12 rooms; area max 1000; rent max 1,000,000.

## Data model

`{ rent, unit: 'm2'|'ft2', currency, cents: boolean, shared: number, rooms: [{id,name,area,perks:string[]}], perks: [{id,label,pct}] }` stored via versioned store `roomwise:state` (v1) and mirrored to `#s=<base64url JSON>`. Hash wins over storage when valid. Invalid → example + notice.

## The four states

| State   | Behaviour                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------- |
| Empty   | No rooms: "Add the first room" prompt, example restore button.                                  |
| Error   | Invalid numbers: field-level message, results show "—" for affected rooms; corrupt-data notice. |
| Slow    | Pure computation, instant; no spinner. Copy button confirms with a live-region message.         |
| Offline | Fully client-side; nothing to fail. Footer says so.                                             |
