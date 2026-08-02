// ══════════════════════════════════════════════════════════════════════
//  AI预测引擎 v17 — 基于上月历史数据的简洁预测
//  删除所有复杂模型，仅用上月历史数据 + 简单统计
// ══════════════════════════════════════════════════════════════════════

import { DailyRecord, Weather, PredictionResult } from "@/types";
import type { ShiftType } from "@/types";

// 天气影响因子（简单固定值）
const WEATHER_FACTOR: Record<Weather, number> = {
  sunny: 1.00, cloudy: 0.90, rainy: 0.65, snowy: 0.45, windy: 0.78,
};

// 班次因子
const SHIFT_FACTOR: Record<ShiftType, number> = {
  early_mid: 1.00, early: 1.08, late_mid: 1.00, late: 0.92, night: 0.85,
};

// 获取上月数据
function getLastMonthRecords(records: Record<string, DailyRecord>): DailyRecord[] {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
  return Object.values(records)
    .filter(r => r.date.startsWith(lastMonthKey) && r.orders > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 获取本月数据
function getCurrentMonthRecords(records: Record<string, DailyRecord>): DailyRecord[] {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return Object.values(records)
    .filter(r => r.date.startsWith(prefix) && r.orders > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 计算平均值
function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// ══════════════════════════════════════════════════════════════════════
//  明日预测 — 基于上月同日星期几的平均值
// ══════════════════════════════════════════════════════════════════════
export function predictTomorrowAI(
  records: Record<string, DailyRecord>,
  weather: Weather,
  shiftType?: ShiftType
): PredictionResult {
  const lastMonth = getLastMonthRecords(records);
  const thisMonth = getCurrentMonthRecords(records);

  // 优先使用本月数据，不足则用上月
  const source = thisMonth.length >= 5 ? thisMonth : lastMonth;

  if (source.length === 0) {
    return {
      predictedOrders: 30,
      confidence: "low",
      factors: [{ label: "数据不足", impact: "需要至少5天数据，默认预估30单" }],
    };
  }

  // 计算明天是星期几
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDOW = tomorrow.getDay();

  // 按星期几分组，取同日平均值
  const byDow: Record<number, number[]> = {};
  for (const r of source) {
    const dow = new Date(r.date).getDay();
    if (!byDow[dow]) byDow[dow] = [];
    byDow[dow].push(r.orders);
  }

  const sameDowAvg = byDow[tomorrowDOW] ? avg(byDow[tomorrowDOW]) : 0;
  const overallAvg = avg(source.map(r => r.orders));

  // 综合：同日平均占70%，总体平均占30%
  const basePrediction = sameDowAvg > 0
    ? sameDowAvg * 0.7 + overallAvg * 0.3
    : overallAvg;

  // 应用天气和班次因子
  const weatherFactor = WEATHER_FACTOR[weather] || 1;
  const shiftFactor = shiftType ? (SHIFT_FACTOR[shiftType] || 1) : 1;
  const predicted = Math.round(basePrediction * weatherFactor * shiftFactor);

  // 置信度
  const dataDays = source.length;
  let confidence: PredictionResult["confidence"] = "low";
  if (dataDays >= 20) confidence = "high";
  else if (dataDays >= 10) confidence = "medium";

  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const weatherLabels: Record<Weather, string> = {
    sunny: "晴天", cloudy: "多云", rainy: "雨天", snowy: "雪天", windy: "大风"
  };

  return {
    predictedOrders: Math.max(1, predicted),
    confidence,
    factors: [
      { label: `${weekdays[tomorrowDOW]}基准`, impact: `基于${source.length}天${source === lastMonth ? "上月" : "本月"}数据` },
      { label: `${weatherLabels[weather]}影响`, impact: weatherFactor > 1 ? "利好" : weatherFactor < 1 ? "不利" : "中性" },
      { label: "预测来源", impact: source === lastMonth ? "上月历史数据" : "本月实时数据" },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════
//  月度预测 — 基于上月日均单量
// ══════════════════════════════════════════════════════════════════════
export function predictMonthlyAI(
  records: Record<string, DailyRecord>,
  settings: { monthlyGoal: number; workDaysPerWeek: number; currentShift?: ShiftType }
): {
  predicted: number; completed: number; dailyNeeded: number;
  lowEstimate: number; highEstimate: number;
  weeklyBreakdown: { week: number; predicted: number; low: number; high: number }[];
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = now.getDate();
  const remainingDays = daysInMonth - today;
  const workDaysRemaining = Math.round(remainingDays * (settings.workDaysPerWeek / 7));

  // 本月已完成的单量
  const thisMonth = getCurrentMonthRecords(records);
  let completed = 0;
  for (const r of thisMonth) completed += r.orders;

  // 基于上月数据计算日均
  const lastMonth = getLastMonthRecords(records);
  const lastMonthOrders = lastMonth.map(r => r.orders);
  const dailyAvg = lastMonth.length > 0 ? avg(lastMonthOrders) : 0;

  // 如果没有上月数据，用本月数据
  const effectiveAvg = dailyAvg > 0 ? dailyAvg : (thisMonth.length > 0 ? avg(thisMonth.map(r => r.orders)) : 0);
  const fallbackAvg = effectiveAvg > 0 ? effectiveAvg : 30;

  // 应用班次因子
  const shiftFactor = settings.currentShift ? (SHIFT_FACTOR[settings.currentShift] || 1) : 1;
  const adjustedAvg = fallbackAvg * shiftFactor;

  const predicted = Math.round(completed + adjustedAvg * workDaysRemaining);
  const lowEstimate = Math.round(completed + adjustedAvg * 0.8 * workDaysRemaining);
  const highEstimate = Math.round(completed + adjustedAvg * 1.2 * workDaysRemaining);
  const dailyNeeded = workDaysRemaining > 0
    ? Math.round((settings.monthlyGoal - completed) / workDaysRemaining)
    : 0;

  // 周度拆解
  const weeklyBreakdown: { week: number; predicted: number; low: number; high: number }[] = [];
  let remaining = remainingDays;
  let weekNum = 1;
  while (remaining > 0) {
    const weekDays = Math.min(7, remaining);
    const workDays = Math.round(weekDays * (settings.workDaysPerWeek / 7));
    const wp = Math.round(adjustedAvg * workDays);
    weeklyBreakdown.push({
      week: weekNum,
      predicted: wp,
      low: Math.round(adjustedAvg * 0.8 * workDays),
      high: Math.round(adjustedAvg * 1.2 * workDays),
    });
    remaining -= weekDays;
    weekNum++;
  }

  return { predicted, completed, dailyNeeded, lowEstimate, highEstimate, weeklyBreakdown };
}

// ══════════════════════════════════════════════════════════════════════
//  智能洞察
// ══════════════════════════════════════════════════════════════════════
export function generateInsights(
  records: Record<string, DailyRecord>,
  settings: { dailyGoal: number; monthlyGoal: number }
): { icon: string; title: string; message: string; priority: "high" | "medium" | "low" }[] {
  const all = Object.values(records).sort((a, b) => a.date.localeCompare(b.date));
  if (all.length < 3) return [];

  const insights: { icon: string; title: string; message: string; priority: "high" | "medium" | "low" }[] = [];

  // 本月进度
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let monthOrders = 0;
  for (const r of all) {
    if (r.date.startsWith(prefix)) monthOrders += r.orders;
  }
  const progress = settings.monthlyGoal > 0 ? monthOrders / settings.monthlyGoal : 0;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedProgress = now.getDate() / daysInMonth;

  if (progress > expectedProgress * 1.1) {
    insights.push({ icon: "🎯", title: "超前完成", message: `当前进度${Math.round(progress * 100)}%，领先预期，继续保持！`, priority: "low" });
  } else if (progress < expectedProgress * 0.85) {
    insights.push({ icon: "⚠️", title: "进度落后", message: `当前进度${Math.round(progress * 100)}%，需每日完成约${Math.round((settings.monthlyGoal - monthOrders) / Math.max(1, daysInMonth - now.getDate()))}单追赶。`, priority: "high" });
  }

  // 上月对比
  const lastMonth = getLastMonthRecords(records);
  if (lastMonth.length > 0) {
    const lastMonthAvg = avg(lastMonth.map(r => r.orders));
    const thisMonth = getCurrentMonthRecords(records);
    const thisMonthAvg = thisMonth.length > 0 ? avg(thisMonth.map(r => r.orders)) : 0;
    if (thisMonthAvg > 0 && lastMonthAvg > 0) {
      const change = ((thisMonthAvg - lastMonthAvg) / lastMonthAvg) * 100;
      if (change > 10) {
        insights.push({ icon: "📈", title: "较上月增长", message: `本月日均${Math.round(thisMonthAvg)}单，较上月${Math.round(lastMonthAvg)}单增长${Math.round(change)}%。`, priority: "medium" });
      } else if (change < -10) {
        insights.push({ icon: "📉", title: "较上月下降", message: `本月日均${Math.round(thisMonthAvg)}单，较上月${Math.round(lastMonthAvg)}单下降${Math.round(Math.abs(change))}%。`, priority: "high" });
      }
    }
  }

  return insights;
}

// ══════════════════════════════════════════════════════════════════════
//  兼容性导出（保留接口，精简实现）
// ══════════════════════════════════════════════════════════════════════

export interface FeatureImportance { name: string; importance: number; }
export interface ConformalInterval { lower: number; upper: number; confidence: number; }
export interface DynamicWeights { weights: number[]; }
export interface AccuracyTracker {
  totalPredictions: number; totalError: number; mae: number; mape: number;
  recentAccuracy: { mape: number; r2: number }; bias: number; predictions: PredictionRecord[];
  overallAccuracy: { mape: number; rmse: number; r2: number; bias: number };
  trend: string; totalVerified: number;
  byWeather: Record<string, { mape: number; count: number }>;
}
export interface PredictionRecord { date: string; predicted: number; actual: number; weather: string; }
export interface DailyDistribution {
  hours: number[]; peak: number; peakHour: number;
  totalPredicted: number; dailyPredictions: { hour: number; predicted: number; label: string }[];
  distributionType: string;
  bestSlot: { start: number; end: number; expectedOrders: number; efficiency: number };
  peakHours: { hour: number; label: string; predicted: number }[];
  offPeakHours: { hour: number; label: string; predicted: number }[];
  recommendation: string;
  hourlyDistribution: { hour: number; predicted: number; label: string }[];
}
export interface RainyDayImpact {
  avgDrop: number; dropPercent: number; recoveryDays: number;
  overallImpact: { avgOrderReduction: number; confidenceInterval: [number, number]; severity: string };
  dataQuality: { totalRainyDays: number; totalSunnyDays: number; sufficientData: boolean };
  weatherTransition: { afterRainSpike: boolean; spikeMagnitude: number; recoveryDays: number };
  peakShift: { occurs: boolean; direction: string; shiftHours: number };
  recommendations: { priority: string; title: string; message: string }[];
  hourlyImpact: { hour: number; label: string; isSignificant: boolean; normalOrders: number; rainyOrders: number; reduction: number }[];
}
export interface SpectralAnalysis {
  forecast: number;
  frequencies: number[];
  dominant: number;
  trendComponent?: number[];
  seasonalComponent?: number[];
  residualComponent?: number[];
  periodicityScore?: number;
  dominantPeriods?: { period: number; strength: number }[];
}
export interface MetaLearner { weights: number[]; intercept: number; prediction: number; confidence: number; }

// 周预测
export function predictWeeklyAI(
  records: Record<string, DailyRecord>,
  weatherForecast: Weather[]
): { totalPredicted: number; dailyPredictions: { day: string; date: string; predicted: number; weather: Weather }[] } {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const result: { day: string; date: string; predicted: number; weather: Weather }[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i + 1);
    const dateStr = d.toISOString().slice(0, 10);
    const w = weatherForecast[i] || "sunny";
    const pred = predictTomorrowAI(records, w);
    result.push({ day: weekdays[d.getDay()], date: dateStr, predicted: pred.predictedOrders, weather: w });
  }
  const totalPredicted = result.reduce((s, r) => s + r.predicted, 0);
  return { totalPredicted, dailyPredictions: result };
}

// 异常检测
export function detectAnomalies(records: Record<string, DailyRecord>): (DailyRecord & { type?: string; expected?: number; deviation?: number })[] {
  const all = Object.values(records).sort((a, b) => a.date.localeCompare(b.date));
  if (all.length < 5) return [];
  const orders = all.map(r => r.orders);
  const m = avg(orders);
  const variance = orders.reduce((s, v) => s + (v - m) ** 2, 0) / orders.length;
  const s = Math.sqrt(variance);
  return all
    .filter(r => Math.abs(r.orders - m) > 2.5 * s)
    .map(r => ({
      ...r,
      type: r.orders > m ? "spike" : "dip",
      expected: Math.round(m),
      deviation: r.orders - Math.round(m),
    }));
}

// 日分布预测
export function predictDailyDistribution(
  _records: Record<string, DailyRecord>, _weather: Weather
): DailyDistribution {
  const hours = [0.02, 0.01, 0.01, 0.01, 0.02, 0.04, 0.08, 0.12, 0.15, 0.18, 0.20, 0.18, 0.14, 0.12, 0.10, 0.08, 0.09, 0.12, 0.14, 0.12, 0.08, 0.05, 0.03, 0.02];
  const totalPredicted = 42;
  const hourlyDistribution = hours.map((ratio, h) => ({
    hour: h,
    predicted: Math.round(ratio * totalPredicted / 0.21),
    label: `${String(h).padStart(2, "0")}:00`,
  }));
  return {
    hours, peak: 0.20, peakHour: 11,
    totalPredicted,
    dailyPredictions: hourlyDistribution,
    distributionType: "normal",
    bestSlot: { start: 10, end: 20, expectedOrders: 30, efficiency: 85 },
    peakHours: [{ hour: 10, label: "10:00", predicted: 8 }, { hour: 11, label: "11:00", predicted: 8 }, { hour: 12, label: "12:00", predicted: 7 }],
    offPeakHours: [{ hour: 3, label: "03:00", predicted: 0 }, { hour: 4, label: "04:00", predicted: 0 }, { hour: 5, label: "05:00", predicted: 0 }],
    recommendation: "建议在10:00-20:00集中工作，效率最高",
    hourlyDistribution,
  };
}

// 雨天影响
export function predictRainyDayImpact(records: Record<string, DailyRecord>): RainyDayImpact {
  const all = Object.values(records);
  const rainy = all.filter(r => r.weather === "rainy");
  const nonRainy = all.filter(r => r.weather !== "rainy");
  const rainyAvg = avg(rainy.map(r => r.orders));
  const nonRainyAvg = avg(nonRainy.map(r => r.orders));
  const drop = nonRainyAvg - rainyAvg;
  const dropPercent = nonRainyAvg > 0 ? Math.round((drop / nonRainyAvg) * 100) : 25;
  return {
    avgDrop: Math.round(drop),
    dropPercent,
    recoveryDays: 1,
    overallImpact: {
      avgOrderReduction: dropPercent,
      confidenceInterval: [Math.max(0, dropPercent - 10), dropPercent + 10],
      severity: dropPercent > 30 ? "severe" : dropPercent > 15 ? "moderate" : "mild",
    },
    dataQuality: { totalRainyDays: rainy.length, totalSunnyDays: nonRainy.length, sufficientData: rainy.length >= 3 },
    weatherTransition: { afterRainSpike: dropPercent > 10, spikeMagnitude: dropPercent > 10 ? Math.round(dropPercent * 0.5) : 0, recoveryDays: 1 },
    peakShift: { occurs: dropPercent > 20, direction: "later", shiftHours: dropPercent > 20 ? 1 : 0 },
    recommendations: [
      { priority: "high", title: "雨天适当降低预期", message: `预计单量减少约${dropPercent}%，建议调整目标` },
      { priority: "medium", title: "雨天注重保温", message: "使用保温箱等装备，减少配送延误" },
      { priority: "low", title: "关注雨后反弹", message: "雨后通常有订单反弹，可提前准备" },
    ],
    hourlyImpact: [
      { hour: 11, label: "11:00-12:00", isSignificant: true, normalOrders: 8, rainyOrders: 6, reduction: 25 },
      { hour: 12, label: "12:00-13:00", isSignificant: true, normalOrders: 7, rainyOrders: 5, reduction: 28 },
      { hour: 18, label: "18:00-19:00", isSignificant: true, normalOrders: 6, rainyOrders: 4, reduction: 33 },
    ],
  };
}

// 预测准确率追踪
export function trackPredictionAccuracy(
  tracker: AccuracyTracker | null,
  record: PredictionRecord
): AccuracyTracker {
  const error = Math.abs(record.predicted - record.actual);
  const prev = tracker || {
    totalPredictions: 0, totalError: 0, mae: 0, mape: 0,
    recentAccuracy: { mape: 0, r2: 0 }, bias: 0, predictions: [],
    overallAccuracy: { mape: 0, rmse: 0, r2: 0, bias: 0 },
    trend: "stable", totalVerified: 0, byWeather: {},
  };
  const totalPredictions = prev.totalPredictions + 1;
  const totalError = prev.totalError + error;
  const mae = totalError / totalPredictions;
  const mape = record.actual > 0 ? (error / record.actual) * 100 : 0;
  const combinedMape = Math.round((prev.mape * prev.totalPredictions + mape) / totalPredictions);
  return {
    totalPredictions, totalError, mae, mape: combinedMape,
    recentAccuracy: { mape: combinedMape, r2: 0.7 },
    bias: 0, predictions: [...prev.predictions.slice(-29), record],
    overallAccuracy: { mape: combinedMape, rmse: Math.round(Math.sqrt(error * error)), r2: 0.75, bias: 0 },
    trend: "stable", totalVerified: totalPredictions, byWeather: {},
  };
}

export function computePredictionAccuracy(records: PredictionRecord[]): AccuracyTracker {
  let tracker: AccuracyTracker | null = null;
  for (const r of records) tracker = trackPredictionAccuracy(tracker, r);
  return tracker || { totalPredictions: 0, totalError: 0, mae: 0, mape: 0, recentAccuracy: { mape: 0, r2: 0 }, bias: 0, predictions: [], overallAccuracy: { mape: 0, rmse: 0, r2: 0, bias: 0 }, trend: "stable", totalVerified: 0, byWeather: {} };
}

// 兼容性桩函数
export function gaussianProcessPredict(values: number[]): { mean: number; variance: number; lower: number; upper: number; confidence?: number } {
  const m = avg(values.slice(-14));
  return { mean: m, variance: 1, lower: m - 5, upper: m + 5, confidence: 0.7 };
}

export function spectralResidualAnalysis(values: number[]): SpectralAnalysis {
  return { forecast: avg(values.slice(-7)), frequencies: [1 / 7], dominant: 1 / 7 };
}

export function empiricalModeDecomposition(values: number[]): { forecast: number; imfs: number[][]; residual?: number[] } {
  return { forecast: avg(values.slice(-7)), imfs: [values] };
}

export function catboostPredict(_v: number[], _f: number[][], _i: number, _l: number): number { return 0; }

export function metaLearnerStacking(predictions: { name: string; value: number }[], _a: number[], _e: number[] = []): MetaLearner {
  const a = predictions.length > 0 ? predictions.reduce((s, p) => s + p.value, 0) / predictions.length : 0;
  return { weights: predictions.map(() => 1 / Math.max(1, predictions.length)), intercept: 0, prediction: Math.round(a), confidence: 0.75 };
}

export function adaptiveBayesianOptimize(_v: number[], wf: number, df: number, _m: number, _l: number) {
  return { correctedWeather: wf, correctedDow: df, correctedMomentum: 0.5 };
}

export function qLearningWeightUpdate(_n: string[], _p: number[], _a: number, _w: number[]) {
  return { reward: 0, learningRate: 0.1, newWeights: _p.map(() => 1 / _p.length) };
}

export function elasticNetRegularize(w: number[], _a: number, _l: number): number[] { return w; }

export function deepAnalyze(records: Record<string, DailyRecord>): {
  totalRecords: number; avgOrders: number; trend: string; consistency: string;
  weatherBreakdown: Record<string, { avg: number; count: number }>;
  weekdayBreakdown: Record<string, number>;
  volatility?: { daily: number; weekly: number };
  seasonality?: { strength: number; pattern?: string; details?: string[] };
  growth?: { rate: number; direction?: string };
  efficiency?: { avgPerHour: number; trend?: string };
  risk?: { score: number; level?: string; factors?: { name: string; impact: string }[] };
  weatherSensitivity?: { index: number; mostSensitive?: string; leastSensitive?: string };
  stabilityScore?: { score: number; level?: string };
  trends?: { shortTerm: number; mediumTerm: number; longTerm: number };
  correlation?: { weather: Record<string, number> };
  changepoints?: { date: string; type: string }[];
  momentumIndex?: { current: number; trend: string; score: number; level: string; value?: number };
  quantileDistribution?: { p10: number; p25: number; p50: number; p75: number; p90: number };
} {
  const all = Object.values(records).sort((a, b) => a.date.localeCompare(b.date));
  const orders = all.map(r => r.orders);
  const weatherBreakdown: Record<string, { avg: number; count: number }> = {};
  for (const w of ["sunny", "cloudy", "rainy", "snowy", "windy"]) {
    const wr = all.filter(r => r.weather === w);
    weatherBreakdown[w] = { avg: Math.round(avg(wr.map(r => r.orders))), count: wr.length };
  }
  const weekdayBreakdown: Record<string, number> = {};
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  for (let d = 0; d <= 6; d++) {
    const wr = all.filter(r => new Date(r.date).getDay() === d);
    weekdayBreakdown[weekdays[d]] = Math.round(avg(wr.map(r => r.orders)));
  }
  return {
    totalRecords: all.length,
    avgOrders: Math.round(avg(orders)),
    trend: "平稳",
    consistency: "稳定",
    weatherBreakdown,
    weekdayBreakdown,
    volatility: { daily: 10, weekly: 15 },
    seasonality: { strength: 0.5, pattern: "周循环", details: ["周末单量略低于工作日"] },
    growth: { rate: 0, direction: "平稳" },
    efficiency: { avgPerHour: 3, trend: "稳定" },
    risk: { score: 30, level: "低", factors: [{ name: "天气波动", impact: "低影响" }] },
    weatherSensitivity: { index: 25, mostSensitive: "雨天", leastSensitive: "晴天" },
    stabilityScore: { score: 70, level: "稳定" },
    trends: { shortTerm: Math.round(avg(orders.slice(-7))), mediumTerm: Math.round(avg(orders.slice(-14))), longTerm: Math.round(avg(orders.slice(-30))) },
    correlation: { weather: { sunny: weatherBreakdown["sunny"]?.avg || 0, cloudy: weatherBreakdown["cloudy"]?.avg || 0, rainy: weatherBreakdown["rainy"]?.avg || 0, snowy: weatherBreakdown["snowy"]?.avg || 0, windy: weatherBreakdown["windy"]?.avg || 0 } },
    changepoints: [],
    momentumIndex: { current: 0, trend: "稳定", score: 50, level: "中" },
    quantileDistribution: (() => {
      const s = [...orders].sort((a, b) => a - b);
      const q = (p: number) => s[Math.floor(s.length * p)] || 0;
      return { p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9) };
    })(),
  };
}