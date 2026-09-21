import { DateTime } from "luxon";
import { RuleValidationError } from "../types";

export function parseMonthDay(value: string): { month: number; day: number } {
  const [monthRaw, dayRaw] = value.split("-");
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new RuleValidationError(`Invalid month-day "${value}"`);
  }
  return { month, day };
}

export function clampCivilDay(year: number, month: number, day: number): { year: number; month: number; day: number } {
  if (month === 2 && day === 29 && !DateTime.fromObject({ year }).isInLeapYear) {
    return { year, month: 2, day: 28 };
  }
  return { year, month, day };
}

export function localMidnight(
  year: number,
  month: number,
  day: number,
  timezone: string,
): Date {
  const civil = clampCivilDay(year, month, day);
  const dt = DateTime.fromObject(
    { year: civil.year, month: civil.month, day: civil.day, hour: 0, minute: 0, second: 0 },
    { zone: timezone },
  );
  if (!dt.isValid) {
    throw new RuleValidationError(`Invalid civil date ${year}-${month}-${day} in ${timezone}: ${dt.invalidReason}`);
  }
  return dt.toJSDate();
}

export function addLocalDays(start: Date, timezone: string, days: number): Date {
  const dt = DateTime.fromJSDate(start, { zone: timezone }).plus({ days });
  if (!dt.isValid) {
    throw new RuleValidationError(`Invalid date offset in ${timezone}`);
  }
  return dt.toJSDate();
}

export function parseCivilOrInstant(value: string, timezone: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number) as [number, number, number];
    return localMidnight(y, m, d, timezone);
  }
  const dt = DateTime.fromISO(value, { zone: timezone, setZone: true });
  if (!dt.isValid) {
    const utc = DateTime.fromISO(value, { zone: "utc" });
    if (!utc.isValid) {
      throw new RuleValidationError(`Invalid datetime "${value}"`);
    }
    return utc.toJSDate();
  }
  return dt.toJSDate();
}

export function yearOf(date: Date, timezone: string): number {
  return DateTime.fromJSDate(date, { zone: timezone }).year;
}

export function isoDateOf(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: timezone }).toFormat("yyyy-MM-dd");
}
