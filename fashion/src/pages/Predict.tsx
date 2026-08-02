import { useState, useMemo } from "react";
import { Sparkles, CloudRain, CalendarHeart, TrendingUp } from "lucide-react";
import useStore from "@/store/useStore";
import { Card, CardTitle } from "@/components/shared/Card";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import { cn } from "@/lib/utils";
import { predictTomorrowAI } from "@/utils/prediction";
import { Weather, WEATHER_OPTIONS, WEATHER_LABELS } from "@/types";
import { today, formatDate } from "@/utils/date";

export default function Predict() {
  const records = useStore((s) => s.records);
  const [weather, setWeather] = useState<Weather>("sunny");

  const prediction = useMemo(() => predictTomorrowAI(records, weather), [records, weather]);

  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const tomorrow = new Date(today() + "T00:00:00");
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-mocha-800">AI 预测</h1>
        <p className="text-sm text-mocha-400 mt-1">时尚版智能预测引擎</p>
      </header>

      <Card variant="blush" className="relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blush-100 rounded-full opacity-50" />
        <div className="relative text-center py-4">
          <p className="text-sm text-mocha-500 font-medium">
            {tomorrow.getMonth() + 1}月{tomorrow.getDate()}日 · {weekdays[tomorrow.getDay()]}
          </p>
          <div className="mt-4">
            <AnimatedNumber
              value={prediction.predictedOrders}
              className="text-6xl font-semibold text-mocha-800 tracking-tight"
            />
            <span className="text-mocha-500 text-lg ml-2">单</span>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 text-xs font-medium text-mocha-500">
            <Sparkles size={12} />
            置信度：
            {prediction.confidence === "high" ? "高" : prediction.confidence === "medium" ? "中" : "低"}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>选择明日天气</CardTitle>
        <div className="flex gap-2 flex-wrap mt-4">
          {WEATHER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setWeather(opt.value)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                weather === opt.value
                  ? "bg-ocean-50 text-ocean-500 border-ocean-200"
                  : "bg-white text-mocha-500 border-mocha-100 hover:border-mocha-200"
              )}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>预测因子</CardTitle>
        <div className="mt-4 space-y-3">
          {prediction.factors.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-2xl bg-mocha-50"
            >
              <span className="text-sm font-medium text-mocha-700">{f.label}</span>
              <span className="text-xs text-mocha-500">{f.impact}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card variant="sage">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center text-sage-500 shrink-0">
            <CloudRain size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-mocha-800">雨天爆单逻辑</h3>
            <p className="text-sm text-mocha-500 mt-1 leading-relaxed">
              坏天气人们更倾向于点外卖，系统已将雨天预测上调 25%，雪天上调 35%。
            </p>
          </div>
        </div>
      </Card>

      <Card variant="gold">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gold-200 flex items-center justify-center text-mocha-700 shrink-0">
            <CalendarHeart size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-mocha-800">特殊事件识别</h3>
            <p className="text-sm text-mocha-500 mt-1 leading-relaxed">
              8月7日「秋天第一杯奶茶」订单预计暴增 60%，情人节、双十一等节日均已内置。
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
