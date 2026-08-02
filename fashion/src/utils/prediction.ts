import { DailyRecord, PredictionResult, Weather } from "@/types";
import { today, isWeekend } from "./date";

const WEATHER_BOOST: Record<Weather, number> = {
  sunny: 1.0,
  cloudy: 1.0,
  rainy: 1.25,
  snowy: 1.35,
  windy: 1.1,
};

interface SpecialEvent {
  date: string;
  name: string;
  boost: number;
}

const SPECIAL_EVENTS: SpecialEvent[] = [
  { date: "08-07", name: "秋天第一杯奶茶", boost: 1.6 },
  { date: "02-14", name: "情人节", boost: 1.4 },
  { date: "05-20", name: "520表白日", boost: 1.35 },
  { date: "12-24", name: "平安夜", boost: 1.3 },
  { date: "12-25", name: "圣诞节", boost: 1.25 },
  { date: "01-01", name: "元旦", boost: 1.2 },
  { date: "11-11", name: "双十一", boost: 1.3 },
  { date: "06-18", name: "618购物节", boost: 1.25 },
  { date: "05-01", name: "劳动节", boost: 1.15 },
  { date: "10-01", name: "国庆节", boost: 1.2 },
  { date: "10-02", name: "国庆节", boost: 1.2 },
  { date: "10-03", name: "国庆节", boost: 1.18 },
];

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function getSpecialEvent(dateStr: string): SpecialEvent | null {
  const mmdd = dateStr.slice(5);
  return SPECIAL_EVENTS.find((e) => e.date === mmdd) || null;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function predictTomorrowAI(
  records: Record<string, DailyRecord>,
  weather: Weather
): PredictionResult {
  const values = Object.values(records).filter((r) => r.orders > 0);
  if (values.length < 3) {
    return {
      predictedOrders: 0,
      confidence: "low",
      factors: [{ label: "数据不足", impact: "请至少记录 3 天数据" }],
    };
  }

  const sorted = [...values].sort((a, b) => a.date.localeCompare(b.date));
  const recent30 = sorted.slice(-30);

  const orders = recent30.map((r) => r.orders);
  const a = avg(orders);
  const m = median(orders);
  const robustAvg = (a + m) / 2;

  const tomorrow = new Date(today() + "T00:00:00");
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = fmtDate(tomorrow);
  const tomorrowDOW = tomorrow.getDay();

  const byDow: Record<number, number[]> = {};
  for (const r of recent30) {
    const dow = new Date(r.date + "T00:00:00").getDay();
    if (!byDow[dow]) byDow[dow] = [];
    byDow[dow].push(r.orders);
  }
  const sameDow = byDow[tomorrowDOW] || [];
  const sameDowAvg = sameDow.length > 0 ? avg(sameDow) : robustAvg;

  const basePrediction = sameDow.length >= 2 ? sameDowAvg * 0.6 + robustAvg * 0.4 : robustAvg;

  const weatherFactor = WEATHER_BOOST[weather];
  const event = getSpecialEvent(tomorrowStr);
  const eventFactor = event ? event.boost : 1;

  const predicted = Math.round(basePrediction * weatherFactor * eventFactor);

  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const factors: { label: string; impact: string }[] = [
    { label: `${weekdays[tomorrowDOW]}基准`, impact: `近30天${weekdays[tomorrowDOW]}均 ${Math.round(sameDowAvg)} 单` },
    { label: "稳健日均", impact: `${Math.round(robustAvg)} 单` },
  ];

  if (weatherFactor > 1) {
    factors.push({
      label: `${WEATHER_LABELS[weather]}爆单`,
      impact: `+${Math.round((weatherFactor - 1) * 100)}%`,
    });
  }

  if (event) {
    factors.push({
      label: `🎉 ${event.name}`,
      impact: `+${Math.round((eventFactor - 1) * 100)}%`,
    });
  }

  let confidence: PredictionResult["confidence"] = "low";
  if (values.length >= 20 && sameDow.length >= 3) confidence = "high";
  else if (values.length >= 10) confidence = "medium";

  return {
    predictedOrders: Math.max(1, predicted),
    confidence,
    factors,
  };
}

export function predictMonthly(
  records: Record<string, DailyRecord>,
  goalOrders: number
): { predicted: number; completed: number; dailyNeeded: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayDay = now.getDate();
  const remaining = daysInMonth - todayDay;

  const thisMonth = Object.values(records).filter((r) => {
    const d = new Date(r.date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() + 1 === month && r.orders > 0;
  });

  const completed = thisMonth.reduce((s, r) => s + r.orders, 0);
  const avgDaily = thisMonth.length > 0 ? thisMonth.reduce((s, r) => s + r.orders, 0) / thisMonth.length : 30;
  const predicted = Math.round(completed + avgDaily * remaining);
  const dailyNeeded = remaining > 0 ? Math.round((goalOrders - completed) / remaining) : 0;

  return { predicted, completed, dailyNeeded };
}

import { WEATHER_LABELS } from "@/types";
