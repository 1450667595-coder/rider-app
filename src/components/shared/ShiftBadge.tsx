import { useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, Coffee, ChevronLeft, ChevronRight } from "lucide-react";
import useStore from "@/store/useStore";
import { SHIFT_DEFINITIONS, SHIFT_MAP, type ShiftType } from "@/types";

export default function ShiftBadge() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const currentShift = SHIFT_MAP[settings.currentShift] || SHIFT_DEFINITIONS[0];
  const shiftIndex = SHIFT_DEFINITIONS.findIndex((s) => s.type === currentShift.type);

  const switchShift = useCallback(
    (direction: "prev" | "next") => {
      const newIndex =
        direction === "next"
          ? (shiftIndex + 1) % 5
          : (shiftIndex - 1 + 5) % 5;
      const newShift: ShiftType = SHIFT_DEFINITIONS[newIndex].type;
      updateSettings({ currentShift: newShift });
    },
    [shiftIndex, updateSettings]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="holo-card rounded-[22px] p-4 flex items-center justify-between"
    >
      <button
        onClick={() => switchShift("prev")}
        className="tap-cyber w-8 h-8 flex items-center justify-center rounded-full"
        style={{
          background: "rgba(0,229,255,0.04)",
          border: "1px solid rgba(0,229,255,0.1)",
        }}
      >
        <ChevronLeft size={16} className="text-[#E0E0E0]/45" />
      </button>

      <div className="flex items-center gap-3 flex-1 justify-center">
        <span className="text-2xl">{currentShift.emoji}</span>
        <div>
          <p className="text-[#E0E0E0] font-bold text-sm">{currentShift.name}</p>
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

      <button
        onClick={() => switchShift("next")}
        className="tap-cyber w-8 h-8 flex items-center justify-center rounded-full"
        style={{
          background: "rgba(0,229,255,0.04)",
          border: "1px solid rgba(0,229,255,0.1)",
        }}
      >
        <ChevronRight size={16} className="text-[#E0E0E0]/45" />
      </button>
    </motion.div>
  );
}