interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

// 极简实现：直接显示数值，无动画开销
export default function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  className = "",
}: AnimatedNumberProps) {
  return (
    <span className={className}>
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}