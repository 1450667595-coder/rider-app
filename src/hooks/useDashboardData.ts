import { useMemo, useRef } from "react";
import useStore from "@/store/useStore";
import { today, getCurrentMonth, getWeekRange, getPreviousWeekRange } from "@/utils/date";
import { predictTomorrowAI, predictMonthlyAI, generateInsights } from "@/utils/aiPrediction";
import { Weather, WEATHER_LABELS, DailyRecord } from "@/types";

export interface DashboardData {
  todaysRecord: DailyRecord | undefined;
  todayOrders: number;
  todayIncome: number;
  todayGoalPercent: number;
  monthOrders: number;
  monthIncome: number;
  goalProgress: number;
  effectivePrice: number;
  bonusGap: number;
  monthlyPrediction: ReturnType<typeof predictMonthlyAI>;
  predictedIncome: number;
  tomorrowPrediction: ReturnType<typeof predictTomorrowAI>;
  insights: ReturnType<typeof generateInsights>;
  weekComparison: { currOrders: number; prevOrders: number; currDays: number; prevDays: number; change: number };
  monthComparison: { currMOrders: number; prevMOrders: number; change: number };
  weatherComparison: { entries: { weather: Weather; label: string; avg: number; count: number }[]; best?: { weather: Weather; label: string; avg: number; count: number }; worst?: { weather: Weather; label: string; avg: number; count: number } };
  efficiencyData: { avgPerHour: number; bestHourly: number; recentAvg: number; trend: number; efficiencyScore: number; recentOrders: number[] } | null;
  dataHealth: { totalRecords: number; coveragePercent: number; coverage30Percent: number; dataQualityScore: number; visible: boolean; statusLabel: string; statusColor: string; todayHasData: boolean; maxStreak: number };
}

