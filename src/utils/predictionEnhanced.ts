import { DailyRecord, PredictionResult, Weather } from "@/types";
import { today, isWeekend, daysRemainingInMonth } from "./date";

// Weather impact factors derived from real data patterns
function getWeatherImpact(weather: Weather): number {
  const impacts: Record<Weather, number> = {
    sunny: 1.0,
    cloudy: 0.93,
    rainy: 0.72,
    snowy: 0.55,
    windy: 0.85,
  };
  return impacts[weather];
}

// Get day-of-week factor from historical data
function getDayOfWeekFactor(
  records: Record<string, DailyRecord>,
  targetDayOfWeek: number
): number {
  const allRecords = Object.values(records);
  const sameDayRecords = allRecords.filter(
    (r) => new Date(r.date).getDay() === targetDayOfWeek
  );

  if (sameDayRecords.length < 3) {
    // Fall back to generic weekend/weekday factor
    return targetDayOfWeek === 0 || targetDayOfWeek === 6 ? 0.95 : 1.05;
  }

  const sameDayAvg = sameDayRecords.reduce((s, r) => s + r.orders, 0) / sameDayRecords.length;
  const allAvg = allRecords.reduce((s, r) => s + r.orders, 0) / allRecords.length;

  return sameDayAvg / allAvg;
}

// Exponential smoothing for trend
function exponentialSmoothing(values: number[], alpha: number): number {
  if (values.length === 0) return 0;
  let smoothed = values[0];
  for (let i = 1; i < values.length; i++) {
    smoothed = alpha * values[i] + (1 - alpha) * smoothed;
  }
  return smoothed;
}

// Simple linear regression for trend
function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function predictTomorrowEnhanced(
  records: Record<string, DailyRecord>,
  weather: Weather
): PredictionResult {
  const todayStr = today();
  const tomorrow = new Date(todayStr);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const tomorrowDayOfWeek = tomorrow.getDay();

  const recordValues = Object.values(records).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (recordValues.length < 3) {
    return {
      predictedOrders: Math.round(
        recordValues.reduce((s, r) => s + r.orders, 0) / Math.max(1, recordValues.length)
      ),
      confidence: "low",
      factors: [{ label: "数据不足", impact: "需要至少 3 天数据才能预测" }],
    };
  }

  const sorted = [...recordValues].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // 1. Recent trend (last 7 days) with exponential smoothing
  const last7Days = sorted.filter((r) => {
    const diff = (new Date(todayStr).getTime() - new Date(r.date).getTime()) / 86400000;
    return diff >= 0 && diff < 7;
  });
  const last7Orders = last7Days.map((r) => r.orders).reverse();
  const smoothed7 = exponentialSmoothing(last7Orders, 0.4);

  // 2. Last 14 days moving average
  const last14Days = sorted.filter((r) => {
    const diff = (new Date(todayStr).getTime() - new Date(r.date).getTime()) / 86400000;
    return diff >= 0 && diff < 14;
  });
  const avg14 = last14Days.length > 0
    ? last14Days.reduce((s, r) => s + r.orders, 0) / last14Days.length
    : smoothed7;

  // 3. Last 30 days moving average
  const last30Days = sorted.filter((r) => {
    const diff = (new Date(todayStr).getTime() - new Date(r.date).getTime()) / 86400000;
    return diff >= 0 && diff < 30;
  });
  const avg30 = last30Days.length > 0
    ? last30Days.reduce((s, r) => s + r.orders, 0) / last30Days.length
    : avg14;

  // 4. Linear regression trend
  const recentOrders = last14Days.map((r) => r.orders).reverse();
  const { slope } = linearRegression(recentOrders);
  const trendAdjustment = slope * 7; // Extrapolate trend

  // 5. Same weekday historical average
  const sameWeekdayRecords = recordValues.filter(
    (r) => new Date(r.date).getDay() === tomorrowDayOfWeek
  );
  const sameWeekdayAvg = sameWeekdayRecords.length > 0
    ? sameWeekdayRecords.reduce((s, r) => s + r.orders, 0) / sameWeekdayRecords.length
    : avg14;

  // 6. Day-of-week factor based on historical data
  const dowFactor = getDayOfWeekFactor(records, tomorrowDayOfWeek);

  // 7. Weather impact
  const weatherImpact = getWeatherImpact(weather);

  // 8. Recent momentum (last 3 days vs last 7 days)
  const last3Days = last7Days.slice(0, 3);
  const avg3 = last3Days.length > 0
    ? last3Days.reduce((s, r) => s + r.orders, 0) / last3Days.length
    : smoothed7;
  const momentum = avg3 / Math.max(1, smoothed7);

  // Weighted ensemble prediction
  const basePrediction =
    smoothed7 * 0.25 +      // Recent smoothed trend
    avg14 * 0.15 +           // 14-day baseline
    avg30 * 0.10 +           // 30-day long-term baseline
    sameWeekdayAvg * 0.20 +  // Same weekday pattern
    (smoothed7 + trendAdjustment) * 0.15; // Trend-extrapolated

  // Apply multipliers
  let predicted = basePrediction * dowFactor * weatherImpact * momentum;

  // Clamp to reasonable bounds
  const maxHistorical = Math.max(...recordValues.map((r) => r.orders));
  predicted = Math.max(0, Math.min(predicted, maxHistorical * 1.3));

  // Confidence calculation
  const dataPoints = last30Days.length;
  const variance = last14Days.length > 1
    ? last14Days.reduce((sum, r) => sum + Math.pow(r.orders - avg14, 2), 0) / last14Days.length
    : 999;
  const cv = Math.sqrt(variance) / Math.max(1, avg14); // Coefficient of variation

  let confidence: PredictionResult["confidence"] = "low";
  if (dataPoints >= 25 && cv < 0.25) confidence = "high";
  else if (dataPoints >= 10 && cv < 0.4) confidence = "medium";

  const factors: { label: string; impact: string }[] = [
    {
      label: "星期模式",
      impact: `${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][tomorrowDayOfWeek]}（${dowFactor > 1 ? "高于" : "低于"}均值 ${Math.abs(Math.round((dowFactor - 1) * 100))}%）`,
    },
    {
      label: "天气影响",
      impact: `${weather}（${weatherImpact < 1 ? "预计减少" : "正常"} ${Math.round(Math.abs(1 - weatherImpact) * 100)}%）`,
    },
    {
      label: "近期趋势",
      impact: slope > 0 ? `📈 上升趋势（+${Math.round(slope)}/天）` : slope < 0 ? `📉 下降趋势（${Math.round(slope)}/天）` : "➡️ 平稳",
    },
    {
      label: "近7日均值",
      impact: `${Math.round(smoothed7)} 单（动量 ${momentum > 1 ? "+" : ""}${Math.round((momentum - 1) * 100)}%）`,
    },
    {
      label: "数据量",
      impact: `${dataPoints} 天（变异系数 ${(cv * 100).toFixed(0)}%）`,
    },
  ];

  return {
    predictedOrders: Math.round(predicted),
    confidence,
    factors,
  };
}

