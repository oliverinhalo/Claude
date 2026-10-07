/**
 * Factory Console auth and submission backend.
 *
 * Why this exists: the console is a static page, so it has nowhere safe to keep a
 * credential that can write to the factory repository, and no way to verify who a
 * visitor is. This Worker does both. It holds the PAT, so no visitor ever handles
 * one, and it decides admin status from the viewer's *verified* GitHub email.
 *
 * Everyone signed in may submit an idea. Only an admin's idea is `approved`
 * immediately; everyone else's is filed `pending-approval`, and the factory is
 * instructed never to build those. Only an admin can approve or reject.
 */
import { SESSION_TTL_SECONDS, sign, verify, type Session } from './session';
import {
  addLabel,
  closeIssue,
  comment,
  createIssue,
  exchangeCode,
  isAdmin,
  readViewer,
  removeLabel,
} from './github';

interface Env {
  ADMIN_EMAILS: string;
  CONSOLE_ORIGIN: string;
  CONSOLE_PATH: string;
  FACTORY_REPO: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  FACTORY_GH_TOKEN: string;
}

interface StatePayload {
  nonce: string;
  exp: number;
}

const json = (body: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.CONSOLE_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const admins = (env: Env) =>
  env.ADMIN_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

async function sessionFrom(request: Request, env: Env): Promise<Session | null> {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  return verify<Session>(token, env.SESSION_SECRET);
}

/** Read and bound a JSON body; a missing or oversized body is a 400, not a crash. */
async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > 32_000) return null;
  try {
    const body = (await request.json()) as unknown;
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const str = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // ── sign in ──────────────────────────────────────────────────────────────
    if (url.pathname === '/auth/login') {
      // The state is signed rather than stored: no KV, no cookie, and a forged or
      // replayed state fails verification.
      const state = await sign(
        { nonce: crypto.randomUUID(), exp: Math.floor(Date.now() / 1000) + 600 } satisfies StatePayload,
        env.SESSION_SECRET,
      );
      const authorize = new URL('https://github.com/login/oauth/authorize');
      authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      authorize.searchParams.set('redirect_uri', `${url.origin}/auth/callback`);
      authorize.searchParams.set('scope', 'read:user user:email');
      authorize.searchParams.set('state', state);
      return Response.redirect(authorize.toString(), 302);
    }

    if (url.pathname === '/auth/callback') {
      const code = url.searchParams.get('code') ?? '';
      const state = url.searchParams.get('state') ?? '';
      const back = `${env.CONSOLE_ORIGIN}${env.CONSOLE_PATH}`;

      if (!code || !(await verify<StatePayload>(state, env.SESSION_SECRET))) {
        return Response.redirect(`${back}#error=${encodeURIComponent('Sign-in expired. Try again.')}`, 302);
      }

      const accessToken = await exchangeCode(code, env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET);
      if (!accessToken) {
        return Response.redirect(`${back}#error=${encodeURIComponent('GitHub rejected the sign-in.')}`, 302);
      }

      const viewer = await readViewer(accessToken);
      if (!viewer) {
        return Response.redirect(`${back}#error=${encodeURIComponent('Could not read your GitHub account.')}`, 302);
      }

      const admin = await isAdmin(accessToken, admins(env));
      const session = await sign(
        { ...viewer, admin, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS } satisfies Session,
        env.SESSION_SECRET,
      );
      // In the fragment, not the query: fragments are not sent to servers, so the
      // session never appears in an access log or a Referer header.
      return Response.redirect(`${back}#session=${session}`, 302);
    }

    if (url.pathname === '/auth/me') {
      const session = await sessionFrom(request, env);
      if (!session) return json({ error: 'not signed in' }, 401, cors);
      const { login, name, avatar, email, admin } = session;
      return json({ login, name, avatar, email, admin }, 200, cors);
    }

    // ── submit ───────────────────────────────────────────────────────────────
    if (url.pathname === '/api/ideas' && request.method === 'POST') {
      const session = await sessionFrom(request, env);
      if (!session) return json({ error: 'Sign in to submit an idea.' }, 401, cors);

      const body = await readBody(request);
      const name = str(body?.name, 120);
      const detail = str(body?.detail, 4000);
      if (!name) return json({ error: 'An idea needs a name.' }, 400, cors);

      const labels = session.admin ? ['idea', 'approved'] : ['idea', 'pending-approval'];
      const provenance = session.admin
        ? `Submitted by an admin (@${session.login}), so it is approved already.`
        : `Submitted by @${session.login} — **awaiting approval**. The factory will not build this until an admin approves it.`;

      try {
        const issue = await createIssue(
          env.FACTORY_REPO,
          env.FACTORY_GH_TOKEN,
          name,
          `${detail || '_No further detail given._'}\n\n---\n${provenance}\n\nFiled from the Factory Console.`,
          labels,
        );
        return json({ number: issue.number, url: issue.url, approved: session.admin }, 201, cors);
      } catch {
        return json({ error: 'GitHub refused that. Try again shortly.' }, 502, cors);
      }
    }

    if (url.pathname === '/api/requests' && request.method === 'POST') {
      const session = await sessionFrom(request, env);
      if (!session) return json({ error: 'Sign in first.' }, 401, cors);
      // An instruction steers the whole factory, so it is admin-only — unlike an
      // idea, there is no useful "pending" state for it.
      if (!session.admin) {
        return json({ error: 'Only an admin can send instructions to the factory.' }, 403, cors);
      }

      const body = await readBody(request);
      const text = str(body?.text, 8000);
      if (!text) return json({ error: 'Write the instruction first.' }, 400, cors);

      try {
        const issue = await createIssue(
          env.FACTORY_REPO,
          env.FACTORY_GH_TOKEN,
          (text.split('\n')[0] ?? text).slice(0, 100),
          `${text}\n\n---\nSent from the Factory Console by @${session.login}. The next run reads open \`request\` issues before anything else.`,
          ['request'],
        );
        return json({ number: issue.number, url: issue.url }, 201, cors);
      } catch {
        return json({ error: 'GitHub refused that. Try again shortly.' }, 502, cors);
      }
    }

    // ── approve or reject ────────────────────────────────────────────────────
    const decision = /^\/api\/ideas\/(\d+)\/(approve|reject)$/.exec(url.pathname);
    if (decision && request.method === 'POST') {
      const session = await sessionFrom(request, env);
      if (!session) return json({ error: 'Sign in first.' }, 401, cors);
      if (!session.admin) return json({ error: 'Only an admin can decide this.' }, 403, cors);

      const issue = Number(decision[1]);
      const repo = env.FACTORY_REPO;
      const pat = env.FACTORY_GH_TOKEN;

      if (decision[2] === 'approve') {
        await addLabel(repo, pat, issue, 'approved');
        await removeLabel(repo, pat, issue, 'pending-approval');
        await comment(repo, pat, issue, `Approved by @${session.login}. The factory may build this.`);
        return json({ ok: true, approved: true }, 200, cors);
      }

      const note = str((await readBody(request))?.reason, 500);
      await removeLabel(repo, pat, issue, 'pending-approval');
      await comment(
        repo,
        pat,
        issue,
        `Not taken forward by @${session.login}.${note ? `\n\n> ${note}` : ''}`,
      );
      await closeIssue(repo, pat, issue);
      return json({ ok: true, approved: false }, 200, cors);
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'factory-console-auth', repo: env.FACTORY_REPO }, 200, cors);
    }

    return json({ error: 'Not found' }, 404, cors);
  },
};
