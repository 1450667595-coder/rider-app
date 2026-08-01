import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle } from "lucide-react";

interface ToastMessage {
  id: number;
  text: string;
  type: "success" | "error" | "info";
}

let toastId = 0;
const listeners: Set<(msg: ToastMessage) => void> = new Set();

export function showToast(text: string, type: "success" | "error" | "info" = "success") {
  const msg: ToastMessage = { id: ++toastId, text, type };
  listeners.forEach((fn) => fn(msg));
}

export default function ToastContainer() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

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

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl"
            style={{
              background: "rgba(4, 6, 16, 0.9)",
              backdropFilter: "blur(30px) saturate(180%)",
              WebkitBackdropFilter: "blur(30px) saturate(180%)",
              border: "1px solid rgba(0, 229, 255, 0.12)",
              boxShadow: "0 0 30px rgba(0, 229, 255, 0.08)",
            }}
          >
            {msg.type === "success" && (
              <CheckCircle size={18} className="text-[#00E676]" />
            )}
            {msg.type === "error" && (
              <AlertCircle size={18} className="text-[#FF1744]" />
            )}
            {msg.type === "info" && (
              <AlertCircle size={18} className="text-[#00E5FF]" />
            )}
            <span className="text-[#E0E0E0] text-sm font-medium">{msg.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}