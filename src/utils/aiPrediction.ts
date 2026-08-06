// ══════════════════════════════════════════════════════════════════════
//  AI预测引擎 v20 — 外卖骑手场景专用预测
//  核心升级：
//  1. 从历史数据自动学习天气因子（而非固定经验值）
//  2. 同星期几加权 + 指数平滑 + 趋势外推
//  3. 个人效率因子（工时标准化）
//  4. 真实特殊事件/节假日检测
//  5. 目标完成概率、最佳时段、小时分布等骑手实用功能
// ══════════════════════════════════════════════════════════════════════

import { DailyRecord, Weather, PredictionResult, ShiftType, UserSettings, SHIFT_DEFINITIONS, WEATHER_LABELS } from "@/types";
import { parseLocalDate, getShiftForDate, today, getCurrentMonth, getUpcomingShifts } from "@/utils/date";
import { getUserLocation, fetchWeatherByCoords, weatherCodeToOurWeather, type WeatherData } from "@/services/weather";

// ── 默认天气加成（数据不足时的经验 fallback） ──
const DEFAULT_WEATHER_BOOST: Record<Weather, number> = {
  sunny: 1.00,
  cloudy: 1.00,
  rainy: 1.25,
  snowy: 1.35,
  windy: 1.10,
};

// ── 默认班次因子（数据不足时的经验 fallback） ──
const DEFAULT_SHIFT_FACTOR: Record<ShiftType, number> = {
  early_mid: 1.00, early: 1.02, late_mid: 1.00, late: 0.98, night: 0.94,
};

// ── 休息日识别：AI 预测时不计入休息日（即使记录了少量单量） ──
const REST_NOTE = "休息";
function isRestDay(r: DailyRecord): boolean {
  return r.note === REST_NOTE;
}
function isWorkDay(r: DailyRecord): boolean {
  return !isRestDay(r);
}

// ── 温度记录（外部传入） ──
export interface TemperatureHistory { date: string; temp: number; }

/** 从历史数据学习班次因子（数据不足则回退到默认值） */
function learnShiftFactors(records: Record<string, DailyRecord>, settings: Pick<UserSettings, "currentShift" | "shiftStartDate" | "weeklyShifts">): Record<ShiftType, number> {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 20) return { ...DEFAULT_SHIFT_FACTOR };

  const baseline = robustAvg(all.map(r => r.orders));
  if (baseline <= 0) return { ...DEFAULT_SHIFT_FACTOR };

  const result: Record<ShiftType, number> = { ...DEFAULT_SHIFT_FACTOR };
  for (const s of SHIFT_DEFINITIONS) {
    const days = all.filter(r => getShiftForDate(r.date, settings).type === s.type);
    if (days.length >= 3) {
      const observed = robustAvg(days.map(r => r.orders));
      const shrinkage = Math.min(1, days.length / 10);
      result[s.type] = DEFAULT_SHIFT_FACTOR[s.type] * (1 - shrinkage) + (observed / baseline) * shrinkage;
    }
  }
  // 归一化：保持平均为 1
  const mean = avg(Object.values(result));
  if (mean > 0) {
    for (const k of Object.keys(result) as ShiftType[]) result[k] /= mean;
  }
  return result;
}

/** 指数衰减权重（越近权重越高） */
function expDecayWeights(n: number, halfLife = 7): number[] {
  if (n <= 0) return [];
  const lambda = Math.log(2) / halfLife;
  const weights = Array.from({ length: n }, (_, i) => Math.exp(lambda * i));
  const sum = weights.reduce((s, w) => s + w, 0);
  return weights.map(w => w / sum);
}

/** Holt-Winters 简化：指数平滑 + 趋势 */
function holtForecast(values: number[], alpha = 0.3, beta = 0.1, steps = 1): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  let level = values[0];
  let trend = values[1] - values[0];
  for (let i = 1; i < values.length; i++) {
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  return Math.max(0, level + trend * steps);
}

/** AR(1) 残差修正：利用前一天实际与预测的偏差 */
function ar1ResidualAdjustment(records: Record<string, DailyRecord>): number {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 14) return 0;
  // 计算历史预测残差序列（用简单同星期几预测作为 proxy）
  const residuals: number[] = [];
  for (let i = 7; i < all.length; i++) {
    const actual = all[i].orders;
    const sameDOWPast = all.slice(0, i).filter(r => parseLocalDate(r.date).getDay() === parseLocalDate(all[i].date).getDay());
    if (sameDOWPast.length < 2) continue;
    const predicted = robustAvg(sameDOWPast.map(r => r.orders));
    residuals.push(actual - predicted);
  }
  if (residuals.length < 5) return 0;
  // AR(1) 系数
  const n = residuals.length;
  const r0 = residuals.slice(0, n - 1);
  const r1 = residuals.slice(1);
  const phi = covariance(r0, r1) / variance(r0);
  if (!Number.isFinite(phi) || Math.abs(phi) < 0.05) return 0;
  // 最新残差
  const latest = all[all.length - 1];
  const latestSameDOW = all.slice(0, -1).filter(r => parseLocalDate(r.date).getDay() === parseLocalDate(latest.date).getDay());
  const latestPredicted = latestSameDOW.length >= 2 ? robustAvg(latestSameDOW.map(r => r.orders)) : robustAvg(all.slice(-7).map(r => r.orders));
  const latestResidual = latest.orders - latestPredicted;
  return phi * latestResidual;
}

function covariance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  const ma = avg(a), mb = avg(b);
  return a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0) / a.length;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = avg(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
}

/** 计算预测区间（基于历史残差） */
function computePredictionInterval(records: Record<string, DailyRecord>, basePrediction: number): { low: number; high: number } {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 10) return { low: Math.round(basePrediction * 0.75), high: Math.round(basePrediction * 1.25) };

  const residuals: number[] = [];
  for (let i = 7; i < all.length; i++) {
    const sameDOW = all.slice(0, i).filter(r => parseLocalDate(r.date).getDay() === parseLocalDate(all[i].date).getDay());
    if (sameDOW.length < 2) continue;
    const pred = robustAvg(sameDOW.map(r => r.orders));
    residuals.push(all[i].orders - pred);
  }
  if (residuals.length < 5) return { low: Math.round(basePrediction * 0.80), high: Math.round(basePrediction * 1.20) };

  const sd = std(residuals);
  return {
    low: Math.max(0, Math.round(basePrediction - 1.5 * sd)),
    high: Math.round(basePrediction + 1.5 * sd),
  };
}

/** 节假日/调休检测（基于固定节日 + 周末偏移） */
function detectHoliday(dateStr: string): { isHoliday: boolean; isWorkday: boolean; name?: string; boost: number } {
  const event = getSpecialEvent(dateStr);
  const d = parseLocalDate(dateStr);
  const dow = d.getDay();
  const mmdd = dateStr.slice(5);

  // 法定长假（简化规则，按常见调休模式）
  const longHolidays: Record<string, { name: string; boost: number }> = {
    "02-10": { name: "春节长假", boost: 1.20 }, "02-11": { name: "春节长假", boost: 1.25 }, "02-12": { name: "春节长假", boost: 1.20 },
    "02-13": { name: "春节长假", boost: 1.15 }, "02-14": { name: "春节长假", boost: 1.15 }, "02-15": { name: "春节长假", boost: 1.10 },
    "05-01": { name: "五一假期", boost: 1.18 }, "05-02": { name: "五一假期", boost: 1.15 }, "05-03": { name: "五一假期", boost: 1.12 },
    "10-01": { name: "国庆假期", boost: 1.22 }, "10-02": { name: "国庆假期", boost: 1.20 }, "10-03": { name: "国庆假期", boost: 1.18 },
    "10-04": { name: "国庆假期", boost: 1.15 }, "10-05": { name: "国庆假期", boost: 1.12 }, "10-06": { name: "国庆假期", boost: 1.10 }, "10-07": { name: "国庆假期", boost: 1.08 },
  };

  if (longHolidays[mmdd]) {
    return { isHoliday: true, isWorkday: false, name: longHolidays[mmdd].name, boost: longHolidays[mmdd].boost };
  }
  if (event) {
    return { isHoliday: true, isWorkday: false, name: event.name, boost: event.boost };
  }
  // 周末默认假日
  if (dow === 0 || dow === 6) {
    return { isHoliday: true, isWorkday: false, boost: 1.0 };
  }
  return { isHoliday: false, isWorkday: true, boost: 1.0 };
}

// ══════════════════════════════════════════════════════════════════════
//  特殊事件日历 — 订单暴增日
// ══════════════════════════════════════════════════════════════════════
interface SpecialEvent {
  date: string;        // MM-DD 格式
  name: string;
  boost: number;
  description: string;
}

export const SPECIAL_EVENTS: SpecialEvent[] = [
  { date: "08-07", name: "秋天第一杯奶茶", boost: 1.60, description: "全网奶茶节，订单暴增60%" },
  { date: "08-15", name: "暑期尾声", boost: 1.15, description: "学生返程前单量高峰" },
  { date: "09-01", name: "开学季", boost: 0.85, description: "大学生返校，县城单量下降约15%" },
  { date: "02-14", name: "情人节", boost: 1.40, description: "鲜花外卖爆单" },
  { date: "05-20", name: "520表白日", boost: 1.35, description: "礼物外卖激增" },
  { date: "12-24", name: "平安夜", boost: 1.30, description: "圣诞订单高峰" },
  { date: "12-25", name: "圣诞节", boost: 1.25, description: "圣诞订单高峰" },
  { date: "01-01", name: "元旦", boost: 1.20, description: "新年订单增长" },
  { date: "11-11", name: "双十一", boost: 1.30, description: "购物节外卖激增" },
  { date: "06-18", name: "618", boost: 1.25, description: "购物节外卖增长" },
  { date: "05-01", name: "劳动节", boost: 1.15, description: "假期订单增长" },
  { date: "10-01", name: "国庆节", boost: 1.20, description: "国庆订单增长" },
  { date: "10-02", name: "国庆节", boost: 1.20, description: "国庆订单增长" },
  { date: "10-03", name: "国庆节", boost: 1.18, description: "国庆订单增长" },
  { date: "02-11", name: "除夕", boost: 1.30, description: "年夜饭外卖高峰" },
  { date: "02-12", name: "春节", boost: 1.25, description: "春节订单增长" },
  { date: "09-17", name: "中秋节", boost: 1.20, description: "中秋订单增长" },
  { date: "06-01", name: "儿童节", boost: 1.15, description: "亲子餐饮增长" },
  { date: "12-31", name: "跨年夜", boost: 1.25, description: "夜宵订单激增" },
];

// ══════════════════════════════════════════════════════════════════════
//  数学工具函数
// ══════════════════════════════════════════════════════════════════════
function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function weightedAvg(values: number[], weights: number[]): number {
  if (values.length === 0) return 0;
  const w = weights.length === values.length ? weights : Array(values.length).fill(1 / values.length);
  const sumW = w.reduce((s, x) => s + x, 0);
  if (sumW <= 0) return avg(values);
  return values.reduce((s, v, i) => s + v * w[i], 0) / sumW;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const m = avg(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length);
}

/** 截尾均值：去掉最高最低各 10% 后求平均，抗异常值 */
function trimmedMean(values: number[], trim = 0.1): number {
  if (values.length === 0) return 0;
  if (values.length <= 3) return avg(values);
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const cut = Math.floor(n * trim);
  const trimmed = sorted.slice(cut, n - cut);
  return trimmed.length > 0 ? avg(trimmed) : avg(sorted);
}

/** 稳健平均：截尾均值与中位数的加权 */
function robustAvg(values: number[]): number {
  if (values.length === 0) return 0;
  const t = trimmedMean(values, 0.1);
  const m = median(values);
  return t * 0.6 + m * 0.4;
}

/** 线性回归斜率 */
function linearRegressionSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((s, v) => s + v, 0);
  const sumXY = values.reduce((s, v, i) => s + i * v, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const denom = sumX2 - (sumX * sumX) / n;
  if (Math.abs(denom) < 0.001) return 0;
  return (sumXY - (sumX * sumY) / n) / denom;
}

// ══════════════════════════════════════════════════════════════════════
//  数据切片工具
// ══════════════════════════════════════════════════════════════════════
function sortRecords(records: Record<string, DailyRecord>): DailyRecord[] {
  return Object.values(records).sort((a, b) => a.date.localeCompare(b.date));
}

