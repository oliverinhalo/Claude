/**
 * Stateless sessions, signed with HMAC-SHA256.
 *
 * Deliberately not a cookie. The console is served from github.io and this Worker
 * from workers.dev, so a session cookie would be third-party and silently dropped
 * by Safari and by Firefox's default settings. The token is handed back in the
 * redirect fragment instead — fragments are never sent to a server, so it does not
 * land in logs — and the console sends it as a bearer token.
 */

export interface Session {
  login: string;
  name: string;
  avatar: string;
  email: string;
  admin: boolean;
  /** Expiry, seconds since the epoch. */
  exp: number;
}

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** Constant-time comparison, so a bad signature leaks nothing by timing. */
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

export async function sign(payload: object, secret: string): Promise<string> {
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const mac = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(mac))}`;
}

/** Returns the payload only if the signature is valid and it has not expired. */
export async function verify<T extends { exp: number }>(
  token: string,
  secret: string,
): Promise<T | null> {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);

  let expected: Uint8Array;
  try {
    expected = new Uint8Array(
      await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(body)),
    );
  } catch {
    return null;
  }

  let provided: Uint8Array;
  try {
    provided = b64urlDecode(mac);
  } catch {
    return null;
  }
  if (!equal(expected, provided)) return null;

  let parsed: T;
  try {
    parsed = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as T;
  } catch {
    return null;
  }
  if (typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return parsed;
}

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