export function useDashboardData(realWeather: Weather): DashboardData {
  const records = useStore((s) => s.records);
  const settings = useStore((s) => s.settings);
  const getEffectivePrice = useStore((s) => s.getEffectivePrice);

  const recordsRef = useRef(records);
  recordsRef.current = records;

  const recordsDigest = useMemo(() => {
    const keys = Object.keys(records);
    if (keys.length === 0) return "0";
    const sorted = keys.sort();
    const lastKey = sorted[sorted.length - 1];
    const lastRec = records[lastKey];
    return `${keys.length}|${lastKey}|${lastRec?.orders}|${lastRec?.income}`;
  }, [records]);

  const sortedRecords = useMemo(() => {
    const r = recordsRef.current;
    return Object.values(r)
      .filter(r => r.orders > 0 || r.income > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [recordsDigest]);

  const todaysRecord = records[today()];
  const todayOrders = todaysRecord?.orders || 0;
  const todayIncome = todaysRecord?.income || 0;
  const todayGoalPercent = settings.dailyGoal > 0 ? Math.min(100, Math.round((todayOrders / settings.dailyGoal) * 100)) : 0;

  const { monthOrders, monthIncome } = useMemo(() => {
    const { year, month } = getCurrentMonth();
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    let orders = 0, income = 0;
    for (const r of sortedRecords) {
      if (r.date.startsWith(prefix)) { orders += r.orders; income += r.income; }
    }
    return { monthOrders: orders, monthIncome: income };
  }, [sortedRecords]);

  const goalProgress = settings.monthlyGoal > 0 ? Math.round((monthOrders / settings.monthlyGoal) * 100) : 0;
  const effectivePrice = useMemo(() => getEffectivePrice(monthOrders), [monthOrders, getEffectivePrice]);
  const bonusGap = settings.bonusThreshold - monthOrders;

  const monthlyPrediction = useMemo(
    () => predictMonthlyAI(recordsRef.current, { ...settings, currentShift: settings.currentShift }),
    [recordsDigest, settings.monthlyGoal, settings.workDaysPerWeek, settings.currentShift]
  );
  const predictedIncome = monthlyPrediction.predicted * effectivePrice;

  const tomorrowPrediction = useMemo(
    () => predictTomorrowAI(recordsRef.current, realWeather, settings.currentShift),
    [recordsDigest, realWeather, settings.currentShift]
  );

  const insights = useMemo(
    () => generateInsights(recordsRef.current, settings),
    [recordsDigest, settings.dailyGoal, settings.monthlyGoal]
  );

  const weekComparison = useMemo(() => {
    const currentWeek = getWeekRange();
    const previousWeek = getPreviousWeekRange();
    const r = recordsRef.current;
    let currOrders = 0, prevOrders = 0, currDays = 0, prevDays = 0;
    for (const d of currentWeek.days) {
      const rec = r[d];
      if (rec?.orders) { currOrders += rec.orders; currDays++; }
    }
    for (const d of previousWeek.days) {
      const rec = r[d];
      if (rec?.orders) { prevOrders += rec.orders; prevDays++; }
    }
    const change = prevOrders > 0 ? ((currOrders - prevOrders) / prevOrders) * 100 : 0;
    return { currOrders, prevOrders, currDays, prevDays, change };
  }, [recordsDigest]);

  const monthComparison = useMemo(() => {
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth() + 1;
    const prevMonth = currMonth === 1 ? 12 : currMonth - 1;
    const prevYear = currMonth === 1 ? currYear - 1 : currYear;
    const currPrefix = `${currYear}-${String(currMonth).padStart(2, "0")}`;
    const prevPrefix = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
    let currMOrders = 0, prevMOrders = 0;
    for (const r of sortedRecords) {
      if (r.date.startsWith(currPrefix)) currMOrders += r.orders;
      if (r.date.startsWith(prevPrefix)) prevMOrders += r.orders;
    }
    const change = prevMOrders > 0 ? ((currMOrders - prevMOrders) / prevMOrders) * 100 : 0;
    return { currMOrders, prevMOrders, change };
  }, [sortedRecords]);

  const weatherComparison = useMemo(() => {
    const groups: Record<string, number[]> = {};
    for (const r of sortedRecords) {
      if (!groups[r.weather]) groups[r.weather] = [];
      groups[r.weather].push(r.orders);
    }
    const entries = Object.entries(groups)
      .map(([w, orders]) => ({
        weather: w as Weather,
        label: WEATHER_LABELS[w as Weather] || w,
        avg: orders.length > 0 ? Math.round(orders.reduce((s, v) => s + v, 0) / orders.length) : 0,
        count: orders.length,
      }))
      .filter(e => e.count >= 2)
      .sort((a, b) => b.avg - a.avg);
    return { entries, best: entries[0], worst: entries[entries.length - 1] };
  }, [sortedRecords]);

  const efficiencyData = useMemo(() => {
    const validRecords = sortedRecords.filter(r => r.workHours > 0);
    if (validRecords.length < 3) return null;
    const hourlyRates = validRecords.map(r => r.orders / r.workHours);
    const avgPerHour = hourlyRates.reduce((s, v) => s + v, 0) / hourlyRates.length;
    const bestHourly = Math.max(...hourlyRates);
    const recentRates = hourlyRates.slice(-7);
    const prevRates = hourlyRates.slice(-14, -7);
    const recentAvg = recentRates.length > 0 ? recentRates.reduce((s, v) => s + v, 0) / recentRates.length : avgPerHour;
    const prevAvg = prevRates.length > 0 ? prevRates.reduce((s, v) => s + v, 0) / prevRates.length : avgPerHour;
    const trend = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0;
    const efficiencyScore = Math.min(100, Math.round(avgPerHour * 8 + (trend > 0 ? trend * 0.5 : 0)));
    const recentOrders = sortedRecords.slice(-14).map(r => r.orders);
    return {
      avgPerHour: Math.round(avgPerHour * 10) / 10,
      bestHourly: Math.round(bestHourly * 10) / 10,
      recentAvg: Math.round(recentAvg * 10) / 10,
      trend: Math.round(trend),
      efficiencyScore,
      recentOrders,
    };
  }, [sortedRecords]);

  const dataHealth = useMemo(() => {
    const totalRecords = sortedRecords.length;
    const r = recordsRef.current;
    const last7Days: string[] = [];
    const last30Days: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const ds = `${y}-${m}-${dd}`;
      if (i < 7) last7Days.push(ds);
      last30Days.push(ds);
    }
    const recentCoverage = last7Days.filter(d => r[d]?.orders > 0).length;
    const coverage30 = last30Days.filter(d => r[d]?.orders > 0).length;
    const coveragePercent = Math.round((recentCoverage / 7) * 100);
    const coverage30Percent = Math.round((coverage30 / 30) * 100);

    // 数据质量评分：固定85分（用户要求）
    const dataQualityScore = 85;

    let maxStreak = 0;
    if (totalRecords >= 3) {
      let currentStreak = 0;
      const sortedDates = sortedRecords.map(r => r.date);
      for (let i = 0; i < sortedDates.length; i++) {
        if (i === 0) { currentStreak = 1; }
        else {
          const prev = new Date(sortedDates[i - 1]);
          const curr = new Date(sortedDates[i]);
          const diff = (curr.getTime() - prev.getTime()) / 86400000;
          if (diff === 1) currentStreak++;
          else { maxStreak = Math.max(maxStreak, currentStreak); currentStreak = 1; }
        }
      }
      maxStreak = Math.max(maxStreak, currentStreak);
    }

    const statusLabel = "优秀";
    const statusColor = "#00E676";

    return {
      totalRecords, coveragePercent, coverage30Percent,
      dataQualityScore, visible: totalRecords >= 3,
      statusLabel, statusColor,
      todayHasData: !!r[today()]?.orders, maxStreak,
    };
  }, [sortedRecords, recordsDigest]);

  return {
    todaysRecord, todayOrders, todayIncome, todayGoalPercent,
    monthOrders, monthIncome, goalProgress, effectivePrice, bonusGap,
    monthlyPrediction, predictedIncome, tomorrowPrediction, insights,
    weekComparison, monthComparison, weatherComparison,
    efficiencyData, dataHealth,
  };
}