export function predictMonthlyTotalEnhanced(
  records: Record<string, DailyRecord>,
  settings: { monthlyGoal: number; workDaysPerWeek: number }
): {
  predicted: number;
  completed: number;
  dailyNeeded: number;
  lowEstimate: number;
  highEstimate: number;
} {
  const { year, month } = (() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  })();

  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthRecords = Object.values(records)
    .filter((r) => r.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));
  const completed = monthRecords.reduce((s, r) => s + r.orders, 0);

  const workDaysRemaining = Math.round(
    daysRemainingInMonth() * (settings.workDaysPerWeek / 7)
  );

  if (monthRecords.length === 0) {
    const fallback = settings.monthlyGoal;
    return {
      predicted: fallback,
      completed: 0,
      dailyNeeded: Math.round(settings.monthlyGoal / Math.max(1, workDaysRemaining)),
      lowEstimate: Math.round(fallback * 0.8),
      highEstimate: Math.round(fallback * 1.2),
    };
  }

  // Use recent trend for better prediction
  const recentOrders = monthRecords.slice(-7).map((r) => r.orders);
  const baseAvg = recentOrders.reduce((s, o) => s + o, 0) / recentOrders.length;

  // Calculate standard deviation for confidence interval
  const variance = recentOrders.length > 1
    ? recentOrders.reduce((s, o) => s + Math.pow(o - baseAvg, 2), 0) / recentOrders.length
    : baseAvg * 0.1;
  const stdDev = Math.sqrt(variance);

  const predicted = Math.round(completed + baseAvg * workDaysRemaining);
  const lowEstimate = Math.round(completed + Math.max(0, baseAvg - stdDev) * workDaysRemaining);
  const highEstimate = Math.round(completed + (baseAvg + stdDev) * workDaysRemaining);

  const dailyNeeded = workDaysRemaining > 0
    ? Math.round((settings.monthlyGoal - completed) / workDaysRemaining)
    : 0;

  return { predicted, completed, dailyNeeded, lowEstimate, highEstimate };
}

export { predictIncome } from "./prediction";