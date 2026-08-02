import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/70 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[28px]"
            style={{
              background: "rgba(4, 6, 16, 0.92)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderTop: "1px solid rgba(0, 229, 255, 0.1)",
              borderLeft: "1px solid rgba(0, 229, 255, 0.04)",
              borderRight: "1px solid rgba(0, 229, 255, 0.04)",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.6), 0 -2px 8px rgba(0,0,0,0.4)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Top highlight line */}
            <div className="absolute top-0 left-[15%] right-[15%] h-[0.5px] pointer-events-none z-10"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(0,229,255,0.2), rgba(0,229,255,0.3), rgba(0,229,255,0.2), transparent)",
              }}
            />
            <div className="flex items-center justify-between p-5 pb-2">
              <div className="w-8" />
              <h3 className="text-lg font-bold text-[#E0E0E0] tracking-tight">{title}</h3>
              <button
                onClick={onClose}
                className="tap-cyber w-8 h-8 flex items-center justify-center rounded-full"
                style={{
                  background: "rgba(0,229,255,0.05)",
                  border: "1px solid rgba(0,229,255,0.1)",
                }}
              >
                <X size={16} className="text-[#E0E0E0]/40" />
              </button>
            </div>
            <div className="px-5 pb-8">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}