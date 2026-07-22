import { useClock } from "@/hooks/useClock";

export default function LiveClock() {
  const { timeStr, dateStr } = useClock();

  return (
    <div className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5">
      <span className="text-white/50 text-sm">{dateStr}</span>
      <span className="text-[#FFD100] text-sm font-mono font-bold tabular-nums">
        {timeStr}
      </span>
    </div>
  );
}