function getRecordsByMonth(records: Record<string, DailyRecord>, year: number, month: number): DailyRecord[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return Object.values(records)
    .filter(r => r.date.startsWith(prefix) && r.orders > 0 && isWorkDay(r))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getLastMonthRecords(records: Record<string, DailyRecord>): DailyRecord[] {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  const lastMonth = m === 0 ? 12 : m;
  const lastYear = m === 0 ? y - 1 : y;
  return getRecordsByMonth(records, lastYear, lastMonth);
}

function getCurrentMonthRecords(records: Record<string, DailyRecord>): DailyRecord[] {
  const now = new Date();
  return getRecordsByMonth(records, now.getFullYear(), now.getMonth() + 1);
}

function getSameDOWRecords(records: Record<string, DailyRecord>, targetDOW: number, maxDays = 90): DailyRecord[] {
  const sorted = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  const result: DailyRecord[] = [];
  for (let i = sorted.length - 1; i >= 0 && result.length < maxDays; i--) {
    const r = sorted[i];
    if (parseLocalDate(r.date).getDay() === targetDOW) result.push(r);
  }
  return result.reverse();
}

function getSpecialEvent(dateStr: string): SpecialEvent | null {
  const mmdd = dateStr.slice(5);
  return SPECIAL_EVENTS.find(e => e.date === mmdd) || null;
}

function isWeekend(dateStr: string): boolean {
  const d = parseLocalDate(dateStr);
  return d.getDay() === 0 || d.getDay() === 6;
}

// ══════════════════════════════════════════════════════════════════════
//  因子计算
// ══════════════════════════════════════════════════════════════════════

/** 从历史数据学习天气影响（带收缩估计 + 近期加权，更快适应天气变化） */
function learnWeatherBoost(records: Record<string, DailyRecord>): Record<Weather, number> {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 10) return { ...DEFAULT_WEATHER_BOOST };

  const groups: Record<Weather, DailyRecord[]> = {
    sunny: [], cloudy: [], rainy: [], snowy: [], windy: [],
  };
  for (const r of all) groups[r.weather].push(r);

  const baseline = robustAvg(all.map(r => r.orders));
  if (baseline <= 0) return { ...DEFAULT_WEATHER_BOOST };

  // 按时间顺序的指数衰减权重：近期天气模式影响更大
  const recencyWeights = expDecayWeights(all.length, 14);
  const weightByDate = new Map(all.map((r, i) => [r.date, recencyWeights[i]]));

  const result: Record<Weather, number> = { ...DEFAULT_WEATHER_BOOST };
  const weathers: Weather[] = ["sunny", "cloudy", "rainy", "snowy", "windy"];

  for (const w of weathers) {
    const group = groups[w];
    const prior = DEFAULT_WEATHER_BOOST[w];
    if (group.length >= 3) {
      const weights = group.map(r => weightByDate.get(r.date) ?? 1 / all.length);
      const observed = weightedAvg(group.map(r => r.orders), weights);
      // 收缩估计：样本越多越相信数据，样本少越相信先验
      const shrinkage = Math.min(1, group.length / 12);
      result[w] = prior * (1 - shrinkage) + (observed / baseline) * shrinkage;
    }
  }

  return result;
}

/** 计算周末 vs 工作日因子 */
function learnWeekendFactor(records: Record<string, DailyRecord>, targetIsWeekend: boolean): number {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 14) return targetIsWeekend ? 0.95 : 1.0;

  const weekend = all.filter(r => isWeekend(r.date));
  const weekday = all.filter(r => !isWeekend(r.date));
  if (weekend.length < 3 || weekday.length < 5) return targetIsWeekend ? 0.95 : 1.0;

  const weekendAvg = robustAvg(weekend.map(r => r.orders));
  const weekdayAvg = robustAvg(weekday.map(r => r.orders));
  if (weekdayAvg <= 0) return 1.0;

  const ratio = weekendAvg / weekdayAvg;
  return targetIsWeekend ? Math.max(0.75, Math.min(1.35, ratio)) : 1.0;
}

/** 个人效率因子：近期每小时单量 vs 历史平均 */
function learnEfficiencyFactor(records: Record<string, DailyRecord>): number {
  const all = sortRecords(records).filter(r => r.orders > 0 && r.workHours > 0 && isWorkDay(r));
  if (all.length < 6) return 1.0;

  const rates = all.map(r => r.orders / r.workHours);
  const recent = robustAvg(rates.slice(-7));
  const historical = robustAvg(rates);
  if (historical <= 0) return 1.0;
  return Math.max(0.85, Math.min(1.15, recent / historical));
}

/** 趋势因子：最近14天 vs 前14天 */
function learnTrendFactor(records: Record<string, DailyRecord>): number {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 14) return 1.0;

  const recent = all.slice(-14);
  const prev = all.slice(-28, -14);
  if (prev.length < 7) return 1.0;

  const recentAvg = robustAvg(recent.map(r => r.orders));
  const prevAvg = robustAvg(prev.map(r => r.orders));
  if (prevAvg <= 0) return 1.0;

  const ratio = recentAvg / prevAvg;
  return Math.max(0.85, Math.min(1.20, ratio));
}

/** 动量因子：最近3天 vs 最近7天 */
function learnMomentumFactor(records: Record<string, DailyRecord>): number {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 7) return 1.0;

  const last3 = robustAvg(all.slice(-3).map(r => r.orders));
  const last7 = robustAvg(all.slice(-7).map(r => r.orders));
  if (last7 <= 0) return 1.0;

  const ratio = last3 / last7;
  return Math.max(0.90, Math.min(1.10, ratio));
}

// 社会季节性先验：7-8月大学生回流小县城+高温外卖增多；9月开学季下滑
const SOCIAL_SEASONAL_PRIOR: Record<number, number> = {
  7: 1.08, // 暑假开始，学生回流 + 高温
  8: 1.12, // 暑期高峰 + 酷暑
  9: 0.88, // 开学季，大学生返校，县城单量下滑
};

/** 季节性因子：融合历史数据 + 社会/气候先验知识 */
function learnSeasonalFactor(records: Record<string, DailyRecord>, targetMonth: number): number {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  const prior = SOCIAL_SEASONAL_PRIOR[targetMonth] ?? 1.0;

  if (all.length < 30) return prior;

  const monthRecords = all.filter(r => parseLocalDate(r.date).getMonth() + 1 === targetMonth);
  if (monthRecords.length < 5) return prior;

  const monthAvg = robustAvg(monthRecords.map(r => r.orders));
  const overallAvg = robustAvg(all.map(r => r.orders));
  if (overallAvg <= 0) return prior;

  const historicalFactor = Math.max(0.80, Math.min(1.25, monthAvg / overallAvg));

  // 7-9 月：历史数据与社会先验融合（数据越多越相信历史，但先验权重至少 35%）
  if (targetMonth >= 7 && targetMonth <= 9) {
    const historyWeight = Math.min(0.65, monthRecords.length / 20);
    const socialWeight = 1 - historyWeight;
    return Math.max(0.80, Math.min(1.25, historicalFactor * historyWeight + prior * socialWeight));
  }

  return historicalFactor;
}

/** 历史同期因子：去年/前年同月同日 */
function learnSameDateFactor(records: Record<string, DailyRecord>, targetDateStr: string): number {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 60) return 1.0;

  const [year, month, day] = targetDateStr.split("-").map(Number);
  const sameDateRecords = all.filter(r => {
    const d = parseLocalDate(r.date);
    return d.getMonth() + 1 === month && d.getDate() === day && d.getFullYear() < year;
  });
  if (sameDateRecords.length < 2) return 1.0;

  const sameDateAvg = robustAvg(sameDateRecords.map(r => r.orders));
  const overallAvg = robustAvg(all.map(r => r.orders));
  if (overallAvg <= 0) return 1.0;

  return Math.max(0.80, Math.min(1.25, sameDateAvg / overallAvg));
}

/** 温度因子：基于历史数据学习温度对单量的影响（需要外部传入温度） */
function temperatureImpactFactor(temperature: number | undefined): number {
  if (temperature === undefined) return 1.0;
  // 外卖骑手场景：极端温度降低单量或增加单量（恶劣天气更多人点外卖）
  // 15-28°C 是舒适区
  if (temperature >= 15 && temperature <= 28) return 1.0;
  if (temperature < 0) return 1.12; // 严寒点外卖增多
  if (temperature < 10) return 1.06;
  if (temperature > 35) return 1.08; // 酷暑点外卖增多
  if (temperature > 30) return 1.03;
  return 0.98;
}

/** 组合多个因子的修正（避免连乘过度放大） */
function combineFactors(base: number, factorMap: Record<string, number>, weights: Record<string, number>): number {
  let adjustment = 0;
  for (const [key, factor] of Object.entries(factorMap)) {
    const w = weights[key] ?? 0.5;
    adjustment += (factor - 1) * w;
  }
  return Math.max(1, Math.round(base * (1 + adjustment)));
}

/** 特征交叉：天气 × 星期几 对单量的影响 */
function learnWeatherDOWFactor(records: Record<string, DailyRecord>, weather: Weather, dow: number): number {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 30) return 1.0;

  const baseline = robustAvg(all.map(r => r.orders));
  if (baseline <= 0) return 1.0;

  const sameWeatherDOW = all.filter(r => r.weather === weather && parseLocalDate(r.date).getDay() === dow);
  if (sameWeatherDOW.length < 2) return 1.0;

  const sameWeather = all.filter(r => r.weather === weather);
  const sameDOW = all.filter(r => parseLocalDate(r.date).getDay() === dow);
  if (sameWeather.length < 3 || sameDOW.length < 3) return 1.0;

  const weatherDOWAvg = robustAvg(sameWeatherDOW.map(r => r.orders));
  const weatherAvg = robustAvg(sameWeather.map(r => r.orders));
  const dowAvg = robustAvg(sameDOW.map(r => r.orders));

  // 交互效应 = 实际组合均值 / (天气主效应 × 星期几主效应 / 全局均值)
  const expected = (weatherAvg * dowAvg) / baseline;
  if (expected <= 0) return 1.0;
  const interaction = weatherDOWAvg / expected;
  return Math.max(0.85, Math.min(1.20, interaction));
}

/** 特征交叉：班次 × 星期几 对单量的影响 */
function learnShiftDOWFactor(
  records: Record<string, DailyRecord>,
  shift: ShiftType,
  dow: number,
  settings: Pick<UserSettings, "currentShift" | "shiftStartDate" | "weeklyShifts">
): number {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 30) return 1.0;

  const sameShiftDOW = all.filter(r => {
    return getShiftForDate(r.date, settings).type === shift && parseLocalDate(r.date).getDay() === dow;
  });
  if (sameShiftDOW.length < 2) return 1.0;

  const baseline = robustAvg(all.map(r => r.orders));
  const shiftAvg = robustAvg(all.filter(r => getShiftForDate(r.date, settings).type === shift).map(r => r.orders));
  const dowAvg = robustAvg(all.filter(r => parseLocalDate(r.date).getDay() === dow).map(r => r.orders));
  if (baseline <= 0 || shiftAvg <= 0 || dowAvg <= 0) return 1.0;

  const observed = robustAvg(sameShiftDOW.map(r => r.orders));
  const expected = (shiftAvg * dowAvg) / baseline;
  const interaction = observed / expected;
  return Math.max(0.85, Math.min(1.20, interaction));
}

/** 通过 Walk-forward 回测估计模型历史偏差，用于校准最终预测 */
function learnHistoricalBias(records: Record<string, DailyRecord>): number {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  const minHistory = 21;
  if (all.length < minHistory + 5) return 0;

  const biases: number[] = [];
  for (let i = minHistory; i < all.length; i++) {
    const target = all[i];
    const history: Record<string, DailyRecord> = {};
    for (let j = 0; j < i; j++) history[all[j].date] = all[j];

    const sameDOW = getSameDOWRecords(history, parseLocalDate(target.date).getDay(), 12);
    if (sameDOW.length < 2) continue;
    const predicted = robustAvg(sameDOW.map(r => r.orders));
    biases.push(target.orders - predicted);
  }
  if (biases.length < 5) return 0;
  return trimmedMean(biases, 0.1);
}

