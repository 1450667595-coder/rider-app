import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "blush" | "sage" | "ocean" | "gold";
}

const variants = {
  default: "bg-white border-mocha-100",
  blush: "bg-gradient-to-br from-blush-50 to-white border-blush-100",
  sage: "bg-gradient-to-br from-sage-50 to-white border-sage-100",
  ocean: "bg-gradient-to-br from-ocean-50 to-white border-ocean-100",
  gold: "bg-gradient-to-br from-gold-100 to-white border-gold-200",
};

export function Card({ children, className, variant = "default" }: CardProps) {
  return (
    <div className={cn("rounded-3xl border shadow-soft p-5", variants[variant], className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-sm font-semibold text-mocha-500 tracking-wide uppercase", className)}>{children}</h3>;
}
