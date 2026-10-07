import { describe, expect, it } from 'vitest';
import { sign, verify } from './session';

const SECRET = 'a-test-signing-key-long-enough-to-be-realistic';
const future = () => Math.floor(Date.now() / 1000) + 3600;

describe('session tokens', () => {
  it('round-trips a payload', async () => {
    const token = await sign({ login: 'jacob', admin: true, exp: future() }, SECRET);
    const out = await verify<{ login: string; admin: boolean; exp: number }>(token, SECRET);
    expect(out?.login).toBe('jacob');
    expect(out?.admin).toBe(true);
  });

  it('rejects a token signed with a different key', async () => {
    const token = await sign({ exp: future() }, SECRET);
    expect(await verify(token, 'some-other-key')).toBeNull();
  });

  it('rejects a tampered payload — the whole point of signing', async () => {
    const token = await sign({ admin: false, exp: future() }, SECRET);
    const [body, mac] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ admin: true, exp: future() }), 'utf8')
      .toString('base64url');
    expect(body).not.toBe(forged);
    expect(await verify(`${forged}.${mac}`, SECRET)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await sign({ exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
    expect(await verify(token, SECRET)).toBeNull();
  });

  it('rejects a payload with no expiry rather than treating it as eternal', async () => {
    const token = await sign({ login: 'nobody' }, SECRET);
    expect(await verify(token, SECRET)).toBeNull();
  });

  it('rejects malformed input without throwing', async () => {
    for (const bad of ['', '.', 'nodot', 'a.b.c.d', 'üñî.çø∂é', 'eyJ9.!!!!']) {
      expect(await verify(bad, SECRET)).toBeNull();
    }
  });

  it('survives a payload containing non-ASCII', async () => {
    const token = await sign({ name: 'Jacob — Lévy 🏭', exp: future() }, SECRET);
    const out = await verify<{ name: string; exp: number }>(token, SECRET);
    expect(out?.name).toBe('Jacob — Lévy 🏭');
  });

  it('produces a different signature for a different payload', async () => {
    const a = await sign({ admin: false, exp: 2_000_000_000 }, SECRET);
    const b = await sign({ admin: true, exp: 2_000_000_000 }, SECRET);
    expect(a.split('.')[1]).not.toBe(b.split('.')[1]);
  });
});
