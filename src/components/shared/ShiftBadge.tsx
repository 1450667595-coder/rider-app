import { motion } from "framer-motion";
import { Clock, Coffee, ChevronRight } from "lucide-react";
import useStore from "@/store/useStore";
import { getWeekStart, getShiftForDate } from "@/utils/date";

export default function ShiftBadge() {
  const settings = useStore((s) => s.settings);
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentShift = getShiftForDate(todayStr, settings);

  // 下周一预览
  const nextMonday = new Date(getWeekStart(todayStr));
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextMondayStr = `${nextMonday.getFullYear()}-${String(nextMonday.getMonth() + 1).padStart(2, "0")}-${String(nextMonday.getDate()).padStart(2, "0")}`;
  const nextShift = getShiftForDate(nextMondayStr, settings);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="holo-card rounded-[22px] p-4 corner-brackets"
    >
      <div className="flex items-center justify-between">
        {/* 本周班次 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl" style={{ background: `linear-gradient(135deg, ${currentShift.color}20, ${currentShift.color}08)`, border: `1px solid ${currentShift.color}40` }}>
            {currentShift.emoji}
          </div>
          <div>
            <p className="text-[#E0E0E0] font-bold text-sm">本周班次 · {currentShift.name}</p>
            <p className="terminal-text text-[10px] flex items-center gap-1">
              <Clock size={10} />
              {currentShift.timeRange}
            </p>
            {currentShift.restTime && (
              <p className="terminal-text text-[9px] text-[#E0E0E0]/25 flex items-center gap-1 mt-0.5">
                <Coffee size={10} />
                休息 {currentShift.restTime}
              </p>
            )}
          </div>
        </div>

        {/* 下周预览 */}
        <div className="flex items-center gap-2 pl-3 border-l border-[#E0E0E0]/10">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ background: `linear-gradient(135deg, ${nextShift.color}18, ${nextShift.color}06)`, border: `1px solid ${nextShift.color}30` }}>
            {nextShift.emoji}
          </div>
          <div>
            <p className="text-[#E0E0E0]/50 text-[10px]">下周</p>
            <p className="text-[#E0E0E0]/80 text-xs font-medium">{nextShift.name}</p>
          </div>
          <ChevronRight size={14} className="text-[#E0E0E0]/20" />
        </div>
      </div>
    </motion.div>
  );
}