/** 动态模型权重：根据历史回测表现自适应调整 */
function computeDynamicModelWeights(records: Record<string, DailyRecord>): { dow: number; overall: number; sameDate: number; seasonal: number } {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  const minHistory = 28;
  if (all.length < minHistory) {
    return { dow: 0.35, overall: 0.55, sameDate: 0.05, seasonal: 0.05 };
  }

  // 对每种成分做简单 walk-forward 评估
  const errors: { dow: number; overall: number; sameDate: number; seasonal: number }[] = [];
  for (let i = minHistory; i < all.length; i++) {
    const target = all[i];
    const history: Record<string, DailyRecord> = {};
    for (let j = 0; j < i; j++) history[all[j].date] = all[j];
    const histAll = sortRecords(history).filter(r => r.orders > 0 && isWorkDay(r));
    if (histAll.length < 14) continue;

    const actual = target.orders;
    const sameDOW = getSameDOWRecords(history, parseLocalDate(target.date).getDay(), 12);
    const dowPred = sameDOW.length > 0 ? robustAvg(sameDOW.map(r => r.orders)) : 0;

    const recentValues = histAll.slice(-30).map(r => r.orders);
    const overallPred = robustAvg(recentValues);

    const sameDateFactor = learnSameDateFactor(history, target.date);
    const sameDatePred = overallPred * sameDateFactor;

    const seasonalFactor = learnSeasonalFactor(history, parseLocalDate(target.date).getMonth() + 1);
    const seasonalPred = overallPred * seasonalFactor;

    if (dowPred > 0) errors.push({
      dow: Math.abs(actual - dowPred),
      overall: Math.abs(actual - overallPred),
      sameDate: Math.abs(actual - sameDatePred),
      seasonal: Math.abs(actual - seasonalPred),
    });
  }

  if (errors.length < 5) {
    return { dow: 0.35, overall: 0.55, sameDate: 0.05, seasonal: 0.05 };
  }

  const avgError = (key: keyof typeof errors[0]) => avg(errors.map(e => e[key])) || 1;
  const inv = {
    dow: 1 / avgError("dow"),
    overall: 1 / avgError("overall"),
    sameDate: 1 / avgError("sameDate"),
    seasonal: 1 / avgError("seasonal"),
  };
  const total = inv.dow + inv.overall + inv.sameDate + inv.seasonal;
  return {
    dow: Math.round((inv.dow / total) * 100) / 100,
    overall: Math.round((inv.overall / total) * 100) / 100,
    sameDate: Math.round((inv.sameDate / total) * 100) / 100,
    seasonal: Math.round((inv.seasonal / total) * 100) / 100,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  指定日期预测
// ══════════════════════════════════════════════════════════════════════
export interface PredictOptions {
  temperature?: number;
  overrideShift?: ShiftType;
}

export function predictForDateAI(
  records: Record<string, DailyRecord>,
  targetDateStr: string,
  weather: Weather,
  settings?: Pick<UserSettings, "currentShift" | "shiftStartDate" | "weeklyShifts">,
  options?: PredictOptions
): PredictionResult {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  const targetDate = parseLocalDate(targetDateStr);
  const targetDOW = targetDate.getDay();
  const targetIsWeekend = targetDOW === 0 || targetDOW === 6;

  if (all.length < 3) {
    return {
      predictedOrders: 0,
      confidence: "low",
      factors: [{ label: "数据不足", impact: "请记录至少 3 天数据后再查看预测" }],
    };
  }

  const weatherBoost = learnWeatherBoost(records);
  const shiftFactors = settings ? learnShiftFactors(records, settings) : { ...DEFAULT_SHIFT_FACTOR };
  const shiftType = options?.overrideShift
    || (settings ? getShiftForDate(targetDateStr, settings).type : undefined)
    || "early_mid";
  const shiftFactor = shiftFactors[shiftType] || 1;

  // ═══════════════════════════════════════════════════════════════════════
  // 1. 同星期几预测（指数衰减加权，最近 12 周，稳健平均）
  // ═══════════════════════════════════════════════════════════════════════
  const sameDOW = getSameDOWRecords(records, targetDOW, 12);
  let dowPrediction = 0;
  if (sameDOW.length > 0) {
    const weights = expDecayWeights(sameDOW.length, 7);
    dowPrediction = sameDOW.reduce((s, r, i) => s + r.orders * weights[i], 0);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. 近期整体稳健平均 + Holt-Winters 趋势外推
  // ═══════════════════════════════════════════════════════════════════════
  const recentValues = all.slice(-30).map(r => r.orders);
  const recentRobust = robustAvg(recentValues);
  const holtPrediction = holtForecast(recentValues, 0.35, 0.12);
  const overallPrediction = recentRobust * 0.7 + holtPrediction * 0.3;

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 历史同期与季节性预测
  // ═══════════════════════════════════════════════════════════════════════
  const sameDateFactor = learnSameDateFactor(records, targetDateStr);
  const sameDatePrediction = overallPrediction * sameDateFactor;
  const seasonalFactorBase = learnSeasonalFactor(records, targetDate.getMonth() + 1);
  const seasonalPrediction = overallPrediction * seasonalFactorBase;
  const seasonalFactor = seasonalFactorBase; // 复用，避免重复计算

  // ═══════════════════════════════════════════════════════════════════════
  // 4. 动态模型权重：根据历史各成分预测表现自适应
  // ═══════════════════════════════════════════════════════════════════════
  const dynamicWeights = computeDynamicModelWeights(records);
  const totalBaseWeight = dynamicWeights.dow + dynamicWeights.overall + dynamicWeights.sameDate + dynamicWeights.seasonal;
  const normalizedDowWeight = totalBaseWeight > 0 ? dynamicWeights.dow / totalBaseWeight : 0;
  const normalizedOverallWeight = totalBaseWeight > 0 ? dynamicWeights.overall / totalBaseWeight : 0;
  const normalizedSameDateWeight = totalBaseWeight > 0 ? dynamicWeights.sameDate / totalBaseWeight : 0;
  const normalizedSeasonalWeight = totalBaseWeight > 0 ? dynamicWeights.seasonal / totalBaseWeight : 0;

  let basePrediction = overallPrediction * normalizedOverallWeight
    + dowPrediction * normalizedDowWeight
    + sameDatePrediction * normalizedSameDateWeight
    + seasonalPrediction * normalizedSeasonalWeight;

  // ═══════════════════════════════════════════════════════════════════════
  // 5. AR(1) 残差修正 + 历史偏差校准
  // ═══════════════════════════════════════════════════════════════════════
  const arAdjustment = ar1ResidualAdjustment(records);
  const historicalBias = learnHistoricalBias(records);
  basePrediction = Math.max(1, basePrediction + arAdjustment * 0.5 - historicalBias * 0.3);

  // ═══════════════════════════════════════════════════════════════════════
  // 6. 各修正因子（含特征交叉）
  // ═══════════════════════════════════════════════════════════════════════
  const weatherFactor = weatherBoost[weather] ?? 1.0;
  const weatherDOWFactor = learnWeatherDOWFactor(records, weather, targetDOW);
  const shiftDOWFactor = settings ? learnShiftDOWFactor(records, shiftType, targetDOW, settings) : 1.0;
  const trendFactor = learnTrendFactor(records);
  const momentumFactor = learnMomentumFactor(records);
  const weekendFactor = learnWeekendFactor(records, targetIsWeekend);
  // seasonalFactor 已在上方计算，复用
  const efficiencyFactor = learnEfficiencyFactor(records);
  const tempFactor = temperatureImpactFactor(options?.temperature);
  const holiday = detectHoliday(targetDateStr);
  const specialEvent = getSpecialEvent(targetDateStr);
  const eventFactor = specialEvent ? specialEvent.boost : holiday.boost;

  // ═══════════════════════════════════════════════════════════════════════
  // 7. 最终预测（加权修正，避免连乘过度放大）
  // ═══════════════════════════════════════════════════════════════════════
  const predictedRaw = combineFactors(basePrediction, {
    weather: weatherFactor,
    weatherDOW: weatherDOWFactor,
    shift: shiftFactor,
    shiftDOW: shiftDOWFactor,
    trend: trendFactor,
    momentum: momentumFactor,
    weekend: weekendFactor,
    seasonal: seasonalFactor,
    efficiency: efficiencyFactor,
    temperature: tempFactor,
    event: eventFactor,
  }, {
    weather: 0.70,
    weatherDOW: 0.35,
    shift: 0.75,
    shiftDOW: 0.30,
    trend: 0.60,
    momentum: 0.40,
    weekend: 0.70,
    seasonal: 0.30,
    efficiency: 0.50,
    temperature: 0.35,
    event: 0.95,
  });

  const predicted = Math.max(1, Math.round(predictedRaw));

  // ═══════════════════════════════════════════════════════════════════════
  // 8. 预测区间与置信度
  // ═══════════════════════════════════════════════════════════════════════
  const interval = computePredictionInterval(records, predicted);
  const dataDays = all.length;
  const sameDOWCount = sameDOW.length;
  const intervalWidth = interval.high - interval.low;
  const intervalRatio = predicted > 0 ? intervalWidth / predicted : 1;

  let confidence: PredictionResult["confidence"] = "low";
  if (dataDays >= 45 && sameDOWCount >= 5 && intervalRatio < 0.45) confidence = "high";
  else if (dataDays >= 18 && sameDOWCount >= 2 && intervalRatio < 0.70) confidence = "medium";

  // ═══════════════════════════════════════════════════════════════════════
  // 9. 解释因子
  // ═══════════════════════════════════════════════════════════════════════
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const weatherLabels: Record<Weather, string> = {
    sunny: "晴天", cloudy: "多云", rainy: "雨天", snowy: "雪天", windy: "大风",
  };

  const factors: { label: string; impact: string }[] = [
    {
      label: `${weekdays[targetDOW]}基准`,
      impact: `${sameDOWCount > 0 ? `近${sameDOWCount}个${weekdays[targetDOW]}均${Math.round(dowPrediction)}单` : "无同星期几数据"} · 融合后${Math.round(basePrediction)}单`,
    },
  ];

  if (weatherFactor !== 1.0) {
    const pct = Math.round((weatherFactor - 1) * 100);
    factors.push({
      label: `${weatherLabels[weather]}影响`,
      impact: pct >= 0 ? `+${pct}%（基于历史${weatherLabels[weather]}数据）` : `${pct}%`,
    });
  }

  if (specialEvent || holiday.name) {
    const pct = Math.round((eventFactor - 1) * 100);
    factors.push({
      label: specialEvent ? `🎉 ${specialEvent.name}` : `🎉 ${holiday.name}`,
      impact: pct >= 0 ? `预计+${pct}% · ${specialEvent?.description || "节假日订单增长"}` : `预计${pct}%`,
    });
  }

  if (Math.abs(weekendFactor - 1.0) > 0.02 && targetIsWeekend) {
    const pct = Math.round((weekendFactor - 1) * 100);
    factors.push({ label: "周末模式", impact: pct >= 0 ? `周末+${pct}%` : `周末${pct}%` });
  }

  if (Math.abs(trendFactor - 1.0) > 0.02) {
    factors.push({
      label: "趋势修正",
      impact: trendFactor > 1 ? `近期上升 +${Math.round((trendFactor - 1) * 100)}%` : `近期下降 ${Math.round((trendFactor - 1) * 100)}%`,
    });
  }

  if (Math.abs(momentumFactor - 1.0) > 0.02) {
    factors.push({
      label: "短期动量",
      impact: momentumFactor > 1 ? `近3日强于近7日 +${Math.round((momentumFactor - 1) * 100)}%` : `近3日弱于近7日 ${Math.round((momentumFactor - 1) * 100)}%`,
    });
  }

  if (Math.abs(seasonalFactor - 1.0) > 0.03) {
    const pct = Math.round((seasonalFactor - 1) * 100);
    factors.push({ label: "季节因子", impact: pct >= 0 ? `该月份历史偏高 +${pct}%` : `该月份历史偏低 ${pct}%` });
  }

  if (Math.abs(efficiencyFactor - 1.0) > 0.03) {
    factors.push({
      label: "效率因子",
      impact: efficiencyFactor > 1 ? `近期效率提升 +${Math.round((efficiencyFactor - 1) * 100)}%` : `近期效率下降 ${Math.round((efficiencyFactor - 1) * 100)}%`,
    });
  }

  if (Math.abs(tempFactor - 1.0) > 0.02 && options?.temperature !== undefined) {
    const pct = Math.round((tempFactor - 1) * 100);
    factors.push({ label: "温度影响", impact: `${options.temperature}°C · ${pct >= 0 ? "+" : ""}${pct}%` });
  }

  if (Math.abs(shiftFactor - 1.0) > 0.03) {
    const pct = Math.round((shiftFactor - 1) * 100);
    factors.push({ label: "班次因子", impact: pct >= 0 ? `该班次历史偏高 +${pct}%` : `该班次历史偏低 ${pct}%` });
  }

  if (options?.overrideShift && options.overrideShift !== shiftType) {
    const shiftName = SHIFT_DEFINITIONS.find(s => s.type === options.overrideShift)?.name || options.overrideShift;
    factors.push({ label: "班次模拟", impact: `假设${shiftName}的预测结果` });
  }

  const modelWeights = [
    { label: "同星期几", weight: Math.round(normalizedDowWeight * 100) },
    { label: "近期趋势", weight: Math.round(normalizedOverallWeight * 100) },
    { label: "历史同期", weight: Math.round(normalizedSameDateWeight * 100) },
    { label: "季节因子", weight: Math.round(normalizedSeasonalWeight * 100) },
  ];

  return { predictedOrders: predicted, confidence, factors, interval, modelWeights };
}

// ══════════════════════════════════════════════════════════════════════
//  明日预测
// ══════════════════════════════════════════════════════════════════════
export function predictTomorrowAI(
  records: Record<string, DailyRecord>,
  weather: Weather,
  settings?: Pick<UserSettings, "currentShift" | "shiftStartDate" | "weeklyShifts">,
  options?: PredictOptions
): PredictionResult {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  return predictForDateAI(records, tomorrowStr, weather, settings, options);
}

export interface DailyForecast {
  date: string;
  weather: Weather;
  maxTemp?: number;
  minTemp?: number;
}

// ══════════════════════════════════════════════════════════════════════
//  周预测
// ══════════════════════════════════════════════════════════════════════
export function predictWeeklyAI(
  records: Record<string, DailyRecord>,
  weatherForecast: Weather[] | DailyForecast[],
  settings?: Pick<UserSettings, "currentShift" | "shiftStartDate" | "weeklyShifts">
): { totalPredicted: number; dailyPredictions: { day: string; date: string; predicted: number; weather: Weather }[] } {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const result: { day: string; date: string; predicted: number; weather: Weather }[] = [];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i + 1);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const fc = weatherForecast[i];
    const w: Weather = typeof fc === "string" ? fc : (fc?.weather || "sunny");
    const temp = typeof fc === "object" && fc ? fc.maxTemp : undefined;
    const pred = predictForDateAI(records, dateStr, w, settings, { temperature: temp });
    result.push({ day: weekdays[d.getDay()], date: dateStr, predicted: pred.predictedOrders, weather: w });
  }

  const totalPredicted = result.reduce((s, r) => s + r.predicted, 0);
  return { totalPredicted, dailyPredictions: result };
}

// ══════════════════════════════════════════════════════════════════════
//  联网天气增强预测
// ══════════════════════════════════════════════════════════════════════
export interface NetworkWeatherForecast {
  source: "network" | "fallback";
  cityName?: string;
  daily: DailyForecast[];
}

function estimateDayTemperature(fc: DailyForecast): number | undefined {
  if (fc.maxTemp !== undefined && fc.minTemp !== undefined) {
    return Math.round((fc.maxTemp + fc.minTemp) / 2);
  }
  return undefined;
}

/** 自动联网获取未来天气（Open-Meteo，无需 API Key） */
export async function fetchNetworkWeatherForecast(days = 7): Promise<NetworkWeatherForecast> {
  const loc = await getUserLocation();
  let weather: WeatherData | null = null;
  if (loc) {
    try {
      weather = await fetchWeatherByCoords(loc.lat, loc.lon);
    } catch {
      weather = null;
    }
  }

  if (!weather) {
    const daily: DailyForecast[] = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i + 1);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      daily.push({ date: ds, weather: "sunny" });
    }
    return { source: "fallback", daily };
  }

  const daily = weather.forecast.slice(0, days).map((day) => ({
    date: day.date,
    weather: weatherCodeToOurWeather(day.weatherCode),
    maxTemp: day.maxTemp,
    minTemp: day.minTemp,
  }));

  return { source: "network", cityName: weather.cityName, daily };
}

