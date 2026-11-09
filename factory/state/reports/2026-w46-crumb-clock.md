# Week 46 — Crumb Clock

Live: https://crumb-clock.pages.dev · Repo: oliverinhalo/crumb-clock. Queue and inbox were empty, so I chose from the idea bank.

## Selection
Not run as the full 40-candidate / scored-top-8 pass: I picked "Sourdough schedule" from the existing bank (category `planner`, never shipped; recent categories were developer, finance, music, accessibility, education) with no scoring table written. That is a deviation from Phases 1–2. Informal fit: useful on load via a seeded schedule, pure client-side, shareable link and .ics export, findable query ("sourdough schedule").

## Built
Backwards scheduler (8 steps) with temperature scaling (halves per +8 °C, baseline 24 °C), same-day vs overnight-fridge methods, night-time step flags, infeasible-plan alert with earliest feasible time, default ready time chosen so nobody is woken, .ics export with 5-minute alarms, shareable URL-hash links, saved settings in a versioned store with corrupt-data recovery, warm light/dark theme.

## Cut
Recipes, hydration maths, multiple loaves, in-page timers.

## QA
Foreground qa agent: 10/10 criteria pass. Fixed: year 0001 parsed as 1901, hashchange ignored on pasted links, fractional temperature in links, ICS folding by octets. Left: clearing the date field is ignored; alert lacks year; hash stays stale after Copy link; overflow at 200px. Fixes were not re-driven in a browser by QA, but the gate and my production check (8 steps, cold proof appears) passed.

## What broke
Playwright browser missing (installed). Lint non-null assertions and a Python-escaped `\;` bug of my own, fixed. Publish workflow warned FACTORY_GH_TOKEN not set, yet the repo exists and the app deployed to Cloudflare Pages; GitHub Pages retirement warning also appeared.

## Score: 7/10
Solid, focused, accessible, verified live. Lighthouse not measured; the schedule's durations are rule-of-thumb, not validated against real bakes; copy/design pass was light.
Would do differently: do the real scoring pass and measure Lighthouse.
