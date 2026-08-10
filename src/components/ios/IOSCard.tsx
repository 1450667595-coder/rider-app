import { motion } from "framer-motion";

interface IOSCardProps {
  children: React.ReactNode;
  className?: string;
  radius?: "xl" | "2xl";
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: () => void;
}

export default function IOSCard({
  children,
  className = "",
  radius = "xl",
  padding = "md",
  onClick,
}: IOSCardProps) {
  const paddingMap = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-5",
  };

  const Comp = onClick ? motion.button : motion.div;

  return (
    <Comp
      onClick={onClick}
      className={`ios-card ${radius === "2xl" ? "ios-card-2xl" : ""} ${paddingMap[padding]} ${className}`}
      style={{
        background: "var(--ios-grouped-secondary)",
        boxShadow: "var(--ios-shadow-xs)",
        width: "100%",
        textAlign: "left",
      }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      {children}
    </Comp>
  );
}