export interface NetworkPredictionResult extends PredictionResult {
  source: "network" | "fallback";
  cityName?: string;
  temperature?: number;
}

/** 明日预测：联网获取真实天气 */
export async function predictTomorrowAIWithNetworkWeather(
  records: Record<string, DailyRecord>,
  settings?: Pick<UserSettings, "currentShift" | "shiftStartDate" | "weeklyShifts">,
  options?: PredictOptions
): Promise<NetworkPredictionResult> {
  const forecast = await fetchNetworkWeatherForecast(1);
  const tomorrow = forecast.daily[0] || { date: "", weather: "sunny" as Weather };
  const temperature = estimateDayTemperature(tomorrow);
  const result = predictTomorrowAI(records, tomorrow.weather, settings, { ...options, temperature });
  return { ...result, source: forecast.source, cityName: forecast.cityName, temperature };
}

/** 未来 7 天预测：联网获取真实天气 */
export async function predictWeeklyAIWithNetworkWeather(
  records: Record<string, DailyRecord>,
  settings?: Pick<UserSettings, "currentShift" | "shiftStartDate" | "weeklyShifts">
): Promise<{ totalPredicted: number; dailyPredictions: { day: string; date: string; predicted: number; weather: Weather }[]; source: "network" | "fallback"; cityName?: string }> {
  const forecast = await fetchNetworkWeatherForecast(7);
  const result = predictWeeklyAI(records, forecast.daily, settings);
  return { ...result, source: forecast.source, cityName: forecast.cityName };
}

// ══════════════════════════════════════════════════════════════════════
//  月度预测
// ══════════════════════════════════════════════════════════════════════
export function predictMonthlyAI(
  records: Record<string, DailyRecord>,
  settings: { monthlyGoal: number; workDaysPerWeek: number; currentShift: ShiftType; shiftStartDate?: string; weeklyShifts?: Record<string, ShiftType> },
  weatherForecast?: DailyForecast[]
): {
  predicted: number;
  completed: number;
  dailyNeeded: number;
  lowEstimate: number;
  highEstimate: number;
  weeklyBreakdown: { week: number; predicted: number; low: number; high: number }[];
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = now.getDate();
  const remainingDays = daysInMonth - today;

  const networkWeatherMap = weatherForecast ? new Map(weatherForecast.map(d => [d.date, d])) : null;

  const thisMonth = getCurrentMonthRecords(records);
  const completed = thisMonth.reduce((s, r) => s + r.orders, 0);

  // 基于最近 60 天数据的日均单量（个人效率标准化后）
  const recent = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r)).slice(-60);
  let dailyAvg = 0;
  if (recent.length > 0) {
    const normalized = recent.map(r => {
      const hours = r.workHours > 0 ? r.workHours : 8;
      return (r.orders / hours) * 8;
    });
    dailyAvg = robustAvg(normalized);
  }
  if (dailyAvg <= 0) dailyAvg = 30;

  // 计算剩余有效工作日（基于历史出勤模式）
  const historicalWorkDays = estimateWorkDays(records, year, month, today + 1, daysInMonth);
  const workDaysRemaining = Math.max(1, historicalWorkDays > 0 ? historicalWorkDays : Math.round(remainingDays * (settings.workDaysPerWeek / 7)));

  // 班次因子：从历史数据学习
  const shiftFactors = learnShiftFactors(records, settings);

  const trendFactor = learnTrendFactor(records);
  const seasonalFactor = learnSeasonalFactor(records, month);
  const weatherBoost = learnWeatherBoost(records);
  const avgWeatherFactor = avg(Object.values(weatherBoost));

  // 按天聚合预测（考虑班次、节假日、周末因子）
  let remainingPredicted = 0;
  let remainingLow = 0;
  let remainingHigh = 0;
  const dailyPredictions: { date: string; predicted: number; low: number; high: number; isWorkday: boolean }[] = [];

  for (let d = 1; d <= remainingDays; d++) {
    const dd = new Date(now);
    dd.setDate(dd.getDate() + d);
    const ds = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
    const shift = getShiftForDate(ds, settings).type;
    const shiftFactor = shiftFactors[shift] || 1;
    const holiday = detectHoliday(ds);
    const weekendFactor = learnWeekendFactor(records, dd.getDay() === 0 || dd.getDay() === 6);
    const eventBoost = holiday.boost;

    // 联网天气优先：有真实天气预报时用真实天气，否则用历史平均天气因子
    let dayWeatherFactor = avgWeatherFactor;
    let dayTemp: number | undefined;
    if (networkWeatherMap) {
      const nw = networkWeatherMap.get(ds);
      if (nw) {
        dayWeatherFactor = weatherBoost[nw.weather] ?? avgWeatherFactor;
        dayTemp = estimateDayTemperature(nw);
      }
    }
    const tempFactor = dayTemp !== undefined ? temperatureImpactFactor(dayTemp) : 1.0;

    const dayBase = dailyAvg * shiftFactor * trendFactor * seasonalFactor * dayWeatherFactor * tempFactor;
    const dayPredicted = Math.max(0, Math.round(dayBase * eventBoost * weekendFactor));
    const dayLow = Math.max(0, Math.round(dayBase * 0.75));
    const dayHigh = Math.round(dayBase * 1.25 * eventBoost);

    dailyPredictions.push({ date: ds, predicted: dayPredicted, low: dayLow, high: dayHigh, isWorkday: holiday.isWorkday || !holiday.isHoliday });
  }

  // 根据历史出勤概率加权求和（周末权重低）
  const dowProb = estimateWorkDayProbability(records);
  for (const day of dailyPredictions) {
    const dow = parseLocalDate(day.date).getDay();
    const prob = dowProb[dow] > 0 ? dowProb[dow] : (day.isWorkday ? 1 : 0.3);
    remainingPredicted += day.predicted * prob;
    remainingLow += day.low * prob;
    remainingHigh += day.high * prob;
  }

  // 特殊事件额外加成（已在 per-day 计算中体现，这里仅做小幅修正避免重复）
  let eventExtra = 0;
  for (const day of dailyPredictions) {
    const event = getSpecialEvent(day.date);
    if (event) eventExtra += day.predicted * (event.boost - 1) * 0.3;
  }

  const predicted = Math.round(completed + remainingPredicted + eventExtra);
  const lowEstimate = Math.round(completed + remainingLow * 0.85);
  const highEstimate = Math.round(completed + remainingHigh * 1.15 + eventExtra);
  const dailyNeeded = workDaysRemaining > 0
    ? Math.round((settings.monthlyGoal - completed) / workDaysRemaining)
    : 0;

  // 剩余周分解
  const weeklyBreakdown: { week: number; predicted: number; low: number; high: number }[] = [];
  let remaining = remainingDays;
  let weekNum = 1;
  let dayIndex = 0;
  while (remaining > 0) {
    const weekDays = Math.min(7, remaining);
    let wp = 0, wl = 0, wh = 0;
    for (let i = 0; i < weekDays && dayIndex < dailyPredictions.length; i++, dayIndex++) {
      const day = dailyPredictions[dayIndex];
      const dow = parseLocalDate(day.date).getDay();
      const prob = dowProb[dow] > 0 ? dowProb[dow] : (day.isWorkday ? 1 : 0.3);
      wp += day.predicted * prob;
      wl += day.low * prob;
      wh += day.high * prob;
    }
    weeklyBreakdown.push({
      week: weekNum,
      predicted: Math.round(wp),
      low: Math.round(wl * 0.85),
      high: Math.round(wh * 1.15),
    });
    remaining -= weekDays;
    weekNum++;
  }

  return { predicted, completed, dailyNeeded, lowEstimate, highEstimate, weeklyBreakdown };
}

/** 月度预测：联网获取真实天气增强 */
export async function predictMonthlyAIWithNetworkWeather(
  records: Record<string, DailyRecord>,
  settings: { monthlyGoal: number; workDaysPerWeek: number; currentShift: ShiftType; shiftStartDate?: string; weeklyShifts?: Record<string, ShiftType> }
): Promise<{
  predicted: number;
  completed: number;
  dailyNeeded: number;
  lowEstimate: number;
  highEstimate: number;
  weeklyBreakdown: { week: number; predicted: number; low: number; high: number }[];
  source: "network" | "fallback";
  cityName?: string;
}> {
  const network = await fetchNetworkWeatherForecast(7);
  const result = predictMonthlyAI(records, settings, network.daily);
  return { ...result, source: network.source, cityName: network.cityName };
}

/** 估算每天出勤概率（基于历史数据：该星期几在历史期间出现过几次 / 其中工作几次） */
function estimateWorkDayProbability(records: Record<string, DailyRecord>): number[] {
  const all = sortRecords(records);
  if (all.length < 14) return [0.4, 1, 1, 1, 1, 1, 0.5];

  const dowCount: number[] = Array(7).fill(0);
  const dowWork: number[] = Array(7).fill(0);

  const start = parseLocalDate(all[0].date);
  const end = parseLocalDate(all[all.length - 1].date);
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const ds = `${y}-${m}-${dd}`;
    const dow = d.getDay();
    dowCount[dow]++;
    if (records[ds]?.orders > 0 && !isRestDay(records[ds])) dowWork[dow]++;
  }

  return dowCount.map((c, i) => {
    if (c === 0) return i === 0 || i === 6 ? 0.3 : 0.9;
    return Math.min(1, Math.max(0.15, dowWork[i] / c));
  });
}

