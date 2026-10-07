/** The GitHub calls the Worker makes, kept apart from routing so they can be tested. */

const API = 'https://api.github.com';
const UA = { 'User-Agent': 'factory-console-auth', Accept: 'application/vnd.github+json' };

export interface Viewer {
  login: string;
  name: string;
  avatar: string;
  /** The viewer's primary VERIFIED email, lowercased. Empty when they have none. */
  email: string;
}

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { ...UA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { access_token?: string };
  return body.access_token ?? null;
}

export async function readViewer(token: string): Promise<Viewer | null> {
  const headers = { ...UA, Authorization: `Bearer ${token}` };

  const userRes = await fetch(`${API}/user`, { headers });
  if (!userRes.ok) return null;
  const user = (await userRes.json()) as { login: string; name: string | null; avatar_url: string };

  // Admin is decided by email, so only a VERIFIED email may ever count. An
  // unverified address proves nothing — anyone can type someone else's into
  // their GitHub profile.
  let email = '';
  const emailRes = await fetch(`${API}/user/emails`, { headers });
  if (emailRes.ok) {
    const emails = (await emailRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const verified = emails.filter((e) => e.verified);
    email = (verified.find((e) => e.primary) ?? verified[0])?.email?.toLowerCase() ?? '';
  }

  return { login: user.login, name: user.name ?? user.login, avatar: user.avatar_url, email };
}

/** True when any VERIFIED email of the viewer is on the allowlist. */
export async function isAdmin(token: string, allowlist: string[]): Promise<boolean> {
  if (allowlist.length === 0) return false;
  const res = await fetch(`${API}/user/emails`, {
    headers: { ...UA, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const emails = (await res.json()) as Array<{ email: string; verified: boolean }>;
  return emails.some((e) => e.verified && allowlist.includes(e.email.toLowerCase()));
}

export interface IssueRef {
  number: number;
  url: string;
}

export async function createIssue(
  repo: string,
  pat: string,
  title: string,
  body: string,
  labels: string[],
): Promise<IssueRef> {
  const res = await fetch(`${API}/repos/${repo}/issues`, {
    method: 'POST',
    headers: { ...UA, Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, labels }),
  });
  if (!res.ok) throw new Error(`GitHub refused the issue (${res.status})`);
  const issue = (await res.json()) as { number: number; html_url: string };
  return { number: issue.number, url: issue.html_url };
}

export async function addLabel(repo: string, pat: string, issue: number, label: string) {
  await fetch(`${API}/repos/${repo}/issues/${issue}/labels`, {
    method: 'POST',
    headers: { ...UA, Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels: [label] }),
  });
}

export async function removeLabel(repo: string, pat: string, issue: number, label: string) {
  await fetch(`${API}/repos/${repo}/issues/${issue}/labels/${encodeURIComponent(label)}`, {
    method: 'DELETE',
    headers: { ...UA, Authorization: `Bearer ${pat}` },
  });
}

export async function comment(repo: string, pat: string, issue: number, body: string) {
  await fetch(`${API}/repos/${repo}/issues/${issue}/comments`, {
    method: 'POST',
    headers: { ...UA, Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

export async function closeIssue(repo: string, pat: string, issue: number) {
  await fetch(`${API}/repos/${repo}/issues/${issue}`, {
    method: 'PATCH',
    headers: { ...UA, Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }),
  });
}
