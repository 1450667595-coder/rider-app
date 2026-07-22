import { DailyRecord, PredictionResult, Weather } from "@/types";
import { today, isWeekend, daysRemainingInMonth } from "./date";

export function getWeatherFactor(weather: Weather): number {
  const factors: Record<Weather, number> = {
    sunny: 1.0,
    cloudy: 0.95,
    rainy: 0.8,
    snowy: 0.6,
    windy: 0.9,
  };
  return factors[weather];
}

export function getWeekdayFactor(date: string): number {
  return isWeekend(date) ? 1.0 : 1.1;
}

export function predictTomorrow(
  records: Record<string, DailyRecord>,
  weather: Weather
): PredictionResult {
  const todayStr = today();
  const tomorrow = new Date(todayStr);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const recordValues = Object.values(records);
  if (recordValues.length < 3) {
    return {
      predictedOrders: Math.round(recordValues.reduce((s, r) => s + r.orders, 0) / Math.max(1, recordValues.length)),
      confidence: "low",
      factors: [{ label: "数据不足", impact: "置信度较低" }],
    };
  }

  const sorted = [...recordValues].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // 近7日均值
  const last7 = sorted.filter((r) => {
    const diff = (new Date(todayStr).getTime() - new Date(r.date).getTime()) / 86400000;
    return diff >= 0 && diff < 7;
  });
  const avg7 = last7.length > 0 ? last7.reduce((s, r) => s + r.orders, 0) / last7.length : 0;

  // 近30日均值
  const last30 = sorted.filter((r) => {
    const diff = (new Date(todayStr).getTime() - new Date(r.date).getTime()) / 86400000;
    return diff >= 0 && diff < 30;
  });
  const avg30 = last30.length > 0 ? last30.reduce((s, r) => s + r.orders, 0) / last30.length : 0;

  // 上周同日
  const lastWeekSameDay = new Date(todayStr);
  lastWeekSameDay.setDate(lastWeekSameDay.getDate() - 6);
  const lastWeekStr = lastWeekSameDay.toISOString().slice(0, 10);
  const lastWeekRecord = records[lastWeekStr];
  const lastWeekOrders = lastWeekRecord ? lastWeekRecord.orders : avg7;

  // 加权预测
  let predicted = avg7 * 0.5 + avg30 * 0.3 + lastWeekOrders * 0.2;
  predicted *= getWeekdayFactor(tomorrowStr);
  predicted *= getWeatherFactor(weather);

  // 置信度
  const dataPoints = last30.length;
  let confidence: PredictionResult["confidence"] = "low";
  if (dataPoints >= 20) confidence = "high";
  else if (dataPoints >= 7) confidence = "medium";

  const factors: { label: string; impact: string }[] = [
    { label: "星期", impact: isWeekend(tomorrowStr) ? "周末（单量可能略低）" : "工作日（单量较高）" },
    { label: "天气", impact: weather === "sunny" ? "晴天（正常）" : `${weather}（可能影响单量）` },
    { label: "近7日均值", impact: `${Math.round(avg7)} 单` },
    { label: "数据量", impact: `${dataPoints} 天数据` },
  ];

  return {
    predictedOrders: Math.round(predicted),
    confidence,
    factors,
  };
}

export function predictMonthlyTotal(
  records: Record<string, DailyRecord>,
  settings: { monthlyGoal: number; workDaysPerWeek: number }
): { predicted: number; completed: number; dailyNeeded: number } {
  const { year, month } = (() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  })();

  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthRecords = Object.values(records).filter((r) => r.date.startsWith(prefix));
  const completed = monthRecords.reduce((s, r) => s + r.orders, 0);

  const workDaysRemaining = Math.round(daysRemainingInMonth() * (settings.workDaysPerWeek / 7));

  const avgDaily = monthRecords.length > 0
    ? monthRecords.reduce((s, r) => s + r.orders, 0) / monthRecords.length
    : settings.monthlyGoal / 30;

  const predicted = Math.round(completed + avgDaily * workDaysRemaining);

  const dailyNeeded = workDaysRemaining > 0
    ? Math.round((settings.monthlyGoal - completed) / workDaysRemaining)
    : 0;

  return { predicted, completed, dailyNeeded };
}

export function predictIncome(
  totalPredicted: number,
  pricePerOrder: number
): number {
  return Math.round(totalPredicted * pricePerOrder);
}