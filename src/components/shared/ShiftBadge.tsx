import { motion } from "framer-motion";
import { Clock, Coffee } from "lucide-react";
import useStore from "@/store/useStore";
import { SHIFT_MAP, SHIFT_DEFINITIONS } from "@/types";

export default function ShiftBadge() {
  const settings = useStore((s) => s.settings);
  const currentShift = SHIFT_MAP[settings.currentShift] || SHIFT_DEFINITIONS[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="holo-card rounded-[22px] p-4 flex items-center justify-center"
    >
      <div className="flex items-center gap-3">
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
    </motion.div>
  );
}