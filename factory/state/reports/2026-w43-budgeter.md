# Week 43 — Budgeter (resumed from w42 checkpoint)

Owner brief: issue #3 — annual pay -> estimated monthly take-home; add recurring expenses (e.g. £5/day lunch Mon–Fri).

## What happened
- Checkpoint stuck after `qa` since 15 Oct (background sub-agent). This run: gate (failed only because Playwright chromium was not installed on the runner; installed it, no check changed), then `qa` agent in the foreground.
- QA verdict SHIP. One real bug fixed: `NumberField` kept stale text after "Reset to the example" / a new share link. Regression test added. Gate 9/9, 84 unit + 28 e2e/a11y.
- Published via push to `staging/budgeter`. Deploy succeeded; live: https://budgeter-73o.pages.dev — `verify-live.mjs` all green.

## What broke
- `publish-app.yml` assumed `https://<slug>.pages.dev`. The name was taken globally so Cloudflare issued `budgeter-73o.pages.dev`; the workflow's verify step 404'd and reported failure even though the deploy was fine. Also the build baked canonical/sitemap/OG URLs for the wrong host.
- Fix written but NOT applied (the bot token cannot push workflow changes): `factory/state/publish-app-cloudflare-subdomain.patch`. Owner: apply it, then re-run publish for budgeter to correct the canonical URL.

## Not done
- Lighthouse and the polish ladder were not run this run; the owner's priority was to ship. Self-score 7/10.
