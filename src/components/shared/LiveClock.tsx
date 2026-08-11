import { useClock } from "@/hooks/useClock";

export default function LiveClock() {
  const { timeStr, dateStr } = useClock();

  return (
    <div className="flex items-center gap-2 rounded-full px-3 py-1.5"
      style={{
        background: "rgba(0,229,255,0.03)",
        border: "1px solid rgba(0,229,255,0.08)",
      }}>
      <span className="terminal-text text-[11px] text-[#E0E0E0]/35">{dateStr}</span>
      <span className="text-[#00E5FF] text-sm font-mono font-bold tabular-nums"
        style={{ textShadow: "0 0 10px rgba(0,229,255,0.3)" }}>
        {timeStr}
      </span>
    </div>
  );
}
