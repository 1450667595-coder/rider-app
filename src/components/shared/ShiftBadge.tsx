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
      className="glass rounded-2xl p-4 flex items-center justify-between"
    >
      <button
        onClick={() => switchShift("prev")}
        className="w-8 h-8 flex items-center justify-center rounded-full glass-subtle hover:bg-white/10 transition-colors"
      >
        <ChevronLeft size={16} className="text-white/60" />
      </button>

      <div className="flex items-center gap-3 flex-1 justify-center">
        <span className="text-2xl">{currentShift.emoji}</span>
        <div>
          <p className="text-white font-bold text-sm">{currentShift.name}</p>
          <p className="text-white/50 text-xs flex items-center gap-1">
            <Clock size={10} />
            {currentShift.timeRange}
          </p>
          {currentShift.restTime && (
            <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5">
              <Coffee size={10} />
              休息 {currentShift.restTime}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={() => switchShift("next")}
        className="w-8 h-8 flex items-center justify-center rounded-full glass-subtle hover:bg-white/10 transition-colors"
      >
        <ChevronRight size={16} className="text-white/60" />
      </button>
    </motion.div>
  );
}