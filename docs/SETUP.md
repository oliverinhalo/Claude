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
5. **Repository access:** _All repositories_ — **not** _Only select repositories_.

   > This one matters more than it looks. _Creating_ a repository is an **account**
   > permission, so a token limited to selected repositories will create
   > `oliverinhalo/<app>` successfully and then fail to **push** to it, because a
   > brand-new repo is not in the selected list. The run gets a repository with
   > nothing in it and a `403`.

6. **Permissions → Account permissions:**
   - `Administration` → **Read and write** ← this is what allows repo creation
7. **Permissions → Repository permissions:**
   - `Administration` → **Read and write** (create repos, set topics, enable Pages)
   - `Contents` → **Read and write** (push the app)
   - `Pages` → **Read and write** (publish)
   - `Workflows` → **Read and write** (the app's own CI workflow file)
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
   Under _Account Resources_ select your account. Create, copy.
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
<https://claude.ai/settings/automations> (or ask Claude: _"list my routines"_).

You are looking for **"Weekly app factory"**, scheduled Mondays. If it is missing,
ask Claude in any session:

> Recreate the weekly app factory routine from `.claude/skills/ship-weekly-app/SKILL.md`.

---

## Step 5 — Sign-in and the approval queue (optional)

Without this, the console is read-only to everyone except you (you paste a token).
With it, anyone can sign in with GitHub and submit an idea, which lands **pending
your approval** — and you get admin powers without pasting anything.

Admins are decided by **verified GitHub email**, set in
`services/console-auth/wrangler.toml`:

```
ADMIN_EMAILS = "jacobelilevy@gmail.com,jacob@jacoblevy.co.uk"
```

### 5a. Cloudflare (free, no card)

1. Sign up at <https://dash.cloudflare.com/sign-up>.
2. **Workers & Pages** → copy the **Account ID** from the right sidebar.
3. <https://dash.cloudflare.com/profile/api-tokens> → **Create Token** → use the
   **Edit Cloudflare Workers** template → select your account → create, copy.
4. Add both as Actions secrets here:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`

### 5b. A GitHub OAuth app

1. <https://github.com/settings/applications/new>
2. **Application name:** `Factory Console`
   **Homepage URL:** `https://oliverinhalo.github.io/factory-console/`
   **Authorization callback URL:** `https://example.com/auth/callback`
   _(a placeholder — step 5d replaces it with the real Worker URL)_
3. Register, then **Generate a new client secret**.
4. Add as Actions secrets:
   - `GH_OAUTH_CLIENT_ID` — the Client ID
   - `GH_OAUTH_CLIENT_SECRET` — the secret you just generated

### 5c. Deploy the Worker

**Actions → Deploy console auth → Run workflow.** The summary prints the Worker
URL, something like `https://factory-console-auth.<your-subdomain>.workers.dev`.

### 5d. Point things at it

1. Back in the OAuth app, set **Authorization callback URL** to
   `<worker-url>/auth/callback` and save.
2. Add a repository **variable** (not a secret) at
   <https://github.com/oliverinhalo/Claude/settings/variables/actions>:
   - **Name:** `VITE_API_BASE`
   - **Value:** the Worker URL
3. **Actions → Publish app → Run workflow** with slug `factory-console` to rebuild
   the console against it.

Sign-in then appears in the console header, and a **Pending** tab shows up for
admins whenever someone else submits an idea.

> The Worker holds the credential that writes to this repository, so no visitor
> ever handles a token. Admin status comes from a _verified_ email — an unverified
> one proves nothing, since anyone can type any address into their GitHub profile.

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
