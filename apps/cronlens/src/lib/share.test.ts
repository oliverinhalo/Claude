import { describe, expect, it } from 'vitest';
import { buildHash, EXAMPLE, initialState, readHash } from './share';

describe('share', () => {
  it('round-trips state through the hash', () => {
    const s = { expr: '*/5 9-17 * * 1-5', zone: 'Europe/London' };
    expect(readHash(buildHash(s))).toEqual(s);
  });
  it('prefers the link over stored state', () => {
    const { state } = initialState('#c=0+0+*+*+*&z=Asia/Tokyo', EXAMPLE);
    expect(state).toEqual({ expr: '0 0 * * *', zone: 'Asia/Tokyo' });
  });
  it('falls back on an unknown zone and says so', () => {
    const { state, notice } = initialState('#z=Mars/Olympus', {
      expr: '1 1 * * *',
      zone: 'UTC',
    });
    expect(state.zone).toBe('UTC');
    expect(notice).toContain('Mars/Olympus');
  });
  it('ignores a stored zone this browser rejects', () => {
    const { state } = initialState('', { expr: '1 1 * * *', zone: 'Nope/Nope' });
    expect(state.zone).not.toBe('Nope/Nope');
  });
  it('ignores absurdly long expressions in the link', () => {
    expect(readHash(`#c=${'9'.repeat(500)}`).expr).toBeUndefined();
  });
});

describe('unknown zone in a link', () => {
  it('uses the browser zone, not the stored one', () => {
    const { state } = initialState('#z=Bad%2FZone', {
      expr: '1 1 * * *',
      zone: 'Pacific/Auckland',
    });
    expect(state.zone).not.toBe('Pacific/Auckland');
    expect(state.zone).not.toBe('Bad/Zone');
  });
});
