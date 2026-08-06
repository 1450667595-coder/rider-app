import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Coffee, Zap, Calendar, Target, PlusCircle, ArrowRight } from "lucide-react";
import useStore from "@/store/useStore";
import { getWeekStart, getShiftForDate } from "@/utils/date";

function parseTime(dateStr: string, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  const [y, mo, day] = dateStr.split("-").map(Number);
  d.setFullYear(y, (mo || 1) - 1, day);
  d.setHours(h, m, 0, 0);
  d.setMilliseconds(0);
  return d;
}

function formatDuration(ms: number): string {
  const m = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h > 0) return `${h}小时${rm > 0 ? `${rm}分` : ""}`;
  return `${rm}分钟`;
}

export default function SmartShiftCard() {
  const navigate = useNavigate();
  const settings = useStore((s) => s.settings);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const currentMonday = getWeekStart();
  const shift = useMemo(
    () => getShiftForDate(currentMonday, settings),
    [currentMonday, settings]
  );

  const status = useMemo(() => {
    const start = parseTime(todayStr, shift.startTime);
    const end = parseTime(todayStr, shift.endTime);
    if (end <= start) end.setDate(end.getDate() + 1);

    let restStart: Date | null = null;
    let restEnd: Date | null = null;
    if (shift.restTime) {
      const [rs, re] = shift.restTime.split("-");
      restStart = parseTime(todayStr, rs);
      restEnd = parseTime(todayStr, re);
      if (restEnd <= restStart) restEnd.setDate(restEnd.getDate() + 1);
    }

    if (now < start) {
      return {
        state: "upcoming",
        label: "未开始",
        color: "#00E5FF",
        sub: `距开始 ${formatDuration(start.getTime() - now.getTime())}`,
        progress: 0,
      };
    }
    if (now >= end) {
      return {
        state: "finished",
        label: "已下班",
        color: "#E040FB",
        sub: "今日班次已结束",
        progress: 100,
      };
    }

    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));

    if (restStart && restEnd && now >= restStart && now < restEnd) {
      return {
        state: "resting",
        label: "休息中",
        color: "#FFD740",
        sub: `休息至 ${shift.restTime?.split("-")[1]}`,
        progress,
      };
    }

    return {
      state: "working",
      label: "工作中",
      color: "#00E676",
      sub: `预计下班 ${shift.endTime}`,
      progress,
    };
  }, [now, shift, todayStr]);

  const quickActions = [
    { label: "记单", icon: PlusCircle, to: "/records" },
    { label: "周报", icon: Calendar, to: "/weekly" },
    { label: "目标", icon: Target, to: "/goals" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="holo-projection rounded-[22px] p-4 corner-brackets overflow-hidden"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{
              background: `linear-gradient(135deg, ${shift.color}20, ${shift.color}08)`,
              border: `1px solid ${shift.color}40`,
              boxShadow: `0 0 20px ${shift.color}20`,
            }}
          >
            {shift.emoji}
          </div>
          <div>
            <p className="text-[#E0E0E0] font-bold text-sm flex items-center gap-2">
              本周班次 · {shift.name}
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full border"
                style={{ color: status.color, borderColor: `${status.color}40`, background: `${status.color}10` }}
              >
                {status.label}
              </span>
            </p>
            <p className="terminal-text text-[10px] flex items-center gap-1 mt-0.5">
              <Clock size={10} style={{ color: shift.color }} />
              {shift.timeRange}
              {shift.restTime && (
                <>
                  <span className="mx-1 text-[#E0E0E0]/20">|</span>
                  <Coffee size={10} className="text-[#FFD740]" />
                  休息 {shift.restTime}
                </>
              )}
            </p>
          </div>
        </div>
        <Zap size={16} className="text-[#00E5FF]/30" />
      </div>

      {/* 班次进度 */}
      <div className="space-y-1.5 mb-4">
        <div className="flex justify-between text-[10px]">
          <span className="terminal-text text-[#E0E0E0]/40">班次进度</span>
          <span className="terminal-text" style={{ color: status.color }}>{Math.round(status.progress)}%</span>
        </div>
        <div className="progress-tech">
          <div
            className="progress-tech-fill"
            style={{ width: `${status.progress}%`, boxShadow: `0 0 15px ${status.color}66` }}
          />
        </div>
        <p className="terminal-text text-[9px] text-[#E0E0E0]/30">{status.sub}</p>
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-3 gap-2">
        {quickActions.map((action) => (
          <button
            key={action.to}
            onClick={() => navigate(action.to)}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium transition-all tap-cyber"
            style={{
              background: "rgba(0,229,255,0.05)",
              border: "1px solid rgba(0,229,255,0.12)",
              color: "rgba(224, 224, 224, 0.85)",
            }}
          >
            <action.icon size={13} className="text-[#00E5FF]" />
            {action.label}
            <ArrowRight size={10} className="text-[#E0E0E0]/20" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
