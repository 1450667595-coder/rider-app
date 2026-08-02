import { useEffect, useState, useRef } from "react";
import { formatNumber } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

export default function AnimatedNumber({
  value,
  className,
  prefix,
  suffix,
  duration = 800,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const startRef = useRef(value);
  const rafRef = useRef<number>();

  useEffect(() => {
    const start = startRef.current;
    const end = value;
    const startTime = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        startRef.current = end;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}
      {formatNumber(display)}
      {suffix}
    </span>
  );
}
