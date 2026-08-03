// 将 YYYY-MM-DD 解析为本地时间中午，避免时区导致日期偏移
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function today(): string {
  // 使用本地时间，不用UTC（toISOString在UTC+8凌晨会返回前一天）
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getYearMonth(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function formatDate(date: string): string {
  const d = parseLocalDate(date);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatDateShort(date: string): string {
  const d = parseLocalDate(date);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function getDayOfWeek(date: string): string {
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  return days[parseLocalDate(date).getDay()];
}

export function isWeekend(date: string): boolean {
  const d = parseLocalDate(date);
  return d.getDay() === 0 || d.getDay() === 6;
}

export function daysInCurrentMonth(): number {
  const now = new Date();
  return getDaysInMonth(now.getFullYear(), now.getMonth() + 1);
}

export function daysRemainingInMonth(): number {
  const now = new Date();
  const total = getDaysInMonth(now.getFullYear(), now.getMonth() + 1);
  return total - now.getDate();
}

export function getMonthDateRange(year: number, month: number): string[] {
  const days = getDaysInMonth(year, month);
  const result: string[] = [];
  for (let d = 1; d <= days; d++) {
    result.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return result;
}

export function getLastNDays(n: number): string[] {
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    result.push(`${y}-${m}-${day}`);
  }
  return result;
}

export function getCurrentMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function getPreviousMonth(): { year: number; month: number } {
  const now = new Date();
  const m = now.getMonth();
  if (m === 0) {
    return { year: now.getFullYear() - 1, month: 12 };
  }
  return { year: now.getFullYear(), month: m };
}

// ISO week number
export function getWeekNumber(date: Date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Get week range (Monday - Sunday)
export function getWeekRange(date: Date = new Date()): { start: string; end: string; days: string[] } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (dt: Date) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(fmt(day));
  }

  return {
    start: fmt(monday),
    end: fmt(sunday),
    days,
  };
}

// Get previous week range
export function getPreviousWeekRange(): { start: string; end: string; days: string[] } {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return getWeekRange(d);
}

// Shift rotation: 5 shifts, rotate weekly
import type { ShiftType, ShiftInfo } from "@/types";
import { SHIFT_DEFINITIONS } from "@/types";

export function getCurrentShift(shiftStartDate: string): ShiftInfo {
  const start = new Date(shiftStartDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  const index = ((diffWeeks % 5) + 5) % 5; // handle negative
  return SHIFT_DEFINITIONS[index];
}

export function getShiftForWeek(shiftStartDate: string, weekOffset: number): ShiftInfo {
  const start = new Date(shiftStartDate);
  const targetWeek = new Date(start);
  targetWeek.setDate(start.getDate() + weekOffset * 7);
  const diffMs = targetWeek.getTime() - start.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  const index = ((diffWeeks % 5) + 5) % 5;
  return SHIFT_DEFINITIONS[index];
}