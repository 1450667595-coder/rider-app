import { useMemo } from "react";
import { motion } from "framer-motion";
import { Award, Flame, Zap, Star, Lock } from "lucide-react";
import useStore from "@/store/useStore";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import { Achievement } from "@/types";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 },
};

export default function Achievements() {
  const achievements = useStore((s) => s.achievements);
  const records = useStore((s) => s.records);
  const streak = useStore((s) => s.getStreak());

  const stats = useMemo(() => {
    const allRecords = Object.values(records);
    const totalOrders = allRecords.reduce((s, r) => s + r.orders, 0);
    const totalIncome = allRecords.reduce((s, r) => s + r.income, 0);
    const maxDaily = allRecords.reduce((max, r) => Math.max(max, r.orders), 0);

    // Find max monthly
    let maxMonthly = 0;
    const monthMap: Record<string, number> = {};
    allRecords.forEach((r) => {
      const key = r.date.slice(0, 7);
      monthMap[key] = (monthMap[key] || 0) + r.orders;
    });
    Object.values(monthMap).forEach((v) => {
      if (v > maxMonthly) maxMonthly = v;
    });

    return { totalOrders, totalIncome, maxDaily, maxMonthly };
  }, [records]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const getTypeLabel = (type: Achievement["type"]) => {
    switch (type) {
      case "total_orders": return "累计";
      case "streak": return "连续";
      case "daily_record": return "日纪录";
      case "monthly_record": return "月纪录";
    }
  };

  const getTypeColor = (type: Achievement["type"]) => {
    switch (type) {
      case "total_orders": return "text-[#FFD100]";
      case "streak": return "text-[#FF6B35]";
      case "daily_record": return "text-[#00D2FF]";
      case "monthly_record": return "text-[#7B2FF7]";
    }
  };

  return (
    <motion.div
      className="px-4 pt-6 pb-4 space-y-5"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Award size={24} className="text-[#FFD100]" />
          成就系统
        </h1>
      </motion.div>

      {/* Stats Row */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <div className="bg-[#16213E] rounded-2xl p-3 border border-white/5 text-center">
          <Award size={20} className="text-[#FFD100] mx-auto mb-1" />
          <span className="text-lg font-bold text-white">{unlockedCount}</span>
          <span className="text-white/40 text-[10px] block">/ {achievements.length}</span>
        </div>
        <div className="bg-[#16213E] rounded-2xl p-3 border border-white/5 text-center">
          <Flame size={20} className="text-[#FF6B35] mx-auto mb-1" />
          <AnimatedNumber value={streak} className="text-lg font-bold text-white" />
          <span className="text-white/40 text-[10px] block">连续天数</span>
        </div>
        <div className="bg-[#16213E] rounded-2xl p-3 border border-white/5 text-center">
          <Zap size={20} className="text-[#00D2FF] mx-auto mb-1" />
          <AnimatedNumber value={stats.totalOrders} className="text-lg font-bold text-white" />
          <span className="text-white/40 text-[10px] block">累计单量</span>
        </div>
      </motion.div>

      {/* Personal Records */}
      <motion.div variants={item} className="bg-[#16213E] rounded-2xl p-4 border border-white/5">
        <h3 className="text-white/60 text-sm font-medium mb-3 flex items-center gap-2">
          <Star size={16} className="text-[#FFD100]" />
          个人纪录
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-white/40 text-xs">最高日单量</p>
            <p className="text-xl font-bold text-white mt-0.5">{stats.maxDaily} <span className="text-sm font-normal text-white/60">单</span></p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-white/40 text-xs">最高月单量</p>
            <p className="text-xl font-bold text-white mt-0.5">{stats.maxMonthly} <span className="text-sm font-normal text-white/60">单</span></p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 col-span-2">
            <p className="text-white/40 text-xs">累计总收入</p>
            <p className="text-xl font-bold text-white mt-0.5">
              ¥{stats.totalIncome.toLocaleString()}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Badge Grid */}
      <motion.div variants={item}>
        <h3 className="text-white/60 text-sm font-medium mb-3">徽章墙</h3>
        <div className="grid grid-cols-2 gap-3">
          {achievements.map((achievement) => (
            <motion.div
              key={achievement.id}
              variants={item}
              className={`rounded-2xl p-4 border transition-all ${
                achievement.unlocked
                  ? "bg-[#16213E] border-white/10"
                  : "bg-white/[0.02] border-white/5 opacity-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    achievement.unlocked ? "bg-white/10" : "bg-white/5"
                  }`}
                >
                  {achievement.unlocked ? achievement.icon : <Lock size={20} className="text-white/20" />}
                </div>
                <div>
                  <p className={`text-sm font-bold ${achievement.unlocked ? "text-white" : "text-white/30"}`}>
                    {achievement.name}
                  </p>
                  <p className="text-white/40 text-[10px]">{achievement.description}</p>
                  <span className={`text-[10px] font-medium ${getTypeColor(achievement.type)}`}>
                    {getTypeLabel(achievement.type)}
                  </span>
                </div>
              </div>
              {achievement.unlocked && achievement.unlockedAt && (
                <p className="text-white/20 text-[10px] mt-2">
                  解锁于 {achievement.unlockedAt}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}