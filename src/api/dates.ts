import { toDateParam } from './espn';

/** Local midnight. Grouping and labelling are local, matching kickoff times. */
export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const dayOffset = (date: Date, today: Date) =>
  Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / 86_400_000);

const RELATIVE: Record<number, string> = {
  [-1]: 'Yesterday',
  0: 'Today',
  1: 'Tomorrow',
};

/**
 * Yesterday and tomorrow read better than a date, and are what every other
 * scores app shows. Anything further out gets a short date.
 */
export const describeDay = (date: Date, today: Date = new Date()): string =>
  RELATIVE[dayOffset(date, today)] ??
  date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** Same labels, but without the month, for the strip where space is tight. */
export const describeDayShort = (date: Date, today: Date = new Date()): string =>
  RELATIVE[dayOffset(date, today)] ??
  date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });

/** A date input needs YYYY-MM-DD, which is not what ESPN takes. */
export const toInputValue = (date: Date): string => {
  const param = toDateParam(date);
  return `${param.slice(0, 4)}-${param.slice(4, 6)}-${param.slice(6)}`;
};

export const fromInputValue = (value: string): Date | undefined => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};

export const isSameDay = (a: Date, b: Date) =>
  startOfDay(a).getTime() === startOfDay(b).getTime();

export const isBeforeToday = (date: Date, today: Date = new Date()) =>
  startOfDay(date).getTime() < startOfDay(today).getTime();

/** The viewer's timezone, shown so kickoff times are unambiguous. */
export const timeZoneLabel = (): string => {
  try {
    const name = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value;
    return name ?? '';
  } catch {
    return '';
  }
};
