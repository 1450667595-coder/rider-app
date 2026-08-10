import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface ToastMessage {
  id: number;
  text: string;
  type: "success" | "error" | "info";
}

let toastId = 0;
const listeners: Set<(msg: ToastMessage) => void> = new Set();

// eslint-disable-next-line react-refresh/only-export-components
export function showToast(text: string, type: "success" | "error" | "info" = "success") {
  const msg: ToastMessage = { id: ++toastId, text, type };
  listeners.forEach((fn) => fn(msg));
}

export default function ToastContainer() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const { isIOS } = useTheme();

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      }, 2500);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const iconColor = (type: ToastMessage["type"]) => {
    if (isIOS) {
      if (type === "success") return "text-[#34C759]";
      if (type === "error") return "text-[#FF3B30]";
      return "text-[#007AFF]";
    }
    if (type === "success") return "text-[#00E676]";
    if (type === "error") return "text-[#FF1744]";
    return "text-[#00E5FF]";
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl ${
              isIOS ? "ios-toast" : ""
            }`}
            style={
              isIOS
                ? undefined
                : {
                    background: "rgba(4, 6, 16, 0.9)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid rgba(0, 229, 255, 0.12)",
                    boxShadow: "0 0 30px rgba(0, 229, 255, 0.08)",
                  }
            }
          >
            {msg.type === "success" && (
              <CheckCircle size={18} className={iconColor(msg.type)} />
            )}
            {msg.type === "error" && (
              <AlertCircle size={18} className={iconColor(msg.type)} />
            )}
            {msg.type === "info" && (
              <AlertCircle size={18} className={iconColor(msg.type)} />
            )}
            <span className={`text-sm font-medium ${isIOS ? "text-black" : "text-[#E0E0E0]"}`}>
              {msg.text}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
