import { SERVER } from './config';

const DAY_MS = 86_400_000;

/** 现实里的「今天」：北京时间，早上 5 点换天。不看手机的钟 */
export function realDate(nowMs: number): string {
  const shifted = nowMs + (SERVER.utcOffsetHours - SERVER.dayStartsAtHour) * 3_600_000;
  return new Date(shifted).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('日期须为 YYYY-MM-DD');
  return new Date(Date.parse(date + 'T00:00:00Z') + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY_MS);
}

/** 测试用：北京时间某天几点几分 → 毫秒 */
export function beijing(date: string, hour = 12, minute = 0): number {
  return Date.parse(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`);
}
