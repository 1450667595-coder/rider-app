export function today(): string {
  return new Date().toISOString().slice(0, 10);
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
  const d = new Date(date);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatDateShort(date: string): string {
  const d = new Date(date);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function getDayOfWeek(date: string): string {
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  return days[new Date(date).getDay()];
}

export function isWeekend(date: string): boolean {
  const d = new Date(date);
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
    result.push(d.toISOString().slice(0, 10));
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