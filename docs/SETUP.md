# One-time setup

The pipeline runs with **zero** of this configured — it will publish to GitHub
Pages and keep going. Each step below removes a limitation. Do them once; never
again.

Total time: about ten minutes.

---

## Step 0 — Make `main` the default branch (one click, do this first)

This repository was created empty, so GitHub made the first pushed branch the
default. Session proxies refuse repository-settings writes, so this one cannot be
done from a Claude session.

1. Open <https://github.com/oliverinhalo/Claude/settings>
2. Under **Default branch**, click the switch icon and choose **`main`**.
3. Confirm.

Until this is done, the factory still runs — both branches hold the same content —
but the weekly run and the `main` branch can drift apart, and scheduled workflows
fire from the wrong branch. Thirty seconds now saves a confusing week later.

---

## Step 1 — `FACTORY_GH_TOKEN` (required for one-repo-per-app)

Without it, every app is published as a subdirectory of this repository instead of
getting its own repo. With it, each app gets `github.com/oliverinhalo/<app-slug>`.

1. Open <https://github.com/settings/personal-access-tokens/new> (fine-grained).
2. **Token name:** `app-factory`
3. **Expiration:** 1 year — the calendar reminder below covers the renewal.
4. **Resource owner:** `oliverinhalo`
5. **Repository access:** *All repositories*
   (it must be able to create repositories that do not exist yet)
6. **Permissions → Account permissions:**
   - `Administration` → **Read and write**  ← this is what allows repo creation
7. **Permissions → Repository permissions:**
   - `Administration` → **Read and write**  (create repos, set topics, enable Pages)
   - `Contents` → **Read and write**        (push the app)
   - `Pages` → **Read and write**           (publish)
   - `Workflows` → **Read and write**       (the app's own CI workflow file)
   - `Metadata` → Read-only (auto-selected)
8. Generate, copy the token.
9. Add it here: <https://github.com/oliverinhalo/Claude/settings/secrets/actions/new>
   - **Name:** `FACTORY_GH_TOKEN`
   - **Secret:** the token

> Set a calendar reminder 11 months out to regenerate it. If it expires mid-year the
> pipeline degrades to the subdirectory fallback and says so loudly in the run report
> rather than failing silently.

---

## Step 2 — Cloudflare (recommended; upgrades hosting from Pages to Cloudflare)

Free forever at this usage. No card required for the free plan.

1. Sign up at <https://dash.cloudflare.com/sign-up>.
2. Account ID: open the dashboard, pick **Workers & Pages** — the Account ID is in
   the right sidebar. Copy it.
3. Create a token at <https://dash.cloudflare.com/profile/api-tokens> →
   **Create Token** → use the **Edit Cloudflare Workers** template.
   Under *Account Resources* select your account. Create, copy.
4. Add **both** as Actions secrets in this repository
   (<https://github.com/oliverinhalo/Claude/settings/secrets/actions>):
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

The publisher detects these and switches hosting automatically. Nothing else changes.

---

## Step 3 — Vercel (optional, and probably skip it)

Only worth adding if you specifically want Vercel's preview deployments. **The
Hobby plan prohibits commercial use**, so for apps you intend to sell, Cloudflare
is the better default.

1. <https://vercel.com/account/tokens> → create a token.
2. Add as `VERCEL_TOKEN`, plus `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` if you want
   a fixed project.

---

## Step 4 — Confirm the weekly Routine exists

The Routine is what wakes the agent. Check it at
<https://claude.ai/settings/automations> (or ask Claude: *"list my routines"*).

You are looking for **"Weekly app factory"**, scheduled Mondays. If it is missing,
ask Claude in any session:

> Recreate the weekly app factory routine from `.claude/skills/ship-weekly-app/SKILL.md`.

---

## Verifying the setup

A Claude session **cannot** check whether your secrets exist — the proxy blocks the
Actions secrets API, so from a session "missing" and "unreadable" look identical.
`factory/scripts/preflight.sh` says so plainly rather than guessing.

To check for real, dispatch the verifier. It reports which secrets exist, which
host the next run would choose, and — crucially — whether the PAT is actually
scoped to create repositories, by creating a throwaway repo and deleting it again:

```bash
gh api -X POST repos/oliverinhalo/Claude/actions/workflows/verify-setup.yml/dispatches -f ref=main
```

Or from the browser: **Actions → Verify setup → Run workflow**.

The result is in the run's summary. A mis-scoped token is the single most likely
setup mistake, and this is the only thing that catches it before a real run does.

## What happens on a Monday

Nothing you need to do. By Monday afternoon there is a new repository under your
account, a live URL, and a run report committed to `factory/state/`. If a run fails,
the failure is committed too, with the diagnosis, and the following Monday's run
picks the work back up rather than starting over.
