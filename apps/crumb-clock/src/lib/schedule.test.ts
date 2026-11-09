import { describe, expect, it } from 'vitest';
import {
  MINUTE,
  buildSchedule,
  defaultReadyAt,
  earliestReady,
  formatDuration,
  fromLocalInput,
  isFeasible,
  tempFactor,
  toLocalInput,
  totalMinutes,
} from './schedule';

const readyAt = new Date(2026, 5, 6, 18, 30).getTime();

describe('tempFactor', () => {
  it('is 1 at 24 °C, halves at 32 °C, doubles at 16 °C', () => {
    expect(tempFactor(24)).toBe(1);
    expect(tempFactor(32)).toBeCloseTo(0.5);
    expect(tempFactor(16)).toBeCloseTo(2);
  });
  it('clamps absurd temperatures', () => {
    expect(tempFactor(-40)).toBe(tempFactor(15));
    expect(tempFactor(90)).toBe(tempFactor(32));
  });
});

describe('buildSchedule', () => {
  it('ends exactly at the ready time and has no gaps or overlaps', () => {
    const steps = buildSchedule({ readyAt, method: 'same-day', roomTemp: 22 });
    const last = steps[steps.length - 1];
    if (!last) throw new Error('empty');
    expect(last.at + last.minutes * MINUTE).toBe(readyAt);
    for (let i = 1; i < steps.length; i++) {
      const [prev, cur] = [steps[i - 1], steps[i]];
      expect(cur?.at).toBe((prev?.at ?? 0) + (prev?.minutes ?? 0) * MINUTE);
    }
  });
  it('takes longer in a cold kitchen', () => {
    const cold = totalMinutes(buildSchedule({ readyAt, method: 'same-day', roomTemp: 17 }));
    const warm = totalMinutes(buildSchedule({ readyAt, method: 'same-day', roomTemp: 28 }));
    expect(cold).toBeGreaterThan(warm);
  });
  it('overnight includes a 12 hour cold proof', () => {
    const steps = buildSchedule({ readyAt, method: 'overnight', roomTemp: 22 });
    expect(steps.find((s) => s.id === 'proof')?.minutes).toBe(720);
  });
  it('flags a step that starts at 3am but not the fridge proof', () => {
    const at3 = new Date(2026, 5, 6, 3, 0).getTime();
    const steps = buildSchedule({
      readyAt: at3 + 60 * MINUTE + 45 * MINUTE + 45 * MINUTE,
      method: 'overnight',
      roomTemp: 22,
    });
    expect(steps.find((s) => s.id === 'proof')?.antisocial).toBe(false);
    expect(steps.some((s) => s.antisocial)).toBe(true);
  });
});

describe('feasibility', () => {
  it('rejects a ready time that needs the first step in the past', () => {
    const now = readyAt - 60 * MINUTE;
    expect(isFeasible({ readyAt, method: 'same-day', roomTemp: 22 }, now)).toBe(false);
  });
  it('accepts the earliest ready time', () => {
    const now = readyAt;
    const e = earliestReady(now, 'same-day', 22);
    expect(isFeasible({ readyAt: e, method: 'same-day', roomTemp: 22 }, now)).toBe(true);
  });
  it('defaultReadyAt is feasible and wakes nobody', () => {
    const d = defaultReadyAt(readyAt, 'overnight', 20);
    expect(
      buildSchedule({ readyAt: d, method: 'overnight', roomTemp: 20 }).some(
        (s) => s.antisocial,
      ),
    ).toBe(false);
    expect(isFeasible({ readyAt: d, method: 'overnight', roomTemp: 20 }, readyAt)).toBe(true);
  });
});

describe('local input helpers', () => {
  it('round-trips', () => {
    expect(fromLocalInput(toLocalInput(readyAt))).toBe(readyAt);
  });
  it('rejects garbage and impossible dates', () => {
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('tomorrow')).toBeNull();
    expect(fromLocalInput('2026-02-31T10:00')).toBeNull();
  });
  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(135)).toBe('2 h 15 min');
  });
});
