import { dayMatches, parseCron, timesOfDay, wallMatches, type Schedule } from './cron';
import { describeSchedule } from './describe';
import { clockChanges, offsetAt, wallAt, wallToInstants, type ClockChange } from './zone';

const MINUTE = 60_000;
const DAY = 86_400_000;
const MAX_SEARCH_DAYS = 366 * 8;

export interface Run {
  instant: number;
  /** Wall reading, ms as-if-UTC. */
  wall: number;
  offset: number;
}

/** The next `count` real runs after `now`, ascending. A skipped time yields none; a repeated one yields two. */
export function nextRuns(schedule: Schedule, zone: string, now: number, count: number): Run[] {
  const times = timesOfDay(schedule).sort((a, b) => a - b);
  if (times.length === 0) return [];
  const startDay = Math.floor(wallAt(now, zone) / DAY) * DAY - DAY;
  const runs: Run[] = [];
  for (let i = 0; i < MAX_SEARCH_DAYS && runs.length < count; i++) {
    const dayWall = startDay + i * DAY;
    const d = new Date(dayWall);
    if (!dayMatches(schedule, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()))
      continue;
    const today: Run[] = [];
    for (const t of times) {
      const wall = dayWall + t * MINUTE;
      for (const instant of wallToInstants(wall, zone)) {
        if (instant > now) today.push({ instant, wall, offset: wall - instant });
      }
    }
    today.sort((a, b) => a.instant - b.instant);
    runs.push(...today);
  }
  return runs.slice(0, count);
}

export interface AffectedRun {
  wall: number;
}

export interface ChangeReport {
  change: ClockChange;
  /** Midnight (as wall) of the day the change happens on, in the zone's pre-change clock. */
  dayWall: number;
  /** Scheduled wall readings that fall in the skipped or repeated range. */
  affected: AffectedRun[];
  /** All scheduled wall readings that day, for plotting. */
  dayRuns: number[];
}

export interface Analysis {
  schedule: Schedule;
  description: string;
  runs: Run[];
  changes: ChangeReport[];
  /** Number of clock changes that skip or double at least one run. */
  hazardCount: number;
  /** True when no run was found in the search window. */
  neverRuns: boolean;
}

export type AnalyseResult = { ok: true; analysis: Analysis } | { ok: false; error: string };

export const WINDOW_DAYS = 366;

function report(schedule: Schedule, change: ClockChange): ChangeReport {
  const affected: AffectedRun[] = [];
  const first = Math.ceil(change.from / MINUTE) * MINUTE;
  for (let w = first; w < change.to; w += MINUTE) {
    if (wallMatches(schedule, w)) affected.push({ wall: w });
  }
  const pivot = change.kind === 'skipped' ? change.from : change.to - 1;
  const dayWall = Math.floor(pivot / DAY) * DAY;
  const d = new Date(dayWall);
  const dayRuns = dayMatches(schedule, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
    ? timesOfDay(schedule)
        .sort((a, b) => a - b)
        .map((t) => dayWall + t * MINUTE)
    : [];
  return { change, dayWall, affected, dayRuns };
}

export function analyse(expr: string, zone: string, now: number): AnalyseResult {
  const parsed = parseCron(expr);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { schedule } = parsed;
  const changes = clockChanges(zone, now, now + WINDOW_DAYS * DAY).map((c) =>
    report(schedule, c),
  );
  const runs = nextRuns(schedule, zone, now, 10);
  return {
    ok: true,
    analysis: {
      schedule,
      description: describeSchedule(schedule),
      runs,
      changes,
      hazardCount: changes.filter((c) => c.affected.length > 0).length,
      neverRuns: runs.length === 0,
    },
  };
}

export { offsetAt };