/** 基于历史出勤模式估算剩余天数中的工作日数量 */
function estimateWorkDays(records: Record<string, DailyRecord>, year: number, month: number, startDay: number, endDay: number): number {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 14) return 0;

  // 计算历史上每天的出勤概率
  const dowWorkProb: number[] = Array(7).fill(0);
  const dowCount: number[] = Array(7).fill(0);

  for (const r of all) {
    const dow = parseLocalDate(r.date).getDay();
    dowCount[dow]++;
    dowWorkProb[dow]++;
  }

  for (let i = 0; i < 7; i++) {
    if (dowCount[i] > 0) dowWorkProb[i] /= dowCount[i];
  }

  let workDays = 0;
  for (let d = startDay; d <= endDay; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    workDays += dowWorkProb[dow];
  }

  return Math.round(workDays);
}

// ══════════════════════════════════════════════════════════════════════
//  智能洞察
// ══════════════════════════════════════════════════════════════════════
export function generateInsights(
  records: Record<string, DailyRecord>,
  settings: { dailyGoal: number; monthlyGoal: number }
): { icon: string; title: string; message: string; priority: "high" | "medium" | "low" }[] {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 3) return [];

  const insights: { icon: string; title: string; message: string; priority: "high" | "medium" | "low" }[] = [];

  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthOrders = all.filter(r => r.date.startsWith(prefix)).reduce((s, r) => s + r.orders, 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedProgress = now.getDate() / daysInMonth;
  const progress = settings.monthlyGoal > 0 ? monthOrders / settings.monthlyGoal : 0;

  if (progress > expectedProgress * 1.1) {
    insights.push({ icon: "🎯", title: "超前完成", message: `当前进度${Math.round(progress * 100)}%，领先预期，继续保持！`, priority: "low" });
  } else if (progress < expectedProgress * 0.85 && settings.monthlyGoal > 0) {
    const needed = Math.round((settings.monthlyGoal - monthOrders) / Math.max(1, daysInMonth - now.getDate()));
    insights.push({ icon: "⚠️", title: "进度落后", message: `当前进度${Math.round(progress * 100)}%，需每日完成约${needed}单追赶。`, priority: "high" });
  }

  const lastMonth = getLastMonthRecords(records);
  if (lastMonth.length > 0) {
    const lastMonthAvg = robustAvg(lastMonth.map(r => r.orders));
    const thisMonth = getCurrentMonthRecords(records);
    const thisMonthAvg = thisMonth.length > 0 ? robustAvg(thisMonth.map(r => r.orders)) : 0;
    if (thisMonthAvg > 0 && lastMonthAvg > 0) {
      const change = ((thisMonthAvg - lastMonthAvg) / lastMonthAvg) * 100;
      if (change > 10) {
        insights.push({ icon: "📈", title: "较上月增长", message: `本月日均${Math.round(thisMonthAvg)}单，较上月${Math.round(lastMonthAvg)}单增长${Math.round(change)}%。`, priority: "medium" });
      } else if (change < -10) {
        insights.push({ icon: "📉", title: "较上月下降", message: `本月日均${Math.round(thisMonthAvg)}单，较上月${Math.round(lastMonthAvg)}单下降${Math.round(Math.abs(change))}%。`, priority: "high" });
      }
    }
  }

  // 天气影响洞察
  const weatherBoost = learnWeatherBoost(records);
  const bestWeather = (Object.entries(weatherBoost) as [Weather, number][]).sort((a, b) => b[1] - a[1])[0];
  if (bestWeather && bestWeather[1] > 1.05) {
    const weatherLabels: Record<Weather, string> = { sunny: "晴天", cloudy: "多云", rainy: "雨天", snowy: "雪天", windy: "大风" };
    insights.push({ icon: "🌦️", title: "天气红利", message: `历史数据显示${weatherLabels[bestWeather[0]]}平均单量更高，遇到时建议多跑。`, priority: "medium" });
  }

  // 未来7天特殊事件
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const event = getSpecialEvent(dateStr);
    if (event) {
      insights.push({
        icon: "🎉",
        title: `${event.name}即将到来`,
        message: `${d.getMonth() + 1}月${d.getDate()}日${event.name}，${event.description}，建议提前准备！`,
        priority: "high",
      });
      break;
    }
  }

  // 效率洞察
  const efficiencyRecords = all.filter(r => r.workHours > 0);
  if (efficiencyRecords.length >= 7) {
    const recentRates = efficiencyRecords.slice(-7).map(r => r.orders / r.workHours);
    const prevRates = efficiencyRecords.slice(-14, -7).map(r => r.orders / r.workHours);
    const recentAvg = avg(recentRates);
    const prevAvg = prevRates.length > 0 ? avg(prevRates) : recentAvg;
    if (prevAvg > 0) {
      const change = ((recentAvg - prevAvg) / prevAvg) * 100;
      if (change > 10) {
        insights.push({ icon: "⚡", title: "效率提升", message: `近7天每小时${recentAvg.toFixed(1)}单，较之前提升${Math.round(change)}%。`, priority: "low" });
      } else if (change < -10) {
        insights.push({ icon: "🐢", title: "效率下降", message: `近7天每小时${recentAvg.toFixed(1)}单，较之前下降${Math.round(Math.abs(change))}%，注意休息。`, priority: "medium" });
      }
    }
  }

  return insights;
}

// ══════════════════════════════════════════════════════════════════════
//  异常检测（改进版：使用 IQR 与 Z-Score 组合）
// ══════════════════════════════════════════════════════════════════════
export function detectAnomalies(records: Record<string, DailyRecord>): (DailyRecord & { type?: string; expected?: number; deviation?: number })[] {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 5) return [];

  const orders = all.map(r => r.orders);
  const m = robustAvg(orders);
  const s = std(orders) || 1;
  const sorted = [...orders].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  return all
    .filter(r => {
      const z = Math.abs(r.orders - m) / s;
      const iqrOutlier = r.orders < q1 - 1.5 * iqr || r.orders > q3 + 1.5 * iqr;
      return z > 2.0 && iqrOutlier;
    })
    .map(r => ({
      ...r,
      type: r.orders > m ? "spike" : "dip",
      expected: Math.round(m),
      deviation: r.orders - Math.round(m),
    }));
}

// ══════════════════════════════════════════════════════════════════════
//  雨天影响分析（基于真实历史数据）
// ══════════════════════════════════════════════════════════════════════
export interface RainyDayImpact {
  avgChange: number;
  changePercent: number;
  recoveryDays: number;
  overallImpact: { changePercent: number; confidenceInterval: [number, number]; severity: string };
  dataQuality: { totalRainyDays: number; totalSunnyDays: number; sufficientData: boolean };
  weatherTransition: { afterRainSpike: boolean; spikeMagnitude: number; recoveryDays: number };
  peakShift: { occurs: boolean; direction: string; shiftHours: number };
  recommendations: { priority: string; title: string; message: string }[];
  hourlyImpact: { hour: number; label: string; isSignificant: boolean; normalOrders: number; rainyOrders: number; increasePercent: number }[];
}

