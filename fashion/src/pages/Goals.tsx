import { useState, useMemo } from "react";
import { Trophy, Target, TrendingUp } from "lucide-react";
import useStore from "@/store/useStore";
import { Card, CardTitle } from "@/components/shared/Card";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import { cn } from "@/lib/utils";
import { predictMonthly } from "@/utils/prediction";

export default function Goals() {
  const records = useStore((s) => s.records);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const [dailyGoalInput, setDailyGoalInput] = useState(String(settings.dailyGoal));
  const [nickname, setNickname] = useState(settings.nickname);

  const monthlyGoal = settings.dailyGoal * 30;
  const monthly = useMemo(() => predictMonthly(records, monthlyGoal), [records, monthlyGoal]);
  const progress = monthlyGoal > 0 ? Math.min((monthly.completed / monthlyGoal) * 100, 100) : 0;

  const saveSettings = () => {
    updateSettings({
      dailyGoal: Number(dailyGoalInput) || 40,
      nickname: nickname || "骑手",
    });
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-mocha-800">目标设定</h1>
        <p className="text-sm text-mocha-400 mt-1">给自己定个小目标</p>
      </header>

      <Card variant="gold">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gold-200 flex items-center justify-center text-mocha-700">
            <Trophy size={28} />
          </div>
          <div>
            <CardTitle className="!normal-case">本月目标</CardTitle>
            <p className="text-3xl font-semibold text-mocha-800 mt-1">
              <AnimatedNumber value={monthlyGoal} /> 单
            </p>
          </div>
        </div>
        <div className="mt-5">
          <div className="h-3 bg-mocha-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gold-300 to-gold-400 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-mocha-400 mt-2">
            已完成 {monthly.completed} 单 ({Math.round(progress)}%)
          </p>
        </div>
      </Card>

      <Card>
        <CardTitle>本月预测</CardTitle>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="p-4 rounded-2xl bg-mocha-50">
            <p className="text-xs text-mocha-400">预计完成</p>
            <p className="text-2xl font-semibold text-mocha-800 mt-1">{monthly.predicted} 单</p>
          </div>
          <div className="p-4 rounded-2xl bg-mocha-50">
            <p className="text-xs text-mocha-400">剩余日均</p>
            <p className="text-2xl font-semibold text-mocha-800 mt-1">{monthly.dailyNeeded} 单</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>个人设置</CardTitle>
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-mocha-400 mb-2">昵称</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onBlur={saveSettings}
              className="w-full bg-mocha-50 rounded-2xl px-4 py-3 text-mocha-800 outline-none focus:ring-2 focus:ring-blush-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-mocha-400 mb-2">日均目标单量</label>
            <input
              type="number"
              inputMode="numeric"
              value={dailyGoalInput}
              onChange={(e) => setDailyGoalInput(e.target.value)}
              onBlur={saveSettings}
              className="w-full bg-mocha-50 rounded-2xl px-4 py-3 text-mocha-800 outline-none focus:ring-2 focus:ring-gold-200"
            />
          </div>
        </div>
      </Card>

      <Card variant="sage">
        <div className="flex items-start gap-3">
          <Target size={20} className="text-sage-500 mt-0.5" />
          <div>
            <h3 className="font-semibold text-mocha-800">目标小贴士</h3>
            <p className="text-sm text-mocha-500 mt-1 leading-relaxed">
              建议日均目标设定在自身历史均值的 110% 左右，既能保持动力，又不会过度疲劳。
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
