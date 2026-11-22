import { CFG } from './base';
import type { Person } from './state';

export const BANK_CAP = 3;
export const CLOCK = {
  minutesPerShichen: 120,
  shichen: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'],
} as const;

export interface DayBank {
  bankedDays: number;
  lastGrantDate: string;
  unlimitedDays: boolean;
}

function monthLengths(year: number): number[] {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
}

// 输入是调用方的当地年月日。闰日和月界按公历计算，完全不涉及时区、毫秒或设备的钟。
export function dateOrdinal(key: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new RangeError('日期须为 YYYY-MM-DD');
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const day = Number(key.slice(8, 10));
  const lengths = monthLengths(year);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > lengths[month - 1]!) {
    throw new RangeError('无效的公历日期');
  }
  const pastYears = year - 1;
  return 365 * pastYears + Math.floor(pastYears / 4) - Math.floor(pastYears / 100)
    + Math.floor(pastYears / 400) + lengths.slice(0, month - 1).reduce((a, b) => a + b, day);
}

export function nextCalendarDate(key: string): string {
  dateOrdinal(key);
  let year = Number(key.slice(0, 4)), month = Number(key.slice(5, 7)), day = Number(key.slice(8)) + 1;
  if (day > monthLengths(year)[month - 1]!) {
    day = 1;
    if (++month > 12) { month = 1; year++; }
  }
  if (year > 9999) throw new RangeError('日期超出公历存档范围');
  return [String(year).padStart(4, '0'), String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}

export function makeDayBank(today: string): DayBank {
  dateOrdinal(today);
  return { bankedDays: BANK_CAP, lastGrantDate: today, unlimitedDays: false };
}

export function accrueDays(bank: DayBank, today: string): boolean {
  const elapsed = dateOrdinal(today) - dateOrdinal(bank.lastGrantDate);
  if (elapsed <= 0) return false;
  bank.bankedDays = Math.min(BANK_CAP, bank.bankedDays + elapsed);
  bank.lastGrantDate = today;
  return true;
}

export function spendDawn(bank: DayBank, today: string): boolean {
  accrueDays(bank, today);
  if (bank.unlimitedDays) return true;
  if (bank.bankedDays === 0) return false;
  bank.bankedDays--;
  return true;
}

// 首日也花一天。只有后一日的清晨才加日龄、回一点体力。
export function startDay(bank: DayBank, person: Person, today: string, dawn: 'first' | 'next'): boolean {
  if (!spendDawn(bank, today)) return false;
  if (dawn === 'next') {
    person.day++;
    person.hp = Math.min(CFG.hpMax, person.hp + 1);
  }
  person.time = CFG.dayStart;
  return true;
}

export function daytime(time: number) {
  const hour = Math.floor(time / 60) % 24;
  const remaining = Math.max(0, CFG.dusk - time);
  return {
    shichen: CLOCK.shichen[Math.floor(((hour + 1) % 24) / 2)] + '时',
    remainingShichen: remaining / CLOCK.minutesPerShichen,
    fraction: Math.max(0, Math.min(1, (time - CFG.dayStart) / (CFG.dusk - CFG.dayStart))),
    dark: time >= CFG.dusk,
  };
}