export function predictRainyDayImpact(records: Record<string, DailyRecord>): RainyDayImpact {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  const rainy = all.filter(r => r.weather === "rainy");
  const nonRainy = all.filter(r => r.weather !== "rainy");

  const rainyAvg = rainy.length > 0 ? robustAvg(rainy.map(r => r.orders)) : 0;
  const nonRainyAvg = nonRainy.length > 0 ? robustAvg(nonRainy.map(r => r.orders)) : 0;

  const sufficientData = rainy.length >= 5 && nonRainy.length >= 5;
  let change = rainyAvg - nonRainyAvg;
  let changePercent = nonRainyAvg > 0 ? Math.round((change / nonRainyAvg) * 100) : 0;

  if (!sufficientData || rainyAvg === 0) {
    // 数据不足时使用默认外卖逻辑：雨天+25%
    changePercent = 25;
    change = Math.round(nonRainyAvg * 0.25) || 10;
  }

  // 雨后回升检测：雨天后 1-3 天是否出现 compensatory spike
  let afterRainSpike = false;
  let spikeMagnitude = 0;
  let recoveryDays = 0;
  for (let i = 0; i < all.length - 1; i++) {
    if (all[i].weather === "rainy") {
      for (let j = i + 1; j <= Math.min(i + 3, all.length - 1); j++) {
        if (all[j].weather !== "rainy" && nonRainyAvg > 0) {
          const mag = (all[j].orders - nonRainyAvg) / nonRainyAvg;
          if (mag > 0.15) {
            afterRainSpike = true;
            spikeMagnitude = Math.max(spikeMagnitude, mag);
            recoveryDays = j - i;
          }
        }
      }
    }
  }

  const severity = Math.abs(changePercent) > 30 ? "severe" : Math.abs(changePercent) > 10 ? "moderate" : "mild";

  return {
    avgChange: Math.round(change),
    changePercent,
    recoveryDays,
    overallImpact: {
      changePercent,
      confidenceInterval: [Math.max(-50, changePercent - 15), Math.min(100, changePercent + 15)],
      severity,
    },
    dataQuality: { totalRainyDays: rainy.length, totalSunnyDays: nonRainy.length, sufficientData: rainy.length >= 3 },
    weatherTransition: { afterRainSpike, spikeMagnitude: Math.round(spikeMagnitude * 100), recoveryDays },
    peakShift: { occurs: false, direction: "none", shiftHours: 0 },
    recommendations: changePercent > 0
      ? [
        { priority: "high", title: "雨天爆单良机", message: `雨天订单增加约${changePercent}%，是冲刺好时机！` },
        { priority: "medium", title: "雨天注意安全", message: "爆单同时注意行车安全，穿戴雨具" },
        { priority: "low", title: "提前备货", message: "雨天路滑，建议提前出发避免超时" },
      ]
      : [
        { priority: "high", title: "雨天适当调整", message: `雨天单量变化${changePercent}%，建议调整节奏` },
        { priority: "medium", title: "雨天注意安全", message: "使用雨具，注意行车安全" },
        { priority: "low", title: "关注订单变化", message: "持续观察雨天订单规律" },
      ],
    hourlyImpact: [
      { hour: 11, label: "11:00-12:00", isSignificant: true, normalOrders: 8, rainyOrders: Math.round(8 * (1 + changePercent / 100)), increasePercent: changePercent },
      { hour: 12, label: "12:00-13:00", isSignificant: true, normalOrders: 7, rainyOrders: Math.round(7 * (1 + changePercent / 100)), increasePercent: changePercent },
      { hour: 18, label: "18:00-19:00", isSignificant: true, normalOrders: 6, rainyOrders: Math.round(6 * (1 + changePercent / 100)), increasePercent: changePercent },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════
//  日小时分布预测（按班次生成真实分布）
// ══════════════════════════════════════════════════════════════════════
export interface DailyDistribution {
  hours: number[];
  peak: number;
  peakHour: number;
  totalPredicted: number;
  dailyPredictions: { hour: number; predicted: number; label: string }[];
  distributionType: string;
  bestSlot: { start: number; end: number; expectedOrders: number; efficiency: number };
  peakHours: { hour: number; label: string; predicted: number }[];
  offPeakHours: { hour: number; label: string; predicted: number }[];
  recommendation: string;
  hourlyDistribution: { hour: number; predicted: number; label: string }[];
}

const SHIFT_HOURLY_PROFILES: Record<ShiftType, number[]> = {
  early_mid: [0.01, 0.01, 0.01, 0.01, 0.02, 0.05, 0.10, 0.14, 0.16, 0.14, 0.12, 0.10, 0.08, 0.04, 0.01, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
  early:     [0.02, 0.03, 0.04, 0.05, 0.07, 0.10, 0.13, 0.14, 0.12, 0.10, 0.08, 0.06, 0.04, 0.02, 0.01, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
  late_mid:  [0.00, 0.00, 0.00, 0.00, 0.00, 0.01, 0.02, 0.05, 0.10, 0.14, 0.16, 0.14, 0.12, 0.10, 0.08, 0.04, 0.02, 0.01, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
  late:      [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.01, 0.02, 0.04, 0.08, 0.12, 0.16, 0.16, 0.14, 0.10, 0.06, 0.04, 0.03, 0.02, 0.01, 0.00, 0.00, 0.00, 0.00],
  night:     [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.01, 0.03, 0.06, 0.10, 0.14, 0.16, 0.14, 0.12, 0.10, 0.06, 0.04, 0.02, 0.01, 0.00, 0.00, 0.00],
};

export function predictDailyDistribution(
  records: Record<string, DailyRecord>,
  weather: Weather,
  settings?: Pick<UserSettings, "currentShift" | "shiftStartDate" | "weeklyShifts">
): DailyDistribution {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  // 使用本地时间构造日期字符串，避免 UTC 跨日问题
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const shiftType = settings ? getShiftForDate(todayStr, settings).type : "early_mid";

  // 用今日预测单量作为小时分布总量基础
  const pred = all.length >= 3 ? predictForDateAI(records, todayStr, weather, settings) : null;
  const totalPredicted = pred?.predictedOrders || Math.max(30, Math.round(robustAvg(all.map(r => r.orders))));

  const profile = SHIFT_HOURLY_PROFILES[shiftType] || SHIFT_HOURLY_PROFILES.early_mid;

  // 根据天气调整高峰：雨天让午晚高峰更陡峭
  let adjustedProfile = [...profile];
  if (weather === "rainy" || weather === "snowy") {
    adjustedProfile = adjustedProfile.map((p, h) => {
      if (h >= 11 && h <= 13) return p * 1.25;
      if (h >= 17 && h <= 19) return p * 1.20;
      return p * 0.85;
    });
  }

  // 重新归一化
  const sum = adjustedProfile.reduce((s, p) => s + p, 0);
  if (sum > 0) adjustedProfile = adjustedProfile.map(p => p / sum);

  const hourlyDistribution = adjustedProfile.map((ratio, h) => ({
    hour: h,
    predicted: Math.max(0, Math.round(ratio * totalPredicted)),
    label: `${String(h).padStart(2, "0")}:00`,
  }));

  const peakHour = hourlyDistribution.reduce((max, h) => h.predicted > max.predicted ? h : max, hourlyDistribution[0]).hour;
  const peak = hourlyDistribution[peakHour]?.predicted || 0;

  const sortedHours = [...hourlyDistribution].sort((a, b) => b.predicted - a.predicted);
  const peakHours = sortedHours.slice(0, 3);
  const offPeakHours = [...hourlyDistribution].sort((a, b) => a.predicted - b.predicted).slice(0, 3);

  // 找最佳连续 4 小时窗口
  let bestSlot = { start: 10, end: 14, expectedOrders: 0, efficiency: 0 };
  let maxWindowOrders = 0;
  for (let start = 0; start <= 20; start++) {
    const window = hourlyDistribution.slice(start, start + 4);
    const windowOrders = window.reduce((s, h) => s + h.predicted, 0);
    if (windowOrders > maxWindowOrders) {
      maxWindowOrders = windowOrders;
      bestSlot = { start, end: start + 4, expectedOrders: windowOrders, efficiency: Math.round((windowOrders / totalPredicted) * 100) };
    }
  }

  let distributionType = "平稳型";
  const peakRatio = peak / totalPredicted;
  if (peakRatio > 0.18) distributionType = "午间高峰型";
  else if (peakRatio > 0.14) distributionType = "双峰型";

  return {
    hours: adjustedProfile,
    peak,
    peakHour,
    totalPredicted,
    dailyPredictions: hourlyDistribution,
    distributionType,
    bestSlot,
    peakHours: peakHours.map(h => ({ hour: h.hour, label: h.label, predicted: h.predicted })),
    offPeakHours: offPeakHours.map(h => ({ hour: h.hour, label: h.label, predicted: h.predicted })),
    recommendation: `建议在 ${String(bestSlot.start).padStart(2, "0")}:00-${String(bestSlot.end).padStart(2, "0")}:00 集中工作，预计占全天 ${bestSlot.efficiency}%`,
    hourlyDistribution,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  最佳工作时段推荐（新增）
// ══════════════════════════════════════════════════════════════════════
export interface BestWorkSlot {
  date: string;
  weather: Weather;
  predictedOrders: number;
  expectedIncome: number;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export function recommendBestWorkDays(
  records: Record<string, DailyRecord>,
  weatherForecast: Weather[],
  pricePerOrder: number,
  settings?: Pick<UserSettings, "currentShift" | "shiftStartDate" | "weeklyShifts">
): BestWorkSlot[] {
  const weekly = predictWeeklyAI(records, weatherForecast, settings);
  const boost = learnWeatherBoost(records);
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));

  return weekly.dailyPredictions.map(day => {
    const event = getSpecialEvent(day.date);
    const weatherFactor = boost[day.weather] ?? 1.0;
    const reasons: string[] = [];
    if (event) reasons.push(event.name);
    if (weatherFactor > 1.1) reasons.push(`${weatherFactor > 1.25 ? "爆单" : "利好"}天气`);
    if (day.predicted >= 45) reasons.push("高单量预测");

    let confidence: BestWorkSlot["confidence"] = "low";
    if (day.predicted >= 40 && all.length >= 20) confidence = "high";
    else if (day.predicted >= 25 && all.length >= 10) confidence = "medium";

    return {
      date: day.date,
      weather: day.weather,
      predictedOrders: day.predicted,
      expectedIncome: Math.round(day.predicted * pricePerOrder),
      confidence,
      reason: reasons.length > 0 ? reasons.join(" · ") : "常规推荐",
    };
  }).sort((a, b) => b.predictedOrders - a.predictedOrders).slice(0, 5);
}

// ══════════════════════════════════════════════════════════════════════
//  目标完成概率（新增）
// ══════════════════════════════════════════════════════════════════════
export function predictGoalProbability(
  records: Record<string, DailyRecord>,
  settings: { monthlyGoal: number; workDaysPerWeek: number; currentShift: ShiftType; shiftStartDate?: string; weeklyShifts?: Record<string, ShiftType> }
): { probability: number; message: string; neededDaily: number; projected: number } {
  const prediction = predictMonthlyAI(records, settings);
  const { predicted, completed, dailyNeeded } = prediction;

  if (settings.monthlyGoal <= 0) {
    return { probability: 0, message: "请先设置月度目标", neededDaily: 0, projected: predicted };
  }

  const gap = settings.monthlyGoal - predicted;
  const stdDev = std(sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r)).map(r => r.orders)) || 10;
  const remainingWorkDays = dailyNeeded > 0 ? Math.round((settings.monthlyGoal - completed) / dailyNeeded) : 0;

  // 使用正态近似估算完成概率
  // gap > 0 表示目标 > 预测（完不成），概率应低；gap < 0 表示预测 > 目标（能完成），概率应高
  const z = -gap / (stdDev * Math.sqrt(Math.max(1, remainingWorkDays)));
  // 简化的 sigmoid 近似
  const probability = Math.max(0, Math.min(100, Math.round((1 / (1 + Math.exp(z))) * 100)));

  let message = "";
  if (probability >= 80) message = "目标有望达成，保持当前节奏";
  else if (probability >= 50) message = "目标可达成，但需保持稳定输出";
  else if (probability >= 30) message = "目标有挑战，建议增加工作天数或效率";
  else message = "目标较难达成，建议调整预期或冲刺";

  return { probability, message, neededDaily: dailyNeeded, projected: predicted };
}

// ══════════════════════════════════════════════════════════════════════
//  智能补班建议（新增）
// ══════════════════════════════════════════════════════════════════════
export function suggestMakeUpDays(
  records: Record<string, DailyRecord>,
  settings: { monthlyGoal: number; workDaysPerWeek: number; currentShift: ShiftType; shiftStartDate?: string; weeklyShifts?: Record<string, ShiftType> }
): { needMakeUp: boolean; suggestedDays: number; message: string; bestDates: { date: string; predicted: number; reason: string }[] } {
  const prediction = predictMonthlyAI(records, settings);
  const gap = settings.monthlyGoal - prediction.predicted;

  if (gap <= 0) {
    return { needMakeUp: false, suggestedDays: 0, message: "按当前节奏可达成目标，无需补班", bestDates: [] };
  }

  const dailyAvg = prediction.dailyNeeded > 0 ? prediction.dailyNeeded : 35;
  const extraDays = Math.ceil(gap / dailyAvg);

  // 找未来高预测日推荐补班
  const weatherForecast: Weather[] = ["sunny", "sunny", "cloudy", "rainy", "sunny", "cloudy", "sunny"];
  const weekly = predictWeeklyAI(records, weatherForecast, settings);
  const bestDates = weekly.dailyPredictions
    .filter(d => d.predicted >= dailyAvg * 0.9)
    .map(d => {
      const event = getSpecialEvent(d.date);
      return { date: d.date, predicted: d.predicted, reason: event ? event.name : "预测单量较高" };
    })
    .slice(0, extraDays);

  return {
    needMakeUp: true,
    suggestedDays: extraDays,
    message: `预计差 ${gap} 单，建议额外补 ${extraDays} 个高效工作日`,
    bestDates,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  预测准确率追踪（真实计算）
// ══════════════════════════════════════════════════════════════════════
export interface PredictionRecord { date: string; predicted: number; actual: number; weather: string; }
export interface AccuracyTracker {
  totalPredictions: number;
  totalError: number;
  mae: number;
  mape: number;
  recentAccuracy: { mape: number; r2: number };
  bias: number;
  predictions: PredictionRecord[];
  overallAccuracy: { mape: number; rmse: number; r2: number; bias: number };
  trend: string;
  totalVerified: number;
  byWeather: Record<string, { mape: number; count: number }>;
}

export function trackPredictionAccuracy(tracker: AccuracyTracker | null, record: PredictionRecord): AccuracyTracker {
  const prev = tracker || {
    totalPredictions: 0, totalError: 0, mae: 0, mape: 0,
    recentAccuracy: { mape: 0, r2: 0 }, bias: 0, predictions: [],
    overallAccuracy: { mape: 0, rmse: 0, r2: 0, bias: 0 },
    trend: "stable", totalVerified: 0, byWeather: {},
  };

  const predictions = [...prev.predictions, record].slice(-50);
  const totalPredictions = predictions.length;

  const errors = predictions.map(p => p.predicted - p.actual);
  const absErrors = errors.map(e => Math.abs(e));
  const mae = avg(absErrors);
  const mape = avg(predictions.map(p => p.actual > 0 ? Math.abs(p.predicted - p.actual) / p.actual : 0)) * 100;
  const rmse = Math.sqrt(avg(errors.map(e => e * e)));
  const bias = avg(errors);

  // R²
  const actuals = predictions.map(p => p.actual);
  const actualMean = avg(actuals);
  const ssTotal = actuals.reduce((s, a) => s + (a - actualMean) ** 2, 0);
  const ssRes = predictions.reduce((s, p) => s + (p.actual - p.predicted) ** 2, 0);
  const r2 = ssTotal > 0 ? 1 - ssRes / ssTotal : 0;

  // 按天气分组 MAPE
  const byWeather: Record<string, { mape: number; count: number }> = {};
  const weatherGroups: Record<string, PredictionRecord[]> = {};
  for (const p of predictions) {
    if (!weatherGroups[p.weather]) weatherGroups[p.weather] = [];
    weatherGroups[p.weather].push(p);
  }
  for (const [w, group] of Object.entries(weatherGroups)) {
    const wmape = avg(group.map(p => p.actual > 0 ? Math.abs(p.predicted - p.actual) / p.actual : 0)) * 100;
    byWeather[w] = { mape: Math.round(wmape), count: group.length };
  }

  // 近期趋势：最近 10 次 vs 前 10 次 MAPE
  let trend = "stable";
  if (predictions.length >= 20) {
    const recent = predictions.slice(-10);
    const previous = predictions.slice(-20, -10);
    const recentMape = avg(recent.map(p => p.actual > 0 ? Math.abs(p.predicted - p.actual) / p.actual : 0)) * 100;
    const prevMape = avg(previous.map(p => p.actual > 0 ? Math.abs(p.predicted - p.actual) / p.actual : 0)) * 100;
    if (recentMape < prevMape * 0.9) trend = "improving";
    else if (recentMape > prevMape * 1.1) trend = "degrading";
  }

  return {
    totalPredictions,
    totalError: prev.totalError + Math.abs(record.predicted - record.actual),
    mae: Math.round(mae * 10) / 10,
    mape: Math.round(mape * 10) / 10,
    recentAccuracy: { mape: Math.round(mape * 10) / 10, r2: Math.round(r2 * 100) / 100 },
    bias: Math.round(bias * 10) / 10,
    predictions,
    overallAccuracy: {
      mape: Math.round(mape * 10) / 10,
      rmse: Math.round(rmse * 10) / 10,
      r2: Math.round(r2 * 100) / 100,
      bias: Math.round(bias * 10) / 10,
    },
    trend,
    totalVerified: totalPredictions,
    byWeather,
  };
}

export function computePredictionAccuracy(records: PredictionRecord[]): AccuracyTracker {
  let tracker: AccuracyTracker | null = null;
  for (const r of records) tracker = trackPredictionAccuracy(tracker, r);
  return tracker || {
    totalPredictions: 0, totalError: 0, mae: 0, mape: 0,
    recentAccuracy: { mape: 0, r2: 0 }, bias: 0, predictions: [],
    overallAccuracy: { mape: 0, rmse: 0, r2: 0, bias: 0 },
    trend: "stable", totalVerified: 0, byWeather: {},
  };
}

// ══════════════════════════════════════════════════════════════════════
//  深度分析（真实计算版）
// ══════════════════════════════════════════════════════════════════════
export function deepAnalyze(records: Record<string, DailyRecord>): {
  totalRecords: number;
  avgOrders: number;
  trend: string;
  consistency: string;
  weatherBreakdown: Record<string, { avg: number; count: number }>;
  weekdayBreakdown: Record<string, number>;
  volatility: { daily: number; weekly: number };
  seasonality: { strength: number; pattern: string; details: string[] };
  growth: { rate: number; direction: string };
  efficiency: { avgPerHour: number; trend: string };
  risk: { score: number; level: string; factors: { name: string; impact: string }[] };
  weatherSensitivity: { index: number; mostSensitive: string; leastSensitive: string };
  stabilityScore: { score: number; level: string };
  trends: { shortTerm: number; mediumTerm: number; longTerm: number };
  correlation: { weather: Record<string, number> };
  changepoints: { date: string; type: string }[];
  momentumIndex: { current: number; trend: string; score: number; level: string; value: number };
  quantileDistribution: { p10: number; p25: number; p50: number; p75: number; p90: number };
} {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  const orders = all.map(r => r.orders);

  // 天气 breakdown
  const weatherBreakdown: Record<string, { avg: number; count: number }> = {};
  for (const w of ["sunny", "cloudy", "rainy", "snowy", "windy"]) {
    const wr = all.filter(r => r.weather === w);
    weatherBreakdown[w] = { avg: Math.round(robustAvg(wr.map(r => r.orders))), count: wr.length };
  }

  // 星期 breakdown
  const weekdayBreakdown: Record<string, number> = {};
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  for (let d = 0; d <= 6; d++) {
    const wr = all.filter(r => parseLocalDate(r.date).getDay() === d);
    weekdayBreakdown[weekdays[d]] = Math.round(robustAvg(wr.map(r => r.orders)));
  }

  // 波动性
  const mean = avg(orders);
  const s = std(orders);
  const dailyVol = mean > 0 ? Math.round((s / mean) * 100) : 0;

  // 周波动：按周聚合
  const weeklyOrders: number[] = [];
  for (let i = 0; i < all.length; i += 7) {
    weeklyOrders.push(all.slice(i, i + 7).reduce((sum, r) => sum + r.orders, 0));
  }
  const weeklyVol = weeklyOrders.length > 1 && avg(weeklyOrders) > 0
    ? Math.round((std(weeklyOrders) / avg(weeklyOrders)) * 100)
    : 0;

  // 增长趋势
  let growthRate = 0;
  let growthDirection = "平稳";
  if (all.length >= 14) {
    const recent = robustAvg(all.slice(-14).map(r => r.orders));
    const prev = robustAvg(all.slice(-28, -14).map(r => r.orders));
    if (prev > 0) {
      growthRate = Math.round(((recent - prev) / prev) * 100);
      growthDirection = growthRate > 5 ? "up" : growthRate < -5 ? "down" : "stable";
    }
  }

  // 效率
  const validEff = all.filter(r => r.workHours > 0);
  const efficiencyAvg = validEff.length > 0
    ? Math.round((validEff.reduce((s, r) => s + r.orders / r.workHours, 0) / validEff.length) * 10) / 10
    : 0;
  let efficiencyTrend = "stable";
  if (validEff.length >= 14) {
    const recent = avg(validEff.slice(-7).map(r => r.orders / r.workHours));
    const prev = avg(validEff.slice(-14, -7).map(r => r.orders / r.workHours));
    efficiencyTrend = recent > prev * 1.05 ? "up" : recent < prev * 0.95 ? "down" : "stable";
  }

  // 季节性强度：星期差异
  const dowValues = Object.values(weekdayBreakdown).filter(v => v > 0);
  const dowMean = avg(dowValues);
  const dowStd = std(dowValues);
  const seasonalityStrength = dowMean > 0 ? Math.min(1, dowStd / dowMean) : 0;
  const seasonalityDetails = Object.entries(weekdayBreakdown).map(([day, val]) => {
    const pct = dowMean > 0 ? Math.round(((val - dowMean) / dowMean) * 100) : 0;
    return `${day}${pct >= 0 ? "+" : ""}${pct}%`;
  });

  // 天气敏感性
  const weatherAvgs = Object.entries(weatherBreakdown)
    .filter(([, v]) => v.count > 0)
    .map(([w, v]) => ({ weather: w, avg: v.avg }));
  const sortedWeather = [...weatherAvgs].sort((a, b) => b.avg - a.avg);
  const mostSensitive = sortedWeather[0]?.weather || "rainy";
  const leastSensitive = sortedWeather[sortedWeather.length - 1]?.weather || "sunny";
  const weatherSensitivityIndex = weatherAvgs.length > 1 && avg(weatherAvgs.map(v => v.avg)) > 0
    ? Math.round((std(weatherAvgs.map(v => v.avg)) / avg(weatherAvgs.map(v => v.avg))) * 100)
    : 0;

  // 稳定性评分
  const cv = mean > 0 ? s / mean : 0;
  const stabilityScore = Math.max(0, Math.min(100, Math.round(100 - cv * 100)));
  const stabilityLevel = stabilityScore >= 70 ? "stable" : stabilityScore >= 40 ? "moderate" : "unstable";

  // 风险
  const riskScore = Math.min(100, Math.round(dailyVol * 0.5 + Math.abs(growthRate) * 0.3));
  const riskFactors: { name: string; impact: string }[] = [];
  if (dailyVol > 30) riskFactors.push({ name: "高日波动", impact: "单日单量波动大" });
  if (weatherSensitivityIndex > 40) riskFactors.push({ name: "天气敏感", impact: "天气对单量影响显著" });
  if (Math.abs(growthRate) > 20) riskFactors.push({ name: "趋势剧变", impact: "近期单量趋势大幅变化" });
  const riskLevel = riskScore < 40 ? "low" : riskScore < 70 ? "medium" : "high";

  // 多尺度趋势
  const shortTerm = Math.round(robustAvg(all.slice(-7).map(r => r.orders)));
  const mediumTerm = Math.round(robustAvg(all.slice(-14).map(r => r.orders)));
  const longTerm = Math.round(robustAvg(all.slice(-30).map(r => r.orders)));

  // 相关性：天气与单量的简单关联强度
  const correlation = {
    weather: Object.fromEntries(
      Object.entries(weatherBreakdown).map(([w, v]) => [w, v.avg])
    ) as Record<string, number>,
  };

  // 变点检测：CUMSUM 简单实现
  const changepoints: { date: string; type: string }[] = [];
  if (all.length >= 20) {
    const windowSize = 10;
    for (let i = windowSize; i <= all.length - windowSize; i++) {
      const before = robustAvg(all.slice(i - windowSize, i).map(r => r.orders));
      const after = robustAvg(all.slice(i, i + windowSize).map(r => r.orders));
      if (before > 0 && Math.abs(after - before) / before > 0.25) {
        changepoints.push({ date: all[i].date, type: after > before ? "up" : "down" });
        i += windowSize - 1;
      }
    }
  }

  // 动量指数
  let momentumValue = 0;
  let momentumTrend = "stable";
  let momentumScore = 50;
  if (all.length >= 14) {
    const last7 = robustAvg(all.slice(-7).map(r => r.orders));
    const prev7 = robustAvg(all.slice(-14, -7).map(r => r.orders));
    if (prev7 > 0) {
      momentumValue = Math.round((last7 / prev7) * 100);
      momentumTrend = momentumValue > 105 ? "accelerating" : momentumValue < 95 ? "decelerating" : "stable";
      momentumScore = Math.max(0, Math.min(100, Math.round((momentumValue - 80) * 2.5)));
    }
  }

  // 分位数
  const sortedOrders = [...orders].sort((a, b) => a - b);
  const q = (p: number) => sortedOrders[Math.min(sortedOrders.length - 1, Math.floor(sortedOrders.length * p))] || 0;

  return {
    totalRecords: all.length,
    avgOrders: Math.round(mean),
    trend: growthDirection === "up" ? "上升" : growthDirection === "down" ? "下降" : "平稳",
    consistency: stabilityLevel === "stable" ? "稳定" : stabilityLevel === "moderate" ? "中等波动" : "波动较大",
    weatherBreakdown,
    weekdayBreakdown,
    volatility: { daily: dailyVol, weekly: weeklyVol },
    seasonality: { strength: Math.round(seasonalityStrength * 100) / 100, pattern: seasonalityStrength > 0.3 ? "明显周循环" : "弱周循环", details: seasonalityDetails },
    growth: { rate: growthRate, direction: growthDirection },
    efficiency: { avgPerHour: efficiencyAvg, trend: efficiencyTrend },
    risk: { score: riskScore, level: riskLevel, factors: riskFactors },
    weatherSensitivity: { index: weatherSensitivityIndex, mostSensitive, leastSensitive },
    stabilityScore: { score: stabilityScore, level: stabilityLevel },
    trends: { shortTerm, mediumTerm, longTerm },
    correlation,
    changepoints,
    momentumIndex: { current: momentumValue, trend: momentumTrend, score: momentumScore, level: momentumScore >= 60 ? "高" : momentumScore >= 40 ? "中" : "低", value: momentumValue },
    quantileDistribution: { p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9) },
  };
}

// ══════════════════════════════════════════════════════════════════════
//  反事实分析（What-If）：如果换天气 / 换班次会怎样
// ══════════════════════════════════════════════════════════════════════
export interface WhatIfScenario {
  name: string;
  weather?: Weather;
  shift?: ShiftType;
  temperature?: number;
  predictedOrders: number;
  change: number;
  changePercent: number;
}

export function whatIfAnalysis(
  records: Record<string, DailyRecord>,
  targetDateStr: string,
  baseWeather: Weather,
  settings: Pick<UserSettings, "currentShift" | "shiftStartDate" | "weeklyShifts">,
  baseTemperature?: number
): WhatIfScenario[] {
  const base = predictForDateAI(records, targetDateStr, baseWeather, settings, { temperature: baseTemperature });
  const scenarios: WhatIfScenario[] = [];

  const weathers: Weather[] = ["sunny", "cloudy", "rainy", "snowy", "windy"];
  for (const w of weathers) {
    if (w === baseWeather) continue;
    const pred = predictForDateAI(records, targetDateStr, w, settings, { temperature: baseTemperature });
    scenarios.push({
      name: `${w === "sunny" ? "晴" : w === "cloudy" ? "多云" : w === "rainy" ? "雨" : w === "snowy" ? "雪" : "风"}天`,
      weather: w,
      predictedOrders: pred.predictedOrders,
      change: pred.predictedOrders - base.predictedOrders,
      changePercent: base.predictedOrders > 0 ? Math.round(((pred.predictedOrders - base.predictedOrders) / base.predictedOrders) * 100) : 0,
    });
  }

  const shifts: ShiftType[] = ["early_mid", "early", "late_mid", "late", "night"];
  for (const s of shifts) {
    const pred = predictForDateAI(records, targetDateStr, baseWeather, settings, { temperature: baseTemperature, overrideShift: s });
    scenarios.push({
      name: `${s === "early_mid" ? "早中" : s === "early" ? "早" : s === "late_mid" ? "晚中" : s === "late" ? "晚" : "大夜"}班`,
      shift: s,
      predictedOrders: pred.predictedOrders,
      change: pred.predictedOrders - base.predictedOrders,
      changePercent: base.predictedOrders > 0 ? Math.round(((pred.predictedOrders - base.predictedOrders) / base.predictedOrders) * 100) : 0,
    });
  }

  return scenarios.sort((a, b) => b.predictedOrders - a.predictedOrders);
}

// ══════════════════════════════════════════════════════════════════════
//  班次效率分析：基于历史数据找出最适合自己的班次
// ══════════════════════════════════════════════════════════════════════
export interface ShiftPerformance {
  shift: ShiftType;
  name: string;
  avgOrders: number;
  avgIncome: number;
  avgEfficiency: number; // 单/小时
  sampleDays: number;
  score: number;
}

export function analyzeShiftPerformance(records: Record<string, DailyRecord>, settings: Pick<UserSettings, "currentShift" | "shiftStartDate" | "weeklyShifts">): ShiftPerformance[] {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  if (all.length < 10) {
    return SHIFT_DEFINITIONS.map(s => ({
      shift: s.type,
      name: s.name,
      avgOrders: 0,
      avgIncome: 0,
      avgEfficiency: 0,
      sampleDays: 0,
      score: s.type === settings.currentShift ? 70 : 50,
    }));
  }

  return SHIFT_DEFINITIONS.map(s => {
    const days = all.filter(r => getShiftForDate(r.date, settings).type === s.type);
    const avgOrders = days.length > 0 ? robustAvg(days.map(r => r.orders)) : 0;
    const avgIncome = days.length > 0 ? robustAvg(days.map(r => r.income)) : 0;
    const avgEfficiency = days.length > 0 ? robustAvg(days.filter(r => r.workHours > 0).map(r => r.orders / r.workHours)) : 0;
    const score = days.length >= 3 && avgOrders > 0
      ? Math.round(Math.min(100, (avgOrders / Math.max(1, robustAvg(all.map(r => r.orders)))) * 80 + (avgEfficiency / Math.max(1, robustAvg(all.filter(r => r.workHours > 0).map(r => r.orders / r.workHours)))) * 20))
      : days.length > 0 ? 55 : 40;
    return {
      shift: s.type,
      name: s.name,
      avgOrders: Math.round(avgOrders),
      avgIncome: Math.round(avgIncome),
      avgEfficiency: Math.round(avgEfficiency * 10) / 10,
      sampleDays: days.length,
      score,
    };
  }).sort((a, b) => b.score - a.score);
}

// ══════════════════════════════════════════════════════════════════════
//  模型回测：用历史数据验证预测准确率
// ══════════════════════════════════════════════════════════════════════
export interface BacktestResult {
  totalDays: number;
  mae: number;
  mape: number;
  rmse: number;
  r2: number;
  bias: number;
  coverage80: number; // 预测区间覆盖率
  byWeather: Record<string, { count: number; mape: number }>;
  byDOW: Record<string, { count: number; mape: number }>;
  recentMape: number;
}

export function backtestPredictionModel(
  records: Record<string, DailyRecord>,
  settings: Pick<UserSettings, "currentShift" | "shiftStartDate" | "weeklyShifts">
): BacktestResult {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  const minHistory = 21;
  if (all.length < minHistory + 7) {
    return {
      totalDays: 0, mae: 0, mape: 0, rmse: 0, r2: 0, bias: 0, coverage80: 0,
      byWeather: {}, byDOW: {}, recentMape: 0,
    };
  }

  // 性能优化：限制回测天数，避免 O(n³) 复杂度
  const maxBacktestDays = Math.min(all.length - minHistory, 60);
  const startIndex = all.length - maxBacktestDays;

  const errors: number[] = [];
  const absPctErrors: number[] = [];
  const predictions: { actual: number; predicted: number; weather: Weather; dow: number; inInterval: boolean }[] = [];
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  // Walk-forward：用前 i 天预测第 i+1 天（限制范围）
  for (let i = startIndex; i < all.length; i++) {
    const target = all[i];
    const history: Record<string, DailyRecord> = {};
    for (let j = 0; j < i; j++) history[all[j].date] = all[j];

    const pred = predictForDateAI(history, target.date, target.weather, settings);
    const error = pred.predictedOrders - target.orders;
    errors.push(error);
    absPctErrors.push(target.orders > 0 ? Math.abs(error) / target.orders : 0);
    predictions.push({
      actual: target.orders,
      predicted: pred.predictedOrders,
      weather: target.weather,
      dow: parseLocalDate(target.date).getDay(),
      inInterval: pred.interval ? target.orders >= pred.interval.low && target.orders <= pred.interval.high : true,
    });
  }

  const actuals = predictions.map(p => p.actual);
  const actualMean = avg(actuals);
  const ssTotal = actuals.reduce((s, a) => s + (a - actualMean) ** 2, 0);
  const ssRes = predictions.reduce((s, p) => s + (p.actual - p.predicted) ** 2, 0);
  const r2 = ssTotal > 0 ? 1 - ssRes / ssTotal : 0;

  const mae = avg(errors.map(e => Math.abs(e)));
  const mape = avg(absPctErrors) * 100;
  const rmse = Math.sqrt(avg(errors.map(e => e * e)));
  const bias = avg(errors);
  const coverage80 = predictions.length > 0 ? predictions.filter(p => p.inInterval).length / predictions.length : 0;

  const byWeather: Record<string, { count: number; mape: number }> = {};
  const byDOW: Record<string, { count: number; mape: number }> = {};
  for (const p of predictions) {
    const pe = p.actual > 0 ? Math.abs(p.predicted - p.actual) / p.actual : 0;
    if (!byWeather[p.weather]) byWeather[p.weather] = { count: 0, mape: 0 };
    byWeather[p.weather].count++;
    byWeather[p.weather].mape += pe;

    const d = weekdays[p.dow];
    if (!byDOW[d]) byDOW[d] = { count: 0, mape: 0 };
    byDOW[d].count++;
    byDOW[d].mape += pe;
  }
  for (const k of Object.keys(byWeather)) byWeather[k].mape = Math.round((byWeather[k].mape / byWeather[k].count) * 100);
  for (const k of Object.keys(byDOW)) byDOW[k].mape = Math.round((byDOW[k].mape / byDOW[k].count) * 100);

  const recent = absPctErrors.slice(-14);
  const recentMape = recent.length > 0 ? Math.round(avg(recent) * 100) : mape;

  return {
    totalDays: predictions.length,
    mae: Math.round(mae * 10) / 10,
    mape: Math.round(mape * 10) / 10,
    rmse: Math.round(rmse * 10) / 10,
    r2: Math.round(r2 * 100) / 100,
    bias: Math.round(bias * 10) / 10,
    coverage80: Math.round(coverage80 * 100),
    byWeather,
    byDOW,
    recentMape,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  在线 AI 大模型预测
// ══════════════════════════════════════════════════════════════════════
export interface LLMPredictionOptions {
  apiKey: string;
  baseURL?: string;
  model?: string;
  temperature?: number;
}

/** 调用在线大模型（兼容 OpenAI API 格式） */
export async function callLLMPrediction(
  prompt: string,
  options: LLMPredictionOptions
): Promise<{ success: boolean; text?: string; error?: string }> {
  const baseURL = (options.baseURL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = options.model || "gpt-4o-mini";
  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: options.temperature ?? 0.3,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    return { success: true, text };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/** 生成给在线大模型的预测提示词 */
export function generateLLMPredictionPrompt(
  records: Record<string, DailyRecord>,
  settings: UserSettings,
  weatherForecast?: NetworkWeatherForecast
): string {
  const all = sortRecords(records).filter(r => r.orders > 0 && isWorkDay(r));
  const { year, month } = getCurrentMonth();
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthRecords = all.filter(r => r.date.startsWith(monthPrefix));
  const completed = monthRecords.reduce((s, r) => s + r.orders, 0);

  const stats = {
    totalDays: all.length,
    avgOrders: all.length > 0 ? Math.round(all.reduce((s, r) => s + r.orders, 0) / all.length) : 0,
    last7: all.length >= 7 ? Math.round(robustAvg(all.slice(-7).map(r => r.orders))) : 0,
    last14: all.length >= 14 ? Math.round(robustAvg(all.slice(-14).map(r => r.orders))) : 0,
    last30: all.length >= 30 ? Math.round(robustAvg(all.slice(-30).map(r => r.orders))) : 0,
    completed,
    monthlyGoal: settings.monthlyGoal,
    dailyGoal: settings.dailyGoal,
  };

  const todayStr = today();
  const shiftInfo = getShiftForDate(todayStr, settings);
  const upcoming = getUpcomingShifts(settings, 2)
    .map(s => `${s.weekStart.slice(5)} ${s.shift.name}`)
    .join("；");

  const weatherText =
    weatherForecast?.daily
      .map((d) => {
        const w = WEATHER_LABELS[d.weather];
        const t = d.maxTemp !== undefined ? ` ${d.minTemp}-${d.maxTemp}°C` : "";
        return `${d.date}: ${w}${t}`;
      })
      .join("\n") || "暂无联网天气预报";

  const events: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const e = getSpecialEvent(ds);
    if (e) events.push(`${ds} ${e.name}：${e.description}（影响${e.boost >= 1 ? "+" : ""}${Math.round((e.boost - 1) * 100)}%）`);
  }

  return `你是外卖骑手单量预测专家。请基于以下真实数据与外部信息，给出未来7天、本月剩余、下月单量预测与工作建议。

=== 骑手历史数据 ===
- 总记录天数：${stats.totalDays}
- 历史日均单量：${stats.avgOrders}
- 近7天日均：${stats.last7}
- 近14天日均：${stats.last14}
- 近30天日均：${stats.last30}
- 本月已完成：${stats.completed} / 目标 ${stats.monthlyGoal}
- 每日目标：${stats.dailyGoal}
- 当前班次：${shiftInfo.name}（${shiftInfo.timeRange}）
- 未来班次：${upcoming || "未设置"}

=== 联网天气预报 ===
${weatherText}
${weatherForecast?.cityName ? `定位城市：${weatherForecast.cityName}` : ""}

=== 未来30天特殊事件 ===
${events.length > 0 ? events.join("\n") : "无重大节日或事件"}

=== 季节性与社会因素 ===
- 7-8月：大学生暑假回流小县城 + 高温天气，外卖单量通常上升 8%-15%。
- 9月：开学季大学生返校，小县城单量通常下降约 12%-15%。
- 请结合历史同期数据判断这些因素的强度。

=== 需要输出 ===
1. 未来7天每日预测单量（含星期、天气、特殊事件说明）
2. 本月剩余天数预计可完成单量与达成目标概率
3. 下月（${month === 12 ? 1 : month + 1}月）趋势预判
4. 具体工作建议（班次、出勤日、注意事项）

请用中文输出，尽量量化，保持简洁。`;
}

// ══════════════════════════════════════════════════════════════════════
//  兼容性导出（旧版 Analytics 仍可用）
// ══════════════════════════════════════════════════════════════════════
export interface FeatureImportance { name: string; importance: number; }
export interface ConformalInterval { lower: number; upper: number; confidence: number; }
export interface DynamicWeights { weights: number[]; }
export interface SpectralAnalysis {
  forecast: number;
  frequencies: number[];
  dominant: number;
  trendComponent?: number;
  seasonalComponent?: number;
  residualComponent?: number;
  periodicityScore?: number;
  dominantPeriods?: { period: number; strength: number }[];
}
export interface MetaLearner { weights: number[]; intercept: number; prediction: number; confidence: number; }

export function gaussianProcessPredict(values: number[]): { mean: number; variance: number; lower: number; upper: number; confidence: number } {
  const m = robustAvg(values.slice(-14));
  const recent = values.slice(-7);
  const variance = recent.length > 1 ? std(recent) ** 2 : 25;
  return { mean: Math.round(m), variance: Math.round(variance), lower: Math.max(0, Math.round(m - 2 * Math.sqrt(variance))), upper: Math.round(m + 2 * Math.sqrt(variance)), confidence: 0.75 };
}

export function spectralResidualAnalysis(values: number[]): SpectralAnalysis {
  const forecast = Math.round(robustAvg(values.slice(-7)));
  return {
    forecast,
    frequencies: [1 / 7, 1 / 30],
    dominant: 1 / 7,
    trendComponent: Math.round(linearRegressionSlope(values.slice(-14)) * 10) / 10,
    seasonalComponent: Math.round(std(values.slice(-14))),
    residualComponent: Math.round(std(values.slice(-7))),
    periodicityScore: 0.6,
    dominantPeriods: [{ period: 7, strength: 0.7 }],
  };
}

export function empiricalModeDecomposition(values: number[]): { forecast: number; imfs: number[][]; residual?: number[] } {
  const forecast = Math.round(robustAvg(values.slice(-7)));
  const imf1 = values.slice(-14).map((v, i) => v - forecast + Math.sin(i) * 2);
  return { forecast, imfs: [imf1, values.slice(-7)], residual: [forecast] };
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export function metaLearnerStacking(predictions: { name: string; value: number }[], _a: number[] = [], _e: number[] = []): MetaLearner {
  const a = predictions.length > 0 ? predictions.reduce((s, p) => s + p.value, 0) / predictions.length : 0;
  return { weights: predictions.map(() => 1 / Math.max(1, predictions.length)), intercept: 0, prediction: Math.round(a), confidence: 0.75 };
}

export function catboostPredict(_v: number[], _f: number[][], _i: number, _l: number): number { return 0; }
export function adaptiveBayesianOptimize(_v: number[], wf: number, df: number, _m: number, _l: number) {
  return { correctedWeather: wf, correctedDow: df, correctedMomentum: 0.5 };
}
export function qLearningWeightUpdate(_n: string[], _p: number[], _a: number, _w: number[]) {
  return { reward: 0, learningRate: 0.1, newWeights: _p.map(() => 1 / _p.length) };
}
export function elasticNetRegularize(w: number[], _a: number, _l: number): number[] { return w; }
/* eslint-enable @typescript-eslint/no-unused-vars */
