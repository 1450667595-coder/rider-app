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
      case "total_orders": return "text-[#00E5FF]";
      case "streak": return "text-[#FF6D00]";
      case "daily_record": return "text-[#00E5FF]";
      case "monthly_record": return "text-[#E040FB]";
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
        <h1 className="text-2xl font-bold text-[#E0E0E0] flex items-center gap-2 tracking-[-0.01em]">
          <Award size={24} className="text-[#00E5FF] icon-glow-cyan" />
          成就系统
        </h1>
      </motion.div>

      {/* Stats Row */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        <div className="holo-card rounded-[26px] p-3 text-center">
          <Award size={20} className="text-[#00E5FF] mx-auto mb-1 icon-glow-cyan" />
          <span className="text-lg font-bold text-[#E0E0E0]">{unlockedCount}</span>
          <span className="terminal-text text-[10px] block">/ {achievements.length}</span>
        </div>
        <div className="holo-card rounded-[26px] p-3 text-center">
          <Flame size={20} className="text-[#FF6D00] mx-auto mb-1 icon-glow-gold" />
          <AnimatedNumber value={streak} className="text-lg font-bold text-[#E0E0E0]" />
          <span className="terminal-text text-[10px] block">连续天数</span>
        </div>
        <div className="holo-card rounded-[26px] p-3 text-center">
          <Zap size={20} className="text-[#00E5FF] mx-auto mb-1 icon-glow-cyan" />
          <AnimatedNumber value={stats.totalOrders} className="text-lg font-bold text-[#E0E0E0]" />
          <span className="terminal-text text-[10px] block">累计单量</span>
        </div>
      </motion.div>

      {/* Personal Records */}
      <motion.div variants={item} className="holo-card rounded-[26px] p-4">
        <h3 className="cyber-section-title flex items-center gap-2">
          <Star size={16} className="text-[#00E5FF] icon-glow-cyan" />
          个人纪录
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#00E5FF]/5 rounded-xl p-3">
            <p className="terminal-text text-xs">最高日单量</p>
            <p className="text-xl font-bold text-[#E0E0E0] mt-0.5">{stats.maxDaily} <span className="text-sm font-normal terminal-text">单</span></p>
          </div>
          <div className="bg-[#00E5FF]/5 rounded-xl p-3">
            <p className="terminal-text text-xs">最高月单量</p>
            <p className="text-xl font-bold text-[#E0E0E0] mt-0.5">{stats.maxMonthly} <span className="text-sm font-normal terminal-text">单</span></p>
          </div>
          <div className="bg-[#00E5FF]/5 rounded-xl p-3 col-span-2">
            <p className="terminal-text text-xs">累计总收入</p>
            <p className="text-xl font-bold text-[#E0E0E0] mt-0.5">
              ¥{stats.totalIncome.toLocaleString()}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Badge Grid */}
      <motion.div variants={item}>
        <h3 className="cyber-section-title">徽章墙</h3>
        <div className="grid grid-cols-2 gap-3">
          {achievements.map((achievement) => (
            <motion.div
              key={achievement.id}
              variants={item}
              className={`tap-cyber rounded-2xl p-4 border transition-all ${
                achievement.unlocked
                  ? "holo-card"
                  : "bg-[#00E5FF]/[0.02] border-[#00E5FF]/8 opacity-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    achievement.unlocked ? "bg-[#00E5FF]/10" : "bg-[#00E5FF]/5"
                  }`}
                >
                  {achievement.unlocked ? achievement.icon : <Lock size={20} className="text-[#E0E0E0]/20" />}
                </div>
                <div>
                  <p className={`text-sm font-bold ${achievement.unlocked ? "text-[#E0E0E0]" : "text-[#E0E0E0]/30"}`}>
                    {achievement.name}
                  </p>
                  <p className="terminal-text text-[10px]">{achievement.description}</p>
                  <span className={`text-[10px] font-medium ${getTypeColor(achievement.type)}`}>
                    {getTypeLabel(achievement.type)}
                  </span>
                </div>
              </div>
              {achievement.unlocked && achievement.unlockedAt && (
                <p className="terminal-text text-[10px] mt-2">
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