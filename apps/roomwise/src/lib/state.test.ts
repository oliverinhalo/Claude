import { beforeEach, describe, expect, it } from 'vitest';
import { decodeHash, encodeState, isState, loadInitial, store } from './state';
import { EXAMPLE } from './split';

beforeEach(() => localStorage.clear());

describe('hash', () => {
  it('round-trips, including non-ASCII names', () => {
    const s = { ...EXAMPLE, rooms: [{ id: 'x', name: 'Zoë’s room 🌿', area: 11, perks: [] }] };
    const r = decodeHash('#' + encodeState(s));
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.state).toEqual(s);
  });
  it('flags garbage and ignores unrelated hashes', () => {
    expect(decodeHash('#s=@@@').status).toBe('bad');
    expect(decodeHash('#s=abcd').status).toBe('bad');
    expect(decodeHash('#about').status).toBe('none');
    expect(decodeHash('').status).toBe('none');
  });
});

describe('validation', () => {
  it('rejects hostile shapes', () => {
    expect(isState(null)).toBe(false);
    expect(isState({ ...EXAMPLE, rent: -1 })).toBe(false);
    expect(isState({ ...EXAMPLE, rooms: Array(13).fill(EXAMPLE.rooms[0]) })).toBe(false);
    expect(isState({ ...EXAMPLE, rooms: [{ id: 1 }] })).toBe(false);
    expect(isState(EXAMPLE)).toBe(true);
  });
});

describe('loadInitial', () => {
  it('uses the example with no notice on first visit', () => {
    const l = loadInitial('');
    expect(l.state).toEqual(EXAMPLE);
    expect(l.notice).toBeNull();
  });
  it('recovers from corrupt storage with a notice', () => {
    localStorage.setItem('roomwise:state', 'garbage');
    expect(loadInitial('').notice).toMatch(/could not be restored/);
  });
  it('recovers from a corrupt hash with a notice', () => {
    expect(loadInitial('#s=abcd').notice).toMatch(/share link/);
  });
  it('prefers a valid hash over storage', () => {
    store.save({ ...EXAMPLE, rent: 5 });
    const l = loadInitial('#' + encodeState({ ...EXAMPLE, rent: 777 }));
    expect(l.state.rent).toBe(777);
  });
  it('loads saved state', () => {
    store.save({ ...EXAMPLE, rent: 5 });
    expect(loadInitial('').state.rent).toBe(5);
  });
});
